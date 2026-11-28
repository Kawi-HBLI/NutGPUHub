// F-06 reschedule a booking (#13). Sprint 2 contract 0.3, AC-30 to AC-36, AC-42, AC-43
// (TC-MOVE-01 to 09). TC-CLOSE-06 (AC-44) is in close-slot.test.ts; TC-PERSIST-02 is in
// scripts/process-restart-check.ts.
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
// 0 = student A, 1 = student B, 2 = operator A (machine 0, "GPU-01"), 3 = operator B (machine 1, "GPU-02").
const names = ['a', 'b', 'operator-a', 'operator-b'].map(name => `${name}-move-${suffix}`);
const A = 0;
const B = 1;
const users: number[] = [];
const machines: number[] = [];
const cookies: string[] = [];

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [index, username] of names.entries()) {
    users.push((await database.user.create({ data: { username, passwordHash, role: index < 2 ? 'student' : 'operator' } })).id);
    cookies.push(await signIn(index));
  }
  for (const [label, operator] of [['1', users[2]], ['2', users[3]]] as const) {
    machines.push((await database.gpuMachine.create({ data: { code: `MOVE-${label}-${suffix}`, operatorId: operator } })).id);
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
async function book(slotId: number, who = A) {
  const response = await request(app).post('/api/v1/bookings').set('Origin', origin)
    .set('Cookie', cookies[who]).send({ slotId }).expect(201);
  return response.body.bookingId as number;
}
function move(bookingId: number | string, slotId: unknown, cookie: string = cookies[A]) {
  const call = request(app).post(`/api/v1/bookings/${bookingId}/reschedule`).set('Origin', origin);
  return (cookie ? call.set('Cookie', cookie) : call).send({ slotId });
}
function cancel(bookingId: number) {
  return request(app).post(`/api/v1/bookings/${bookingId}/cancel`).set('Origin', origin).set('Cookie', cookies[A]);
}
function status(bookingId: number) {
  return database.booking.findUniqueOrThrow({ where: { id: bookingId } }).then(row => row.status);
}
// Raw SQL, so this file does not depend on the generated client knowing `replaces_booking_id`.
function replacements(originalId: number) {
  return database.$queryRaw<{ id: number; status: string; slot_id: number }[]>`
    SELECT id, status, slot_id FROM bookings WHERE replaces_booking_id = ${originalId} ORDER BY id`;
}
function bookingCount(who = A) {
  return database.booking.count({ where: { studentId: users[who] } });
}
function confirmedOn(slotId: number) {
  return database.booking.count({ where: { slotId, status: 'confirmed' } });
}
/** Runs `body` with the clock at `time`, signed in again as student A at that time. */
async function at(time: string, body: (cookie: string) => Promise<void>) {
  current = Date.parse(time);
  try { await body(await signIn(A)); } finally { current = now; }
}
function errorCode(response: request.Response) {
  return response.body?.error?.code;
}

test('TC-MOVE-01 a move confirms a replacement, marks the original rescheduled and frees its slot (AC-30)', async () => {
  const from = await slot('2031-05-01T14:00:00+07:00');
  const to = await slot('2031-05-01T16:00:00+07:00');
  const original = await book(from.id);

  const result = await move(original, to.id).expect(201);
  const replacement = result.body.bookingId as number;
  expect(result.body).toEqual({ bookingId: replacement, slotId: to.id, replacesBookingId: original });
  expect(replacement).not.toBe(original);
  expect(result.headers.location).toBe(`/api/v1/bookings/${replacement}`);

  const before = await request(app).get(`/api/v1/bookings/${original}`).set('Cookie', cookies[A]).expect(200);
  expect(before.body).toMatchObject({
    bookingId: original, slotId: from.id, status: 'rescheduled', replacesBookingId: null, replacedByBookingId: replacement,
  });
  const after = await request(app).get(`/api/v1/bookings/${replacement}`).set('Cookie', cookies[A]).expect(200);
  expect(after.body).toMatchObject({
    bookingId: replacement, slotId: to.id, status: 'confirmed', replacesBookingId: original, replacedByBookingId: null,
  });
  const list = await request(app).get('/api/v1/bookings').set('Cookie', cookies[A]).expect(200);
  expect((list.body as { bookingId: number }[]).map(row => row.bookingId)).toEqual([original, replacement]);

  // The original slot is bookable again (more than 30 minutes ahead).
  await book(from.id, B);
  expect(await confirmedOn(from.id)).toBe(1);
});

test('TC-MOVE-02 a move to a slot another student holds is refused and changes nothing (AC-31)', async () => {
  const held = await slot('2031-05-02T16:00:00+07:00');
  const from = await slot('2031-05-02T14:00:00+07:00');
  await book(held.id, B);
  const original = await book(from.id);
  const count = await bookingCount();

  expect(errorCode(await move(original, held.id).expect(409))).toBe('SLOT_ALREADY_BOOKED');
  expect(await status(original)).toBe('confirmed');
  expect(await bookingCount()).toBe(count);
  expect(await replacements(original)).toEqual([]);
});

test('TC-MOVE-03 a move into an hour the student already holds is refused; the same hour on another machine is allowed (AC-32)', async () => {
  const from = await slot('2031-05-03T14:00:00+07:00');
  const heldOther = await slot('2031-05-03T16:00:00+07:00', machines[1]);
  const busyHour = await slot('2031-05-03T16:00:00+07:00');
  const sameHourOther = await slot('2031-05-03T14:00:00+07:00', machines[1]);
  const original = await book(from.id);
  await book(heldOther.id);

  expect(errorCode(await move(original, busyHour.id).expect(409))).toBe('STUDENT_TIME_CONFLICT');
  expect(await status(original)).toBe('confirmed');
  expect(await replacements(original)).toEqual([]);

  const result = await move(original, sameHourOther.id).expect(201);
  expect(result.body).toMatchObject({ slotId: sameHourOther.id, replacesBookingId: original });
  expect(await status(original)).toBe('rescheduled');
});

test('TC-MOVE-04 the target follows the 30-minute cutoff and a started original cannot move (AC-33)', async () => {
  const cases = [
    { date: '2031-05-04', clock: '13:29:59.999', expected: 201 },
    { date: '2031-05-05', clock: '13:30:00.000', expected: 'BOOKING_CLOSED' },
    { date: '2031-05-06', clock: '14:00:00.000', expected: 'SLOT_ALREADY_STARTED' },
  ];
  for (const { date, clock, expected } of cases) {
    const target = await slot(`${date}T14:00:00+07:00`);
    const original = await book((await slot(`${date}T16:00:00+07:00`)).id);
    await at(`${date}T${clock}+07:00`, async cookie => {
      const result = await move(original, target.id, cookie);
      if (expected === 201) {
        expect(result.status).toBe(201);
        expect(await status(original)).toBe('rescheduled');
      } else {
        expect(result.status).toBe(409);
        expect(errorCode(result)).toBe(expected);
        expect(await status(original)).toBe('confirmed');
        expect(await replacements(original)).toEqual([]);
      }
    });
  }

  const started = await book((await slot('2031-05-07T16:00:00+07:00')).id);
  const later = await slot('2031-05-07T18:00:00+07:00');
  await at('2031-05-07T16:00:00.000+07:00', async cookie => {
    expect(errorCode(await move(started, later.id, cookie).expect(409))).toBe('BOOKING_ALREADY_STARTED');
  });
  expect(await status(started)).toBe('confirmed');
});

test('TC-MOVE-05 ownership, role, session, booking state and input are checked in contract order (AC-34)', async () => {
  const mine = await slot('2031-05-08T10:00:00+07:00');
  const theirs = await slot('2031-05-08T11:00:00+07:00');
  const free = await slot('2031-05-08T12:00:00+07:00');
  const original = await book(mine.id);
  const other = await book(theirs.id, B);
  const cancelled = await book((await slot('2031-05-08T13:00:00+07:00')).id);
  await cancel(cancelled).expect(200);
  const movedAway = await book((await slot('2031-05-08T15:00:00+07:00')).id);
  await move(movedAway, (await slot('2031-05-08T17:00:00+07:00')).id).expect(201);
  const snapshot = await database.booking.findMany({ where: { studentId: { in: users } }, orderBy: { id: 'asc' } });

  expect(errorCode(await move(original, free.id, cookies[B]).expect(404))).toBe('BOOKING_NOT_FOUND');
  expect(errorCode(await move('abc', free.id).expect(404))).toBe('BOOKING_NOT_FOUND');
  expect(errorCode(await move(original, free.id, cookies[2]).expect(403))).toBe('FORBIDDEN');
  await move(original, free.id, '').expect(401);
  expect(errorCode(await move(cancelled, free.id).expect(409))).toBe('BOOKING_NOT_CONFIRMED');
  expect(errorCode(await move(movedAway, free.id).expect(409))).toBe('BOOKING_NOT_CONFIRMED');
  // The body is validated first, so another student's booking ID still gets INVALID_SLOT_ID.
  expect(errorCode(await move(original, 'x').expect(400))).toBe('INVALID_SLOT_ID');
  expect(errorCode(await move(other, 'x').expect(400))).toBe('INVALID_SLOT_ID');
  expect(errorCode(await move(original, 2_147_483_647).expect(404))).toBe('SLOT_NOT_FOUND');
  expect(errorCode(await move(original, mine.id).expect(409))).toBe('SAME_SLOT');

  expect(await database.booking.findMany({ where: { studentId: { in: users } }, orderBy: { id: 'asc' } })).toEqual(snapshot);
});

test('TC-MOVE-06 concurrent moves to one target, of one booking, or of one student into one hour have exactly one winner (AC-35)', async () => {
  for (let round = 0; round < 5; round += 1) {
    const date = `2031-06-${String(round + 1).padStart(2, '0')}`;
    const mineFrom = await slot(`${date}T14:00:00+07:00`);
    const theirFrom = await slot(`${date}T15:00:00+07:00`);
    const target = await slot(`${date}T16:00:00+07:00`);
    const mine = await book(mineFrom.id);
    const theirs = await book(theirFrom.id, B);

    const results = await Promise.all([move(mine, target.id), move(theirs, target.id, cookies[B])]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    const loser = results[0].status === 409 ? mine : theirs;
    expect(errorCode(results.find(result => result.status === 409)!)).toBe('SLOT_ALREADY_BOOKED');
    expect(await status(loser)).toBe('confirmed');
    expect(await confirmedOn(target.id)).toBe(1);
  }

  for (let round = 0; round < 5; round += 1) {
    const date = `2031-06-${String(round + 11).padStart(2, '0')}`;
    const original = await book((await slot(`${date}T10:00:00+07:00`)).id);
    const first = await slot(`${date}T11:00:00+07:00`);
    const second = await slot(`${date}T12:00:00+07:00`);

    const results = await Promise.all([move(original, first.id), move(original, second.id)]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(errorCode(results.find(result => result.status === 409)!)).toBe('BOOKING_NOT_CONFIRMED');
    expect(await status(original)).toBe('rescheduled');
    const made = await replacements(original);
    expect(made).toHaveLength(1);
    expect(made[0].status).toBe('confirmed');
  }

  // One student moves two bookings into one hour on two machines at once. The two transactions lock
  // different rows, so the pre-write check can miss the other's uncommitted booking; the student-hour
  // index then refuses the second insert, and bookingConflict must map it to 409, not 500 (contract 0.3).
  for (let round = 0; round < 5; round += 1) {
    const date = `2031-06-${String(round + 21).padStart(2, '0')}`;
    const at10 = await book((await slot(`${date}T10:00:00+07:00`)).id);
    const at11 = await book((await slot(`${date}T11:00:00+07:00`)).id);
    const here = await slot(`${date}T16:00:00+07:00`);
    const there = await slot(`${date}T16:00:00+07:00`, machines[1]);

    const results = await Promise.all([move(at10, here.id), move(at11, there.id)]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(errorCode(results.find(result => result.status === 409)!)).toBe('STUDENT_TIME_CONFLICT');
    const loser = results[0].status === 409 ? at10 : at11;
    expect(await status(loser)).toBe('confirmed');
    expect(await replacements(loser)).toEqual([]);
    expect(await confirmedOn(here.id) + await confirmedOn(there.id)).toBe(1);
  }
});

test('TC-MOVE-07 a move to a closed slot is refused and the original stays confirmed (AC-36)', async () => {
  const from = await slot('2031-05-09T14:00:00+07:00');
  const target = await slot('2031-05-09T16:00:00+07:00');
  const original = await book(from.id);
  await request(app).post(`/api/v1/machines/${machines[0]}/slots/${target.id}/close`).set('Origin', origin)
    .set('Cookie', cookies[2]).expect(200);

  expect(errorCode(await move(original, target.id).expect(409))).toBe('SLOT_CLOSED');
  expect(await status(original)).toBe('confirmed');
  expect(await replacements(original)).toEqual([]);
});

test('TC-MOVE-08 a swap and a cross-move return 409, never 500, and change nothing (AC-42)', async () => {
  for (let round = 0; round < 10; round += 1) {
    const date = `2031-07-${String(round + 1).padStart(2, '0')}`;
    const s1 = await slot(`${date}T10:00:00+07:00`);
    const s2 = await slot(`${date}T11:00:00+07:00`);
    const mine = await book(s1.id);
    const theirs = await book(s2.id, B);

    const swap = await Promise.all([move(mine, s2.id), move(theirs, s1.id, cookies[B])]);
    expect(swap.map(result => result.status)).toEqual([409, 409]);
    expect(swap.map(errorCode)).toEqual(['SLOT_ALREADY_BOOKED', 'SLOT_ALREADY_BOOKED']);
    expect([await status(mine), await status(theirs)]).toEqual(['confirmed', 'confirmed']);
    expect([...await replacements(mine), ...await replacements(theirs)]).toEqual([]);
  }

  for (let round = 0; round < 10; round += 1) {
    const date = `2031-07-${String(round + 11).padStart(2, '0')}`;
    const at14 = await book((await slot(`${date}T14:00:00+07:00`)).id);
    const at15 = await book((await slot(`${date}T15:00:00+07:00`)).id);
    const other15 = await slot(`${date}T15:00:00+07:00`, machines[1]);
    const other14 = await slot(`${date}T14:00:00+07:00`, machines[1]);

    const cross = await Promise.all([move(at14, other15.id), move(at15, other14.id)]);
    expect(cross.map(result => result.status)).toEqual([409, 409]);
    expect(cross.map(errorCode)).toEqual(['STUDENT_TIME_CONFLICT', 'STUDENT_TIME_CONFLICT']);
    expect([await status(at14), await status(at15)]).toEqual(['confirmed', 'confirmed']);
    expect([...await replacements(at14), ...await replacements(at15)]).toEqual([]);
  }
});

test('TC-MOVE-09 a cancel and a move of the same booking sent together: exactly one wins (AC-43)', async () => {
  for (let round = 0; round < 10; round += 1) {
    const date = `2031-08-${String(round + 1).padStart(2, '0')}`;
    const original = await book((await slot(`${date}T10:00:00+07:00`)).id);
    const target = await slot(`${date}T12:00:00+07:00`);

    const [cancelResult, moveResult] = await Promise.all([cancel(original), move(original, target.id)]);
    const statuses = [cancelResult.status, moveResult.status];
    expect(statuses.filter(code => code >= 200 && code < 300)).toHaveLength(1);
    expect(statuses.filter(code => code >= 500)).toHaveLength(0);
    if (cancelResult.status === 200) {
      expect(errorCode(moveResult)).toBe('BOOKING_NOT_CONFIRMED');
      expect(await status(original)).toBe('cancelled');
      expect(await replacements(original)).toEqual([]);
    } else {
      expect(errorCode(cancelResult)).toBe('BOOKING_NOT_CONFIRMED');
      expect(await status(original)).toBe('rescheduled');
      const made = await replacements(original);
      expect(made).toHaveLength(1);
      expect(made[0].status).toBe('confirmed');
    }
  }
});
