// Lab 5 cloud-readiness checks: liveness/readiness endpoints used by the smoke test,
// and a seed that can rerun on every release without signing demo users out.
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, expect, test } from 'vitest';
import { demoAccounts, seedDemoAccounts } from '../prisma/demo-accounts.js';
import { createApp } from '../server/app.js';
import { verifyPassword } from '../server/password.js';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || testUrl === process.env.DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a separate, migrated PostgreSQL database.');
}

const database = new PrismaClient({ datasourceUrl: testUrl });
const origin = 'http://localhost:5173';
const app = createApp(database, origin);

afterAll(async () => {
  await database.$disconnect();
});

test('TC-OPS-01 /api/health answers without the database', async () => {
  const unreachable = { $queryRaw: () => Promise.reject(new Error('down')) } as unknown as PrismaClient;
  const response = await request(createApp(unreachable, origin)).get('/api/health').expect(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(response.headers['cache-control']).toBe('no-store');
});

test('TC-OPS-02 /api/ready reports a connected database', async () => {
  const response = await request(app).get('/api/ready').expect(200);
  expect(response.body).toEqual({ status: 'ready', db: 'connected' });
  expect(response.headers['cache-control']).toBe('no-store');
});

test('TC-OPS-03 /api/ready returns 503 when the database cannot be reached', async () => {
  const unreachable = { $queryRaw: () => Promise.reject(new Error('down')) } as unknown as PrismaClient;
  const response = await request(createApp(unreachable, origin)).get('/api/ready').expect(503);
  expect(response.body).toEqual({ status: 'not_ready', db: 'unavailable' });
});

test('TC-OPS-04 rerunning the seed with the same password keeps hashes and sessions', async () => {
  const rollback = new Error('Roll back seed rerun check');
  const password = randomBytes(18).toString('hex');
  await expect(database.$transaction(async transaction => {
    await seedDemoAccounts(transaction, password);
    const usernames = demoAccounts.map(([username]) => username);
    const before = await transaction.user.findMany({ where: { username: { in: usernames } }, orderBy: { username: 'asc' } });
    const session = await transaction.session.create({ data: {
      userId: before[0].id, tokenHash: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 3_600_000),
    } });

    expect(await seedDemoAccounts(transaction, password)).toBe(demoAccounts.length);
    const after = await transaction.user.findMany({ where: { username: { in: usernames } }, orderBy: { username: 'asc' } });
    expect(after.map(account => account.passwordHash)).toEqual(before.map(account => account.passwordHash));
    expect(await transaction.session.findUnique({ where: { id: session.id } })).not.toBeNull();

    // A changed password still replaces the hash and ends that account's sessions.
    const changed = randomBytes(18).toString('hex');
    await seedDemoAccounts(transaction, changed);
    expect(await transaction.session.findUnique({ where: { id: session.id } })).toBeNull();
    const updated = await transaction.user.findUniqueOrThrow({ where: { id: before[0].id } });
    expect(await verifyPassword(changed, updated.passwordHash)).toBe(true);
    throw rollback;
  }, { timeout: 30_000 })).rejects.toBe(rollback);
});
