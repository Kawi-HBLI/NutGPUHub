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
const names = {
  studentA: `view-a-${suffix}`,
  studentB: `view-b-${suffix}`,
  operatorA: `view-op-a-${suffix}`,
  operatorB: `view-op-b-${suffix}`,
};
type Name = keyof typeof names;
const ids = {} as Record<Name, number>;
const cookies = {} as Record<Name, string>;
let machineId = 0;
const machineCode = `VIEW-${suffix}`;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const key of Object.keys(names) as Name[]) {
    const role = key.startsWith('student') ? 'student' : 'operator';
    ids[key] = (await database.user.create({ data: { username: names[key], passwordHash, role } })).id;
    const response = await request(app).post('/api/v1/auth/login').set('Origin', origin)
      .send({ username: names[key], password }).expect(200);
    cookies[key] = (response.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0];
  }
  machineId = (await database.gpuMachine.create({ data: { code: machineCode, operatorId: ids.operatorA } })).id;
});

afterAll(async () => {
  try {
    await database.booking.deleteMany({ where: { studentId: { in: Object.values(ids) } } });
    await database.gpuMachine.deleteMany({ where: { id: machineId } });
    await database.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  } finally {
    await database.$disconnect();
  }
});

function openSlot(startAt: string) {
  return database.slot.create({ data: { machineId, startAt: new Date(startAt) } });
}

async function book(slotId: number, who: Name, application = app) {
  const response = await request(application).post('/api/v1/bookings').set('Origin', origin)
    .set('Cookie', cookies[who]).send({ slotId }).expect(201);
  return response.body.bookingId as number;
}

test('TC-ACCESS-02 limits booking lists and details to their owner and schedules to the assigned operator', async () => {
  const slotA = await openSlot('2032-01-01T10:00:00+07:00');
  const slotB = await openSlot('2032-01-01T11:00:00+07:00');
  const freeSlot = await openSlot('2032-01-01T12:00:00+07:00');
  const bookingA = await book(slotA.id, 'studentA');
  const bookingB = await book(slotB.id, 'studentB');

  // AC-18: the list contains only the signed-in student's bookings.
  const listA = await request(app).get('/api/v1/bookings').set('Cookie', cookies.studentA).expect(200);
  expect(listA.body).toEqual([{
    bookingId: bookingA, slotId: slotA.id, machineId, machineCode,
    startAt: '2032-01-01T03:00:00.000Z', endAt: '2032-01-01T04:00:00.000Z',
  }]);

  // AC-09: another student's booking is not disclosed.
  const otherDetail = await request(app).get(`/api/v1/bookings/${bookingB}`).set('Cookie', cookies.studentA).expect(404);
  expect(Object.keys(otherDetail.body)).toEqual(['error']);

  // AC-14: the assigned operator sees who booked each slot. Free slots have booking: null.
  const schedule = await request(app).get(`/api/v1/machines/${machineId}/slots?date=2032-01-01`)
    .set('Cookie', cookies.operatorA).expect(200);
  expect(schedule.body).toEqual([
    expect.objectContaining({ slotId: slotA.id, booking: { bookingId: bookingA, studentUsername: names.studentA } }),
    expect.objectContaining({ slotId: slotB.id, booking: { bookingId: bookingB, studentUsername: names.studentB } }),
    expect.objectContaining({ slotId: freeSlot.id, booking: null }),
  ]);

  // AC-10: an operator who is not assigned to the machine gets no schedule data.
  const unassigned = await request(app).get(`/api/v1/machines/${machineId}/slots?date=2032-01-01`)
    .set('Cookie', cookies.operatorB).expect(403);
  expect(Object.keys(unassigned.body)).toEqual(['error']);
});

test('My Bookings returns an empty list for a student without bookings', async () => {
  const name = `view-empty-${suffix}`;
  const user = await database.user.create({ data: { username: name, passwordHash: await hashPassword(password), role: 'student' } });
  ids[name as Name] = user.id;
  const login = await request(app).post('/api/v1/auth/login').set('Origin', origin).send({ username: name, password }).expect(200);
  const cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0];
  const response = await request(app).get('/api/v1/bookings').set('Cookie', cookie).expect(200);
  expect(response.body).toEqual([]);
});

test('TC-PERSIST-01 a booking is still retrievable after the application restarts on the same database', async () => {
  const slot = await openSlot('2032-01-02T10:00:00+07:00');
  const bookingId = await book(slot.id, 'studentA');

  // Restart: a new Prisma connection and a new app instance. Only the database carries state across.
  const restartedDatabase = new PrismaClient({ datasourceUrl: url });
  try {
    const restarted = createApp(restartedDatabase, origin, { clock: () => now });
    const detail = await request(restarted).get(`/api/v1/bookings/${bookingId}`).set('Cookie', cookies.studentA).expect(200);
    expect(detail.body).toMatchObject({ bookingId, slotId: slot.id, machineId, machineCode, startAt: '2032-01-02T03:00:00.000Z' });
    const list = await request(restarted).get('/api/v1/bookings').set('Cookie', cookies.studentA).expect(200);
    expect(list.body.map((row: { bookingId: number }) => row.bookingId)).toContain(bookingId);
    const stored = await restartedDatabase.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(stored).toMatchObject({ studentId: ids.studentA, slotId: slot.id });
  } finally {
    await restartedDatabase.$disconnect();
  }
});

test('an anonymous request to an unknown path under /machines returns 404, not 401', async () => {
  const response = await request(app).get('/api/v1/machines/1/nope').expect(404);
  expect(response.body.error.code).toBe('NOT_FOUND');
});

test('TC-ACCESS-03 protects the booking list from anonymous and operator requests', async () => {
  await request(app).get('/api/v1/bookings').expect(401);
  const asOperator = await request(app).get('/api/v1/bookings').set('Cookie', cookies.operatorA).expect(403);
  expect(Object.keys(asOperator.body)).toEqual(['error']);
});
