// F-05 cancel a booking (#12). Sprint 2 contract 0.3, AC-24 to AC-28, plus the shared data
// checks TC-DB-01 and TC-DB-02. TC-PERSIST-02 (AC-29) runs in scripts/process-restart-check.ts.
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
// Tests in one file run in order. A test that moves the clock signs in again at the new time
// (sessions last one hour from sign-in) and restores `now` before it ends.
let current = now;
const app = createApp(database, origin, { clock: () => current });
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(18).toString('hex');
// 0 = student A, 1 = student B, 2 = operator assigned to both machines.
const names = ['a', 'b', 'operator'].map(name => `${name}-cancel-${suffix}`);
const users: number[] = [];
const machines: number[] = [];
const cookies: string[] = [];

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [index, username] of names.entries()) {
    users.push((await database.user.create({ data: { username, passwordHash, role: index === 2 ? 'operator' : 'student' } })).id);
    cookies.push(await signIn(index));
  }
  for (const label of ['A', 'B']) {
    machines.push((await database.gpuMachine.create({ data: { code: `CANCEL-${label}-${suffix}`, operatorId: users[2] } })).id);
  }
});

afterAll(async () => {
  try {
    await database.booking.deleteMany({ where: { studentId: { in: users } } });
    await database.gpuMachine.deleteMany({ where: { id: { in: machines } } });
    await database.user.deleteMany({ where: { id: { in: users } } });
  } finally { await database.$disconnect(); }
});

async function signIn(account: number) {
  const response = await request(app).post('/api/v1/auth/login').set('Origin', origin)
    .send({ username: names[account], password }).expect(200);
  return (response.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0];
}
function slot(startAt: string, machine = machines[0]) {
  return database.slot.create({ data: { machineId: machine, startAt: new Date(startAt) } });
}
async function book(slotId: number, cookie = cookies[0]) {
  const response = await request(app).post('/api/v1/bookings').set('Origin', origin).set('Cookie', cookie)
    .send({ slotId }).expect(201);
  return response.body.bookingId as number;
}
function cancel(bookingId: number, cookie = cookies[0]) {
  const call = request(app).post(`/api/v1/bookings/${bookingId}/cancel`).set('Origin', origin);
  return cookie ? call.set('Cookie', cookie) : call;
}
function readBooking(bookingId: number) {
  return database.$queryRaw<{ status: string; cancelled_at: Date | null }[]>`
    SELECT status, cancelled_at FROM bookings WHERE id = ${bookingId}`.then(rows => rows[0]);
}

test('TC-CANCEL-01 the owner cancels an upcoming booking and it stays in the history (AC-24)', async () => {
  const target = await slot('2031-02-01T14:00:00+07:00');
  const bookingId = await book(target.id);

  const result = await cancel(bookingId).expect(200);
  expect(result.body).toMatchObject({
    bookingId, slotId: target.id, machineId: machines[0], status: 'cancelled',
    cancelledAt: new Date(now).toISOString(),
  });

  const detail = await request(app).get(`/api/v1/bookings/${bookingId}`).set('Cookie', cookies[0]).expect(200);
  expect(detail.body).toMatchObject({ bookingId, status: 'cancelled', cancelledAt: new Date(now).toISOString() });
  const list = await request(app).get('/api/v1/bookings').set('Cookie', cookies[0]).expect(200);
  expect(list.body).toContainEqual(expect.objectContaining({ bookingId, status: 'cancelled' }));
  expect(await readBooking(bookingId)).toEqual({ status: 'cancelled', cancelled_at: new Date(now) });
});

test('TC-CANCEL-02 another student, an operator and an anonymous request cannot cancel (AC-25)', async () => {
  const target = await slot('2031-02-02T14:00:00+07:00');
  const bookingId = await book(target.id);

  const other = await cancel(bookingId, cookies[1]).expect(404);
  expect(other.body).toEqual({ error: { code: 'BOOKING_NOT_FOUND', message: expect.any(String) } });
  expect((await cancel(bookingId, cookies[2]).expect(403)).body.error.code).toBe('FORBIDDEN');
  expect((await cancel(bookingId, '').expect(401)).body.error.code).toBe('AUTH_REQUIRED');
  await cancel(2_147_483_647).expect(404);
  await cancel(0).expect(404);
  expect(await readBooking(bookingId)).toEqual({ status: 'confirmed', cancelled_at: null });
});

