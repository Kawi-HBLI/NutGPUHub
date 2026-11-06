import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { demoAccounts, seedDemoAccounts } from '../prisma/demo-accounts.js';
import { createApp } from '../server/app.js';
import { hashPassword, verifyPassword } from '../server/password.js';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || testUrl === process.env.DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a separate, migrated PostgreSQL database.');
}

const database = new PrismaClient({ datasourceUrl: testUrl });
const origin = 'http://localhost:5173';
const app = createApp(database, origin);
const suffix = randomUUID();
const password = randomBytes(18).toString('hex');
const student = `student-${suffix}`;
const operator = `operator-${suffix}`;

beforeAll(async () => {
  const [studentHash, operatorHash] = await Promise.all([hashPassword(password), hashPassword(password)]);
  await database.user.createMany({ data: [
    { username: student, passwordHash: studentHash, role: 'student' },
    { username: operator, passwordHash: operatorHash, role: 'operator' },
  ] });
});

afterAll(async () => {
  try {
    await database.user.deleteMany({ where: { username: { in: [student, operator] } } });
  } finally {
    await database.$disconnect();
  }
});

function login(username: string, attempt = password, application = app) {
  return request(application).post('/api/v1/auth/login').set('Origin', origin).send({ username, password: attempt });
}

async function studentCookie(application = app): Promise<string> {
  const response = await login(student, password, application).expect(200);
  const cookies = response.headers['set-cookie'] as string[];
  return cookies[0].split(';', 1)[0];
}

test('TC-AUTH-01 returns both roles and rejects invalid credentials without creating a session', async () => {
  const studentResponse = await login(student).expect(200);
  const operatorResponse = await login(operator).expect(200);
  expect(studentResponse.body).toEqual({ id: expect.any(Number), username: student, role: 'student' });
  expect(operatorResponse.body).toEqual({ id: expect.any(Number), username: operator, role: 'operator' });
  expect(studentResponse.headers['set-cookie'][0]).toMatch(/HttpOnly; SameSite=Lax/i);

  const count = await database.session.count();
  const wrongPassword = await login(student, 'wrong-password').expect(401);
  const unknown = await login(`unknown-${suffix}`).expect(401);
  expect(wrongPassword.body).toEqual(unknown.body);
  expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  expect(unknown.headers['set-cookie']).toBeUndefined();
  expect(await database.session.count()).toBe(count);
});

test('TC-AUTH-02 retrieves the account and rejects a signed-out cookie replay', async () => {
  await request(app).get('/api/v1/auth/me').expect(401);
  const cookie = await studentCookie();
  const identity = await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
  expect(identity.body).toEqual({ id: expect.any(Number), username: student, role: 'student' });
  const signedOut = await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', cookie).expect(204);
  expect(signedOut.headers['set-cookie'][0]).toMatch(/^nutgpuhub_session=;/);
  await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  await request(app).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', cookie).expect(204);
});

test('TC-AUTH-03 allows 59 minutes and rejects at 60 minutes without renewal', async () => {
  const minute = 60_000;
  const signedInAt = Date.now();
  let now = signedInAt;
  const timedApp = createApp(database, origin, { clock: () => now });
  const response = await login(student, password, timedApp).expect(200);
  const cookieHeader = response.headers['set-cookie'][0] as string;
  const cookie = cookieHeader.split(';', 1)[0];

  now = signedInAt + 59 * minute;
  await request(timedApp).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
  now = signedInAt + 60 * minute;
  await request(timedApp).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);

  expect(cookieHeader).toMatch(/; Max-Age=3600;/);
  const tokenHash = createHash('sha256').update(cookie.split('=', 2)[1]).digest('hex');
  const session = await database.session.findUniqueOrThrow({ where: { tokenHash } });
  expect(session.expiresAt.getTime()).toBe(signedInAt + 60 * minute);
});

test('TC-AUTH-04 stores and verifies Argon2id hashes for every prepared account', async () => {
  const rollback = new Error('Roll back demo-account verification');
  await expect(database.$transaction(async transaction => {
    const [username, role] = demoAccounts[0];
    const legacyAccount = await transaction.user.upsert({
      where: { username },
      create: { username, role, passwordHash: 'legacy-draft-hash' },
      update: { passwordHash: 'legacy-draft-hash' },
    });
    const previousSession = await transaction.session.create({ data: {
      userId: legacyAccount.id, tokenHash: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000),
    } });

    await seedDemoAccounts(transaction, password);
    expect(await transaction.session.findUnique({ where: { id: previousSession.id } })).toBeNull();
    const accounts = await transaction.user.findMany({
      where: { username: { in: demoAccounts.map(([username]) => username) } },
      select: { passwordHash: true },
    });
    expect(accounts).toHaveLength(demoAccounts.length);
    for (const { passwordHash } of accounts) {
      expect(passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(passwordHash === password).toBe(false);
      expect(await verifyPassword(password, passwordHash)).toBe(true);
    }
    expect(new Set(accounts.map(account => account.passwordHash)).size).toBe(accounts.length);
    throw rollback;
  })).rejects.toBe(rollback);
});

test('TC-VALID-01 rejects malformed sign-in requests without creating a session', async () => {
  const sessionsBefore = await database.session.count();
  for (const body of [{ username: student }, { username: 123, password }]) {
    const response = await request(app).post('/api/v1/auth/login').set('Origin', origin).send(body).expect(400);
    expect(response.body.error).toEqual({ code: 'INVALID_CREDENTIALS_INPUT', message: expect.any(String) });
    expect(response.headers['set-cookie']).toBeUndefined();
  }
  expect(await database.session.count()).toBe(sessionsBefore);
});

test('authentication changes reject a request from another origin', async () => {
  const cookie = await studentCookie();
  await request(app).post('/api/v1/auth/logout').set('Origin', 'https://other.example').set('Cookie', cookie).expect(403);
  await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
});
