import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/password.js';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || testUrl === process.env.DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a separate, migrated PostgreSQL database.');
}

const database = new PrismaClient({ datasourceUrl: testUrl });
const origin = 'http://localhost:5173';
// 2030-01-01 14:00 in Bangkok. Every slot below is relative to this fixed server time.
const now = Date.parse('2030-01-01T14:00:00+07:00');
const app = createApp(database, origin, { clock: () => now });
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(18).toString('hex');
const names = {
  student: `student-${suffix}`,
  operatorA: `operator-a-${suffix}`,
  operatorB: `operator-b-${suffix}`,
};
const machineCode = `GPU-T${suffix}`;
const otherMachineCode = `GPU-U${suffix}`;
let machineId = 0;
const cookies: Record<keyof typeof names, string> = { student: '', operatorA: '', operatorB: '' };

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  await database.user.createMany({ data: [
    { username: names.student, passwordHash, role: 'student' },
    { username: names.operatorA, passwordHash, role: 'operator' },
    { username: names.operatorB, passwordHash, role: 'operator' },
  ] });
  const operatorA = await database.user.findUniqueOrThrow({ where: { username: names.operatorA } });
  const operatorB = await database.user.findUniqueOrThrow({ where: { username: names.operatorB } });
  machineId = (await database.gpuMachine.create({ data: { code: machineCode, operatorId: operatorA.id } })).id;
  await database.gpuMachine.create({ data: { code: otherMachineCode, operatorId: operatorB.id } });

  for (const key of Object.keys(names) as (keyof typeof names)[]) {
    const response = await request(app).post('/api/v1/auth/login').set('Origin', origin)
      .send({ username: names[key], password }).expect(200);
    cookies[key] = (response.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0];
  }
});

afterAll(async () => {
  try {
    await database.gpuMachine.deleteMany({ where: { code: { in: [machineCode, otherMachineCode] } } });
    await database.user.deleteMany({ where: { username: { in: Object.values(names) } } });
  } finally {
    await database.$disconnect();
  }
});

function openSlot(cookie: string, startAt: unknown, id: number | string = machineId) {
  return request(app).post(`/api/v1/machines/${id}/slots`).set('Origin', origin).set('Cookie', cookie).send({ startAt });
}

function schedule(cookie: string, date: string | undefined, id: number | string = machineId) {
  const query = date === undefined ? '' : `?date=${date}`;
  return request(app).get(`/api/v1/machines/${id}/slots${query}`).set('Cookie', cookie);
}

function slotCount(startDate: string, endDate: string) {
  return database.slot.count({
    where: { machineId, startAt: { gte: new Date(startDate), lt: new Date(endDate) } },
  });
}

test('TC-SLOT-01 opens consecutive hourly slots and rejects duplicate and off-hour starts', async () => {
  const machines = await request(app).get('/api/v1/machines').set('Cookie', cookies.operatorA).expect(200);
  expect(machines.body).toEqual([{ machineId, machineCode }]);

  const first = await openSlot(cookies.operatorA, '2030-01-02T14:00:00+07:00').expect(201);
  const second = await openSlot(cookies.operatorA, '2030-01-02T15:00:00+07:00').expect(201);
  expect(first.body).toEqual({
    slotId: expect.any(Number), machineId,
    startAt: '2030-01-02T07:00:00.000Z', endAt: '2030-01-02T08:00:00.000Z',
  });
  expect(second.body.endAt).toBe('2030-01-02T09:00:00.000Z');

  const duplicate = await openSlot(cookies.operatorA, '2030-01-02T14:00:00+07:00').expect(409);
  expect(duplicate.body.error.code).toBe('SLOT_ALREADY_EXISTS');
  const offHour = await openSlot(cookies.operatorA, '2030-01-02T14:30:00+07:00').expect(400);
  expect(offHour.body.error.code).toBe('START_NOT_ON_HOUR');

  const day = await schedule(cookies.operatorA, '2030-01-02').expect(200);
  expect(day.body.map((slot: { startAt: string }) => slot.startAt))
    .toEqual(['2030-01-02T07:00:00.000Z', '2030-01-02T08:00:00.000Z']);
  expect(await slotCount('2030-01-02T00:00:00+07:00', '2030-01-03T00:00:00+07:00')).toBe(2);
});

