// TC-X-01 (Sprint 2 test specification, regression set): one slot goes through booking (F-03),
// cancellation (F-05), a second student's booking and move away (F-06), then closure (F-07).
// After each step the state is read back through availability, My Bookings and the schedule.
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
const app = createApp(database, origin, { clock: () => Date.parse('2030-01-01T14:00:00+07:00') });
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(18).toString('hex');
// 0 = student A, 1 = student B, 2 = operator A (assigned to the machine).
const names = ['a', 'b', 'operator-a'].map(name => `${name}-cross-${suffix}`);
const A = 0;
const B = 1;
const OPERATOR = 2;
const users: number[] = [];
const cookies: string[] = [];
let machineId = 0;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [index, username] of names.entries()) {
    users.push((await database.user.create({ data: { username, passwordHash, role: index < 2 ? 'student' : 'operator' } })).id);
    const response = await request(app).post('/api/v1/auth/login').set('Origin', origin)
      .send({ username, password }).expect(200);
    cookies.push((response.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0]);
  }
  machineId = (await database.gpuMachine.create({ data: { code: `CROSS-${suffix}`, operatorId: users[OPERATOR] } })).id;
});

afterAll(async () => {
  try {
    await database.booking.deleteMany({ where: { studentId: { in: users } } });
    await database.gpuMachine.deleteMany({ where: { id: machineId } });
    await database.user.deleteMany({ where: { id: { in: users } } });
  } finally { await database.$disconnect(); }
});

const date = '2031-09-01';

function post(path: string, who: number, body?: object) {
  return request(app).post(path).set('Origin', origin).set('Cookie', cookies[who]).send(body);
}
function get(path: string, who: number) {
  return request(app).get(path).set('Cookie', cookies[who]).expect(200).then(response => response.body);
}
/** Slot IDs a student can book on the date, on this test's machine only. */
async function available() {
  const slots: { slotId: number; machineId: number }[] = await get(`/api/v1/slots?date=${date}`, A);
  return slots.filter(slot => slot.machineId === machineId).map(slot => slot.slotId);
}
/** The student's bookings as [slotId, status] pairs, in list order. */
async function myBookings(who: number) {
  const bookings: { slotId: number; status: string }[] = await get('/api/v1/bookings', who);
  return bookings.map(booking => [booking.slotId, booking.status]);
}
/** The operator's schedule as slotId -> who holds it and whether it is closed. */
async function schedule() {
  const rows: { slotId: number; closedAt: string | null; booking: { studentUsername: string } | null }[] =
    await get(`/api/v1/machines/${machineId}/slots?date=${date}`, OPERATOR);
  return Object.fromEntries(rows.map(row => [row.slotId, { holder: row.booking?.studentUsername ?? null, closed: row.closedAt !== null }]));
}

test('TC-X-01 book, cancel, rebook, move away and close one slot; every view agrees after each step', async () => {
  const x = (await database.slot.create({ data: { machineId, startAt: new Date(`${date}T14:00:00+07:00`) } })).id;
  const y = (await database.slot.create({ data: { machineId, startAt: new Date(`${date}T16:00:00+07:00`) } })).id;
  expect(await available()).toEqual([x, y]);

  // 1. A books X (F-03).
  const first = (await post('/api/v1/bookings', A, { slotId: x }).expect(201)).body.bookingId as number;
  expect(await available()).toEqual([y]);
  expect(await myBookings(A)).toEqual([[x, 'confirmed']]);
  expect(await schedule()).toEqual({ [x]: { holder: names[A], closed: false }, [y]: { holder: null, closed: false } });

  // 2. A cancels (F-05): X is free again, A keeps the cancelled row as history.
  await post(`/api/v1/bookings/${first}/cancel`, A).expect(200);
  expect(await available()).toEqual([x, y]);
  expect(await myBookings(A)).toEqual([[x, 'cancelled']]);
  expect(await schedule()).toEqual({ [x]: { holder: null, closed: false }, [y]: { holder: null, closed: false } });

  // 3. B books the released X.
  const second = (await post('/api/v1/bookings', B, { slotId: x }).expect(201)).body.bookingId as number;
  expect(await available()).toEqual([y]);
  expect(await myBookings(B)).toEqual([[x, 'confirmed']]);
  expect(await schedule()).toEqual({ [x]: { holder: names[B], closed: false }, [y]: { holder: null, closed: false } });

  // 4. B moves to Y (F-06): X is free, Y is held, B's original is rescheduled.
  await post(`/api/v1/bookings/${second}/reschedule`, B, { slotId: y }).expect(201);
  expect(await available()).toEqual([x]);
  expect(await myBookings(B)).toEqual([[x, 'rescheduled'], [y, 'confirmed']]);
  expect(await schedule()).toEqual({ [x]: { holder: null, closed: false }, [y]: { holder: names[B], closed: false } });

  // 5. Operator A closes the freed X (F-07): nobody can book it, Y and the history are untouched.
  await post(`/api/v1/machines/${machineId}/slots/${x}/close`, OPERATOR).expect(200);
  expect(await available()).toEqual([]);
  expect(await schedule()).toEqual({ [x]: { holder: null, closed: true }, [y]: { holder: names[B], closed: false } });
  expect(await myBookings(A)).toEqual([[x, 'cancelled']]);
  expect(await myBookings(B)).toEqual([[x, 'rescheduled'], [y, 'confirmed']]);
  expect((await post('/api/v1/bookings', A, { slotId: x }).expect(409)).body.error.code).toBe('SLOT_CLOSED');
});
