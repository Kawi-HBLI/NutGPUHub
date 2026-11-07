import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/password.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL) throw new Error('Use a separate migrated TEST_DATABASE_URL.');
const database = new PrismaClient({ datasourceUrl: url });
const origin = 'http://localhost:5173';
const now = Date.parse('2030-01-01T14:00:00+07:00');
const app = createApp(database, origin, { clock: () => now });
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(18).toString('hex');
const names = ['a', 'b', 'operator'].map(name => `${name}-booking-${suffix}`);
const users: number[] = [];
const machines: number[] = [];
const cookies: string[] = [];

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [index, username] of names.entries()) {
    users.push((await database.user.create({ data: { username, passwordHash, role: index === 2 ? 'operator' : 'student' } })).id);
    const response = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ username, password }).expect(200);
    cookies.push(response.headers['set-cookie'][0].split(';', 1)[0]);
  }
  for (const label of ['A', 'B']) {
    machines.push((await database.gpuMachine.create({ data: { code: `BOOK-${label}-${suffix}`, operatorId: users[2] } })).id);
  }
});

afterAll(async () => {
  try {
    await database.booking.deleteMany({ where: { studentId: { in: users } } });
    await database.gpuMachine.deleteMany({ where: { id: { in: machines } } });
    await database.user.deleteMany({ where: { id: { in: users } } });
  } finally { await database.$disconnect(); }
});

function slot(date: string, machine = machines[0]) {
  return database.slot.create({ data: { machineId: machine, startAt: new Date(date) } });
}
function book(slotId: unknown, cookie = cookies[0]) {
  return request(app).post('/api/v1/bookings').set('Origin', origin).set('Cookie', cookie).send({ slotId });
}

test('TC-BOOK-01 saves a booking and AC-09 protects its detail', async () => {
  const available = await slot('2031-01-01T14:00:00+07:00');
  const result = await book(available.id).expect(201);
  const detail = await request(app).get(result.headers.location).set('Cookie', cookies[0]).expect(200);
  expect(detail.body).toMatchObject({ bookingId: result.body.bookingId, slotId: available.id, machineId: machines[0] });
  await request(app).get(result.headers.location).set('Cookie', cookies[1]).expect(404);
  expect(await database.booking.count({ where: { slotId: available.id, studentId: users[0] } })).toBe(1);
});

test('TC-BOOK-02 competing students create one booking for one slot', async () => {
  const available = await slot('2031-01-02T14:00:00+07:00');
  const results = await Promise.all([book(available.id, cookies[0]), book(available.id, cookies[1])]);
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
  expect(results.find(result => result.status === 409)?.body.error.code).toBe('SLOT_ALREADY_BOOKED');
  const rows = await database.booking.findMany({ where: { slotId: available.id } });
  expect(rows).toHaveLength(1);
  expect(rows[0].studentId).toBe(users[results.findIndex(result => result.status === 201)]);
});

test('TC-BOOK-04 rejects sequential bookings across machines at the same hour', async () => {
  const first = await slot('2031-01-03T14:00:00+07:00');
  const second = await slot('2031-01-03T14:00:00+07:00', machines[1]);
  await book(first.id).expect(201);
  const conflict = await book(second.id).expect(409);
  expect(conflict.body.error.code).toBe('STUDENT_TIME_CONFLICT');
  expect(await database.booking.count({ where: { studentId: users[0], slotStartAt: first.startAt } })).toBe(1);
  await book((await slot('2031-01-03T15:00:00+07:00', machines[1])).id).expect(201);
});

test('TC-BOOK-04 concurrent requests for different machines reserve one hour once', async () => {
  const first = await slot('2031-01-04T14:00:00+07:00');
  const second = await slot('2031-01-04T14:00:00+07:00', machines[1]);
  const results = await Promise.all([book(first.id), book(second.id)]);
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
  expect(results.find(result => result.status === 409)?.body.error.code).toBe('STUDENT_TIME_CONFLICT');
  expect(await database.booking.count({ where: { studentId: users[0], slotStartAt: first.startAt } })).toBe(1);
});

test('TC-BOOK-03 rejects invalid, unknown and started slots without saving', async () => {
  for (const invalid of [undefined, 0, -1, 1.5, '1', 2_147_483_648]) await book(invalid).expect(400);
  await book(2_147_483_647).expect(404);
  const started = await slot('2030-01-01T14:00:00+07:00');
  const result = await book(started.id).expect(409);
  expect(result.body.error.code).toBe('SLOT_ALREADY_STARTED');
  expect(await database.booking.count({ where: { slotId: started.id } })).toBe(0);
});

test('TC-SLOT-02 filters availability by Bangkok date and excludes booked and started slots', async () => {
  const free = await slot('2031-01-05T00:00:00+07:00');
  const occupied = await slot('2031-01-05T23:00:00+07:00');
  await book(occupied.id).expect(201);
  await slot('2031-01-06T00:00:00+07:00');
  const result = await request(app).get('/api/v1/slots?date=2031-01-05').set('Cookie', cookies[0]).expect(200);
  expect(result.body.map((row: {slotId: number}) => row.slotId)).toEqual([free.id]);
  expect(result.body[0].machineCode).toBe(`BOOK-A-${suffix}`);
  await request(app).get('/api/v1/slots?date=2031-02-30').set('Cookie', cookies[0]).expect(400);
  await request(app).get('/api/v1/slots').set('Cookie', cookies[0]).expect(400);
});

test('TC-ACCESS-03 protects all student routes from anonymous and operator requests', async () => {
  for (const path of ['/api/v1/slots?date=2031-01-05', '/api/v1/bookings/1']) {
    await request(app).get(path).expect(401);
    await request(app).get(path).set('Cookie', cookies[2]).expect(403);
  }
  const available = await slot('2031-01-07T14:00:00+07:00');
  await book(available.id, '').expect(401);
  expect(await database.booking.count({ where: { slotId: available.id } })).toBe(0);
  await book(available.id, cookies[2]).expect(403);
  expect(await database.booking.count({ where: { slotId: available.id } })).toBe(0);
});

test.each([
  ['anonymous', '/api/v1/nope', -1],
  ['operator', '/api/v1/nope', 2],
  ['student', '/api/v1/nope', 0],
  ['operator', '/api/v1/machines/1/nope', 2],
] as const)('unknown API path returns 404 for %s: %s', async (_role, path, account) => {
  const response = request(app).get(path);
  if (account >= 0) response.set('Cookie', cookies[account]);
  const result = await response.expect(404);
  expect(result.body.error.code).toBe('NOT_FOUND');
});
