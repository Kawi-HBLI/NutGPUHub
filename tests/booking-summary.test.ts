// F-08 booking summary (#15). Sprint 3 contract 0.2, AC-45 to AC-50 (TC-SUM-01 to 07).
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
// 0 = student A, 1 = operator A (GPU-01 and GPU-03), 2 = operator B (GPU-02), 3 = operator C (no machine).
const names = ['a', 'operator-a', 'operator-b', 'operator-c'].map(name => `${name}-summary-${suffix}`);
const STUDENT = 0;
const OPERATOR_A = 1;
const OPERATOR_B = 2;
const OPERATOR_C = 3;
const users: number[] = [];
const cookies: string[] = [];
// Test copies of the fixture machines: GPU-01 and GPU-03 for operator A, GPU-02 for operator B.
let gpu01 = 0;
let gpu02 = 0;
let gpu03 = 0;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [index, username] of names.entries()) {
    users.push((await database.user.create({ data: { username, passwordHash, role: index === STUDENT ? 'student' : 'operator' } })).id);
    cookies.push(await signIn(index));
  }
  const machine = (label: string, operator: number) =>
    database.gpuMachine.create({ data: { code: `SUM-${label}-${suffix}`, operatorId: users[operator] } }).then(row => row.id);
  gpu01 = await machine('01', OPERATOR_A);
  gpu02 = await machine('02', OPERATOR_B);
  gpu03 = await machine('03', OPERATOR_A);
});

afterAll(async () => {
  try {
    await database.booking.deleteMany({ where: { studentId: { in: users } } });
    await database.gpuMachine.deleteMany({ where: { id: { in: [gpu01, gpu02, gpu03] } } });
    await database.user.deleteMany({ where: { id: { in: users } } });
  } finally { await database.$disconnect(); }
});

async function signIn(account: number) {
  const response = await request(app).post('/api/v1/auth/login').set('Origin', origin)
    .send({ username: names[account], password }).expect(200);
  return (response.headers['set-cookie'] as unknown as string[])[0].split(';', 1)[0];
}
async function signInAll() {
  for (const index of names.keys()) cookies[index] = await signIn(index);
}
function slot(startAt: string, machine = gpu01) {
  return database.slot.create({ data: { machineId: machine, startAt: new Date(startAt) } }).then(row => row.id);
}
function post(path: string, who: number, body?: object) {
  return request(app).post(path).set('Origin', origin).set('Cookie', cookies[who]).send(body);
}
async function book(slotId: number) {
  return (await post('/api/v1/bookings', STUDENT, { slotId }).expect(201)).body.bookingId as number;
}
/** Raw summary request; `query` is the query string without `?`. Pass who = null for no cookie. */
function summary(query: string, who: number | null = OPERATOR_A) {
  const call = request(app).get(`/api/v1/booking-summary?${query}`);
  return who === null ? call : call.set('Cookie', cookies[who]);
}
/** The three counts of a successful summary. */
async function counts(query: string, who: number = OPERATOR_A) {
  const { open, booked, bookable } = (await summary(query, who).expect(200)).body;
  return { open, booked, bookable };
}
function expectNoCounts(body: unknown) {
  expect(JSON.stringify(body)).not.toMatch(/"(open|booked|bookable)"/);
}

test('TC-SUM-01 counts follow booking, cancellation, a move and a closure on one machine (AC-45)', async () => {
  const date = '2031-04-01';
  const [at10, at11, at12, at13] = await Promise.all([10, 11, 12, 13].map(hour => slot(`${date}T${hour}:00:00+07:00`)));
  const query = `from=${date}&to=${date}&machineId=${gpu01}`;

  // (1) Nothing booked. The full body echoes the request.
  expect((await summary(query).expect(200)).body).toEqual({ from: date, to: date, machineId: gpu01, open: 4, booked: 0, bookable: 4 });
  // (2) A books 10:00.
  const first = await book(at10);
  expect(await counts(query)).toEqual({ open: 4, booked: 1, bookable: 3 });
  // (3) A cancels it; the cancelled row does not count.
  await post(`/api/v1/bookings/${first}/cancel`, STUDENT).expect(200);
  expect(await counts(query)).toEqual({ open: 4, booked: 0, bookable: 4 });
  // (4) A books 11:00 and moves it to 12:00; the rescheduled original does not count.
  const second = await book(at11);
  await post(`/api/v1/bookings/${second}/reschedule`, STUDENT, { slotId: at12 }).expect(201);
  expect(await counts(query)).toEqual({ open: 4, booked: 1, bookable: 3 });
  const schedule = (await request(app).get(`/api/v1/machines/${gpu01}/slots?date=${date}`)
    .set('Cookie', cookies[OPERATOR_A]).expect(200)).body as { slotId: number; booking: unknown }[];
  expect(schedule.find(row => row.slotId === at12)!.booking).not.toBeNull();
  expect(schedule.find(row => row.slotId === at11)!.booking).toBeNull();
  // (5) Operator A closes the free 13:00.
  await post(`/api/v1/machines/${gpu01}/slots/${at13}/close`, OPERATOR_A).expect(200);
  expect(await counts(query)).toEqual({ open: 3, booked: 1, bookable: 2 });
});