test('TC-CANCEL-03 a booking can be cancelled until its start, with no 30-minute cutoff (AC-26)', async () => {
  // Four 14:00 slots on separate dates, each booked at 13:00 on its date, then cancelled at one time.
  const cases = [
    { date: '2031-03-01', at: '14:00:00.000', status: 409 },
    { date: '2031-03-02', at: '14:05:00.000', status: 409 },
    { date: '2031-03-03', at: '13:59:59.999', status: 200 },
    { date: '2031-03-04', at: '13:45:00.000', status: 200 },
  ];
  try {
    for (const { date, at, status } of cases) {
      const target = await slot(`${date}T14:00:00+07:00`);
      current = Date.parse(`${date}T13:00:00+07:00`);
      const bookingId = await book(target.id, await signIn(0));
      current = Date.parse(`${date}T${at}+07:00`);
      const result = await cancel(bookingId, await signIn(0)).expect(status);
      if (status === 409) {
        expect(result.body.error.code).toBe('BOOKING_ALREADY_STARTED');
        expect(await readBooking(bookingId)).toEqual({ status: 'confirmed', cancelled_at: null });
      } else {
        expect(await readBooking(bookingId)).toEqual({ status: 'cancelled', cancelled_at: new Date(current) });
      }
    }
  } finally { current = now; }
});

test('TC-CANCEL-04 a cancelled slot and hour can be booked again, and the schedule frees the slot (AC-27)', async () => {
  const first = await slot('2031-04-01T14:00:00+07:00', machines[0]);
  const second = await slot('2031-04-01T14:00:00+07:00', machines[1]);
  const bookingId = await book(first.id, cookies[0]);
  await cancel(bookingId).expect(200);

  const schedule = () => request(app).get(`/api/v1/machines/${machines[0]}/slots?date=2031-04-01`)
    .set('Cookie', cookies[2]).expect(200).then(result => result.body.find((row: { slotId: number }) => row.slotId === first.id));
  expect((await schedule()).booking).toBeNull();

  const rebooked = await book(first.id, cookies[1]);
  await book(second.id, cookies[0]);
  expect((await schedule()).booking).toEqual({ bookingId: rebooked, studentUsername: names[1] });
});

test('TC-CANCEL-05 a second cancel is rejected, sequential or concurrent (AC-28)', async () => {
  const sequential = await book((await slot('2031-05-01T14:00:00+07:00')).id);
  await cancel(sequential).expect(200);
  const before = await readBooking(sequential);
  current = now + 60_000;
  try {
    const again = await cancel(sequential).expect(409);
    expect(again.body.error.code).toBe('BOOKING_NOT_CONFIRMED');
  } finally { current = now; }
  expect(await readBooking(sequential)).toEqual(before);

  const concurrent = await book((await slot('2031-05-02T14:00:00+07:00')).id);
  const results = await Promise.all([cancel(concurrent), cancel(concurrent)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(results.find(result => result.status === 409)!.body.error.code).toBe('BOOKING_NOT_CONFIRMED');
});

test('TC-DB-01 partial unique indexes allow history but keep one confirmed booking per slot and hour', async () => {
  // Sprint 1 rows became confirmed; nothing in the database violates the new check constraint.
  const invalid = await database.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM bookings
    WHERE status NOT IN ('confirmed', 'cancelled', 'rescheduled')
       OR (status = 'cancelled') <> (cancelled_at IS NOT NULL)`;
  expect(invalid[0].count).toBe(0n);

  const first = await slot('2031-06-01T14:00:00+07:00', machines[0]);
  const second = await slot('2031-06-01T14:00:00+07:00', machines[1]);
  const insert = (slotId: number, studentId: number, status: string, cancelledAt: Date | null) => database.$executeRaw`
    INSERT INTO bookings (slot_id, student_id, slot_start_at, status, cancelled_at)
    VALUES (${slotId}, ${studentId}, ${first.startAt}, ${status}, ${cancelledAt})`;

  await insert(first.id, users[0], 'cancelled', new Date(now));
  await insert(first.id, users[1], 'confirmed', null);
  await expect(insert(first.id, users[0], 'confirmed', null)).rejects.toThrow(/bookings_confirmed_slot_key/);
  await expect(insert(second.id, users[1], 'confirmed', null)).rejects.toThrow(/bookings_confirmed_student_hour_key/);
  await expect(insert(second.id, users[0], 'cancelled', null)).rejects.toThrow(/check/i);
  await expect(insert(second.id, users[0], 'unknown', null)).rejects.toThrow(/check/i);
});

test('TC-DB-02 conflicts after a cancellation still map to the right error codes', async () => {
  const first = await slot('2031-07-01T14:00:00+07:00', machines[0]);
  const second = await slot('2031-07-01T14:00:00+07:00', machines[1]);
  await cancel(await book(first.id, cookies[0])).expect(200);
  await book(first.id, cookies[1]);

  const taken = await request(app).post('/api/v1/bookings').set('Origin', origin).set('Cookie', cookies[0])
    .send({ slotId: first.id }).expect(409);
  expect(taken.body.error.code).toBe('SLOT_ALREADY_BOOKED');
  const sameHour = await request(app).post('/api/v1/bookings').set('Origin', origin).set('Cookie', cookies[1])
    .send({ slotId: second.id }).expect(409);
  expect(sameHour.body.error.code).toBe('STUDENT_TIME_CONFLICT');
});
