// TC-SLOT-02 empty-day case (AC-11). The shared test database can hold other fixtures' slots on
// any date, so this check runs against its own PostgreSQL schema, migrated for this run and
// dropped afterwards. Nothing else writes there, so "no slots on this day" is guaranteed.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/password.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL) throw new Error('Use a separate migrated TEST_DATABASE_URL.');
const schema = `qa_empty_day_${randomUUID().replaceAll('-', '')}`;
const isolatedUrl = new URL(url);
isolatedUrl.searchParams.set('schema', schema);
const shared = new PrismaClient({ datasourceUrl: url });
const database = new PrismaClient({ datasourceUrl: isolatedUrl.toString() });
const origin = 'http://localhost:5173';
const now = Date.parse('2030-01-01T14:00:00+07:00');
const app = createApp(database, origin, { clock: () => now });
const emptyDay = '2031-01-08';
let cookie = '';

beforeAll(async () => {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: isolatedUrl.toString() }, stdio: 'pipe',
  });
  const password = randomBytes(18).toString('hex');
  const passwordHash = await hashPassword(password);
  await database.user.create({ data: { username: 'empty-day-student', passwordHash, role: 'student' } });
  const login = await request(app).post('/api/v1/auth/login').set('Origin', origin)
    .send({ username: 'empty-day-student', password }).expect(200);
  cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0];
}, 120_000);

afterAll(async () => {
  try {
    await database.$disconnect();
    await shared.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await shared.$disconnect();
  }
});

test('TC-SLOT-02 returns 200 with an empty list for a valid day without slots', async () => {
  expect(await database.slot.count()).toBe(0);
  const result = await request(app).get(`/api/v1/slots?date=${emptyDay}`).set('Cookie', cookie).expect(200);
  expect(result.body).toEqual([]);

  // Control: the same request lists a slot once one exists, so the empty result is not a broken query.
  const operator = await database.user.create({ data: { username: 'empty-day-operator', passwordHash: 'unused', role: 'operator' } });
  const machine = await database.gpuMachine.create({ data: { code: 'EMPTY-DAY', operatorId: operator.id } });
  const added = await database.slot.create({ data: { machineId: machine.id, startAt: new Date(`${emptyDay}T10:00:00+07:00`) } });
  const control = await request(app).get(`/api/v1/slots?date=${emptyDay}`).set('Cookie', cookie).expect(200);
  expect(control.body.map((row: { slotId: number }) => row.slotId)).toEqual([added.id]);
});
