// F-07 close a slot (#14). Sprint 2 contract 0.3, AC-37 to AC-41 (TC-CLOSE-01 to 05).
// TC-CLOSE-06 (close against a move, AC-44) needs F-06 and is added with it.
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
// 0 = student A, 1 = operator A (machine A), 2 = operator B (machine B).
const names = ['a', 'operator-a', 'operator-b'].map(name => `${name}-close-${suffix}`);
const users: number[] = [];
const machines: number[] = [];
const cookies: string[] = [];

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [index, username] of names.entries()) {
    users.push((await database.user.create({ data: { username, passwordHash, role: index === 0 ? 'student' : 'operator' } })).id);
    cookies.push(await signIn(index));
  }
  for (const [label, operator] of [['A', users[1]], ['B', users[2]]] as const) {
    machines.push((await database.gpuMachine.create({ data: { code: `CLOSE-${label}-${suffix}`, operatorId: operator } })).id);
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
function close(slotId: number | string, cookie: string = cookies[1], machine: number | string = machines[0]) {
  const call = request(app).post(`/api/v1/machines/${machine}/slots/${slotId}/close`).set('Origin', origin);
  return cookie ? call.set('Cookie', cookie) : call;
}
function book(slotId: number, cookie = cookies[0]) {
  return request(app).post('/api/v1/bookings').set('Origin', origin).set('Cookie', cookie).send({ slotId });
}
// Raw SQL, so this file does not depend on the generated client knowing `closed_at`.
function closedAt(slotId: number) {
  return database.$queryRaw<{ closed_at: Date | null }[]>`SELECT closed_at FROM slots WHERE id = ${slotId}`
    .then(rows => rows[0].closed_at);
}
function confirmedBookings(slotId: number) {
  return database.booking.count({ where: { slotId, status: 'confirmed' } });
}
async function schedule(date: string, cookie = cookies[1], machine = machines[0]) {
  const result = await request(app).get(`/api/v1/machines/${machine}/slots?date=${date}`).set('Cookie', cookie).expect(200);
  return result.body as { slotId: number; closedAt: string | null; booking: unknown }[];
}

test('TC-CLOSE-01 the assigned operator closes an upcoming unbooked slot, including one whose booking was cancelled (AC-37)', async () => {
  const open = await slot('2031-03-01T10:00:00+07:00');
  const result = await close(open.id).expect(200);
  expect(result.body).toEqual({
    slotId: open.id, machineId: machines[0], startAt: open.startAt.toISOString(),
    endAt: new Date(open.startAt.getTime() + 3_600_000).toISOString(), closedAt: new Date(now).toISOString(),
  });
  expect(await closedAt(open.id)).toEqual(new Date(now));

  const released = await slot('2031-03-01T11:00:00+07:00');
  const booked = await book(released.id).expect(201);
  await request(app).post(`/api/v1/bookings/${booked.body.bookingId}/cancel`).set('Origin', origin).set('Cookie', cookies[0]).expect(200);
  await close(released.id).expect(200);

  const rows = await schedule('2031-03-01');
  expect(rows.find(row => row.slotId === open.id)).toMatchObject({ closedAt: new Date(now).toISOString(), booking: null });
  expect(rows.find(row => row.slotId === released.id)).toMatchObject({ closedAt: new Date(now).toISOString(), booking: null });
});

test('TC-CLOSE-02 a closed slot leaves availability and a direct booking returns SLOT_CLOSED (AC-38)', async () => {
  const target = await slot('2031-03-02T10:00:00+07:00');
  await close(target.id).expect(200);

  const available = await request(app).get('/api/v1/slots?date=2031-03-02').set('Cookie', cookies[0]).expect(200);
  expect((available.body as { slotId: number }[]).map(row => row.slotId)).not.toContain(target.id);

  const result = await book(target.id).expect(409);
  expect(result.body.error.code).toBe('SLOT_CLOSED');
  expect(await database.booking.count({ where: { slotId: target.id } })).toBe(0);
});

test('TC-CLOSE-03 booked, closed and started slots cannot be closed; one millisecond before the start can (AC-39)', async () => {
  const booked = await slot('2031-03-03T10:00:00+07:00');
  await book(booked.id).expect(201);
  expect((await close(booked.id).expect(409)).body.error.code).toBe('SLOT_ALREADY_BOOKED');
  expect(await closedAt(booked.id)).toBeNull();
  expect(await confirmedBookings(booked.id)).toBe(1);

  const twice = await slot('2031-03-03T11:00:00+07:00');
  await close(twice.id).expect(200);
  const first = await closedAt(twice.id);
  expect((await close(twice.id).expect(409)).body.error.code).toBe('SLOT_CLOSED');
  expect(await closedAt(twice.id)).toEqual(first);

  // The clock is 14:00, so this 14:00 slot starts exactly now (D-13: "upcoming", no 30-minute cutoff).
  const startsNow = await slot('2030-01-01T14:00:00+07:00');
  expect((await close(startsNow.id).expect(409)).body.error.code).toBe('SLOT_ALREADY_STARTED');
  expect(await closedAt(startsNow.id)).toBeNull();

  const justBefore = await slot('2030-01-02T14:00:00+07:00');
  try {
    current = Date.parse('2030-01-02T13:59:59.999+07:00');
    const cookie = await signIn(1);
    await close(justBefore.id, cookie).expect(200);
  } finally {
    current = now;
  }
  expect(await closedAt(justBefore.id)).toEqual(new Date('2030-01-02T13:59:59.999+07:00'));
});

test('TC-CLOSE-04 other operators, students, anonymous requests and wrong machines are rejected (AC-40)', async () => {
  const target = await slot('2031-03-04T10:00:00+07:00');
  const other = await slot('2031-03-04T10:00:00+07:00', machines[1]);

  expect((await close(target.id, cookies[2]).expect(403)).body.error.code).toBe('MACHINE_NOT_ASSIGNED');
  expect((await close(target.id, cookies[0]).expect(403)).body.error.code).toBe('FORBIDDEN');
  await close(target.id, '').expect(401);
  expect((await close(other.id, cookies[1], machines[0]).expect(404)).body.error.code).toBe('SLOT_NOT_FOUND');
  expect((await close('abc').expect(404)).body.error.code).toBe('SLOT_NOT_FOUND');
  expect((await close(target.id, cookies[1], 2_147_483_647).expect(404)).body.error.code).toBe('MACHINE_NOT_FOUND');

  expect(await closedAt(target.id)).toBeNull();
  expect(await closedAt(other.id)).toBeNull();
});

test('TC-CLOSE-05 a close and a booking sent together: exactly one wins and the slot is never both (AC-41)', async () => {
  for (let hour = 0; hour < 20; hour += 1) {
    const target = await slot(`2031-04-01T${String(hour).padStart(2, '0')}:00:00+07:00`);
    const [closeResult, bookResult] = await Promise.all([close(target.id), book(target.id)]);
    const statuses = [closeResult.status, bookResult.status];
    expect(statuses.filter(status => status >= 200 && status < 300)).toHaveLength(1);
    expect(statuses.filter(status => status >= 500)).toHaveLength(0);
    if (closeResult.status === 200) {
      expect(bookResult.body.error.code).toBe('SLOT_CLOSED');
      expect(await confirmedBookings(target.id)).toBe(0);
      expect(await closedAt(target.id)).not.toBeNull();
    } else {
      expect(closeResult.body.error.code).toBe('SLOT_ALREADY_BOOKED');
      expect(await confirmedBookings(target.id)).toBe(1);
      expect(await closedAt(target.id)).toBeNull();
    }
  }
});