test('TC-SLOT-03 rejects starts at or before server time and accepts the next hour', async () => {
  const past = await openSlot(cookies.operatorA, '2030-01-01T13:00:00+07:00').expect(400);
  const current = await openSlot(cookies.operatorA, '2030-01-01T14:00:00+07:00').expect(400);
  expect(past.body.error.code).toBe('START_NOT_IN_FUTURE');
  expect(current.body.error.code).toBe('START_NOT_IN_FUTURE');
  await openSlot(cookies.operatorA, '2030-01-01T15:00:00+07:00').expect(201);
  expect(await slotCount('2030-01-01T13:00:00+07:00', '2030-01-01T15:00:00+07:00')).toBe(0);
});

test('TC-ACCESS-01 rejects slot creation by a student and an unassigned operator', async () => {
  const before = await slotCount('2030-01-03T00:00:00+07:00', '2030-01-04T00:00:00+07:00');
  const asStudent = await openSlot(cookies.student, '2030-01-03T10:00:00+07:00').expect(403);
  const asOtherOperator = await openSlot(cookies.operatorB, '2030-01-03T11:00:00+07:00').expect(403);
  const otherSchedule = await schedule(cookies.operatorB, '2030-01-02').expect(403);
  for (const response of [asStudent, asOtherOperator, otherSchedule]) {
    expect(Object.keys(response.body)).toEqual(['error']);
  }
  expect(await slotCount('2030-01-03T00:00:00+07:00', '2030-01-04T00:00:00+07:00')).toBe(before);

  const otherMachines = await request(app).get('/api/v1/machines').set('Cookie', cookies.operatorB).expect(200);
  expect(otherMachines.body.map((machine: { machineCode: string }) => machine.machineCode)).not.toContain(machineCode);
});

test('TC-ACCESS-03 rejects F-02 routes without a session or with the student role', async () => {
  await request(app).get('/api/v1/machines').expect(401);
  await schedule('', '2030-01-02').expect(401);
  await openSlot('', '2030-01-04T10:00:00+07:00').expect(401);
  await request(app).get('/api/v1/machines').set('Cookie', cookies.student).expect(403);
  await schedule(cookies.student, '2030-01-02').expect(403);
});

test('TC-VALID-01 rejects invalid dates, malformed starts and unknown machines', async () => {
  for (const date of [undefined, '2030-13-40', '2030-1-2']) {
    const response = await schedule(cookies.operatorA, date).expect(400);
    expect(response.body.error).toEqual({ code: 'INVALID_DATE', message: expect.any(String) });
  }
  for (const startAt of [undefined, '2030-01-05 10:00', '2030-01-05T10:00:00', 42]) {
    const response = await openSlot(cookies.operatorA, startAt).expect(400);
    expect(response.body.error.code).toBe('INVALID_START_AT');
  }
  // Impossible dates must be rejected, not rolled over to a later valid day (2030-02-30 would become 2030-03-02).
  for (const startAt of ['2030-02-30T14:00:00+07:00', '2030-01-05T24:00:00+07:00']) {
    const response = await openSlot(cookies.operatorA, startAt).expect(400);
    expect(response.body.error.code).toBe('INVALID_START_AT');
  }
  expect(await slotCount('2030-03-02T00:00:00+07:00', '2030-03-03T00:00:00+07:00')).toBe(0);
  expect(await slotCount('2030-01-06T00:00:00+07:00', '2030-01-07T00:00:00+07:00')).toBe(0);
  for (const id of [999_999_999, 'abc']) {
    const unknownSchedule = await schedule(cookies.operatorA, '2030-01-02', id).expect(404);
    const unknownCreate = await openSlot(cookies.operatorA, '2030-01-05T10:00:00+07:00', id).expect(404);
    expect(unknownSchedule.body.error.code).toBe('MACHINE_NOT_FOUND');
    expect(unknownCreate.body.error.code).toBe('MACHINE_NOT_FOUND');
  }
  expect(await slotCount('2030-01-05T00:00:00+07:00', '2030-01-06T00:00:00+07:00')).toBe(0);
});

test('the schedule for a date without slots is an empty list', async () => {
  const response = await schedule(cookies.operatorA, '2030-02-01').expect(200);
  expect(response.body).toEqual([]);
});