test('TC-SUM-02 both dates are inclusive in Bangkok time (AC-46)', async () => {
  await slot('2031-04-09T23:00:00+07:00');
  await slot('2031-04-10T00:00:00+07:00');
  await slot('2031-04-11T23:00:00+07:00');
  await slot('2031-04-12T00:00:00+07:00');
  expect((await counts(`from=2031-04-10&to=2031-04-11&machineId=${gpu01}`)).open).toBe(2);
  expect((await counts(`from=2031-04-10&to=2031-04-10&machineId=${gpu01}`)).open).toBe(1);
});

test('TC-SUM-03 a machine filter counts one machine; without it, only the operator\'s own machines (AC-47)', async () => {
  const date = '2031-04-20';
  await slot(`${date}T10:00:00+07:00`, gpu01);
  await slot(`${date}T11:00:00+07:00`, gpu01);
  await slot(`${date}T10:00:00+07:00`, gpu03);
  for (const hour of [10, 11, 12]) await slot(`${date}T${hour}:00:00+07:00`, gpu02);
  const range = `from=${date}&to=${date}`;

  expect((await counts(`${range}&machineId=${gpu01}`)).open).toBe(2);
  expect((await counts(`${range}&machineId=${gpu03}`)).open).toBe(1);
  expect((await summary(range).expect(200)).body).toEqual({ from: date, to: date, machineId: null, open: 3, booked: 0, bookable: 3 });
  expect((await counts(range, OPERATOR_B)).open).toBe(3);
  expect((await summary(range, OPERATOR_C).expect(200)).body).toEqual({ from: date, to: date, machineId: null, open: 0, booked: 0, bookable: 0 });
});

test('TC-SUM-04 bookable needs more than 30 minutes; past slots stay in open and booked (AC-48)', async () => {
  const date = '2031-05-01';
  const at11 = await slot(`${date}T11:00:00+07:00`);
  await slot(`${date}T12:00:00+07:00`);
  await slot(`${date}T14:00:00+07:00`);
  const query = `from=${date}&to=${date}&machineId=${gpu01}`;
  try {
    current = Date.parse(`${date}T10:00:00+07:00`);
    await signInAll();
    await book(at11);

    current = Date.parse(`${date}T13:29:59.999+07:00`);
    await signInAll();
    expect(await counts(query)).toEqual({ open: 3, booked: 1, bookable: 1 });

    current = Date.parse(`${date}T13:30:00.000+07:00`);
    expect(await counts(query)).toEqual({ open: 3, booked: 1, bookable: 0 });
  } finally {
    current = now;
    await signInAll();
  }
});

test('TC-SUM-05 invalid ranges return 400 INVALID_DATE_RANGE; 31 days is allowed (AC-49)', async () => {
  const invalid = [
    'from=2031-03-05&to=2031-03-01',
    'to=2031-03-01',
    'from=2031-03-01',
    'from=2031-1-5&to=2031-01-06',
    'from=2031-02-30&to=2031-03-01',
    'from=2031-03-01&to=2031-04-01',
  ];
  for (const query of invalid) {
    const result = await summary(query).expect(400);
    expect(result.body.error.code, query).toBe('INVALID_DATE_RANGE');
    expectNoCounts(result.body);
  }
  await summary('from=2031-03-01&to=2031-03-31').expect(200);
});

test('TC-SUM-06 unassigned or invalid machines, students and missing sessions get no counts (AC-50)', async () => {
  const range = 'from=2031-04-20&to=2031-04-20';
  const refusals: [string, number | null, number, string][] = [
    [`${range}&machineId=${gpu01}`, OPERATOR_B, 403, 'MACHINE_NOT_ASSIGNED'],
    [`${range}&machineId=${gpu03 + 100_000}`, OPERATOR_A, 404, 'MACHINE_NOT_FOUND'],
    [`${range}&machineId=x`, OPERATOR_A, 404, 'MACHINE_NOT_FOUND'],
    [`${range}&machineId=`, OPERATOR_A, 404, 'MACHINE_NOT_FOUND'],
    [`${range}&machineId=${gpu01}&machineId=${gpu01}`, OPERATOR_A, 404, 'MACHINE_NOT_FOUND'],
    [range, STUDENT, 403, 'FORBIDDEN'],
    [range, null, 401, 'AUTH_REQUIRED'],
  ];
  for (const [query, who, status, code] of refusals) {
    const result = await summary(query, who).expect(status);
    expect(result.body.error.code, `${query} as ${who}`).toBe(code);
    expectNoCounts(result.body);
  }
});

test('TC-SUM-07 the machine is checked before the range', async () => {
  const result = await summary(`from=2031-03-05&to=2031-03-01&machineId=${gpu01}`, OPERATOR_B).expect(403);
  expect(result.body.error.code).toBe('MACHINE_NOT_ASSIGNED');
  expectNoCounts(result.body);
});
