// TC-PERSIST-01 at system level (AC-15, NFR-02): book through a real Node server process,
// stop that process, start a new one on the same database, and read the booking back.
// TC-PERSIST-02 (Sprint 2, AC-29): a booking cancelled before the restart keeps its status and
// cancelledAt afterwards (AC-29), a slot closed before the restart keeps closedAt (F-07, AC-37),
// and a rescheduled original and its replacement keep their statuses and links (F-06, AC-30).
// Run with `npm run verify:restart`. Uses TEST_DATABASE_URL and cleans up its own records.
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../server/password.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a separate, migrated PostgreSQL database.');
}
const port = 3101;
const origin = `http://127.0.0.1:${port}`;
const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

function startServer(): ChildProcess {
  const child = spawn(process.execPath, ['dist/server/index.js'], {
    env: {
      ...process.env, DATABASE_URL: testDatabaseUrl, PORT: String(port), HOST: '127.0.0.1',
      APP_ORIGIN: origin, SESSION_TTL_MINUTES: '60', COOKIE_SECURE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', chunk => process.stderr.write(chunk));
  return child;
}

async function waitUntil(check: () => Promise<boolean>, what: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const reachable = () => fetch(`${origin}/api/v1/auth/me`).then(() => true, () => false);

async function stopServer(child: ChildProcess) {
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
  await waitUntil(async () => !(await reachable()), 'the port to close');
}

function expectEqual(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const database = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(12).toString('hex');
const userIds: number[] = [];
let machineId = 0;
let server: ChildProcess | undefined;

try {
  const passwordHash = await hashPassword(password);
  const operator = await database.user.create({ data: { username: `restart-op-${suffix}`, passwordHash, role: 'operator' } });
  const student = await database.user.create({ data: { username: `restart-student-${suffix}`, passwordHash, role: 'student' } });
  userIds.push(operator.id, student.id);
  const machine = await database.gpuMachine.create({ data: { code: `RESTART-${suffix}`, operatorId: operator.id } });
  machineId = machine.id;
  const startAt = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 48 * 3_600_000);
  const slot = await database.slot.create({ data: { machineId, startAt } });
  const cancelSlot = await database.slot.create({ data: { machineId, startAt: new Date(startAt.getTime() + 3_600_000) } });
  const closeSlot = await database.slot.create({ data: { machineId, startAt: new Date(startAt.getTime() + 2 * 3_600_000) } });
  const moveFrom = await database.slot.create({ data: { machineId, startAt: new Date(startAt.getTime() + 3 * 3_600_000) } });
  const moveTo = await database.slot.create({ data: { machineId, startAt: new Date(startAt.getTime() + 4 * 3_600_000) } });
  // The schedule route takes a Bangkok calendar date (UTC+7, no daylight saving).
  const closeDate = new Date(closeSlot.startAt.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

  server = startServer();
  await waitUntil(reachable, 'the first server process');
  log(`first server process started, pid ${server.pid}`);

  const login = await fetch(`${origin}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ username: student.username, password }),
  });
  const cookie = login.headers.get('set-cookie')!.split(';', 1)[0];
  const created = await fetch(`${origin}/api/v1/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ slotId: slot.id }),
  });
  expectEqual('booking created with 201', created.status, 201);
  const { bookingId } = await created.json() as { bookingId: number };
  const before = await (await fetch(`${origin}/api/v1/bookings/${bookingId}`, { headers: { Cookie: cookie } })).json();
  log(`booking ${bookingId} for slot ${slot.id} on ${machine.code} at ${startAt.toISOString()}`);

  const toCancel = await fetch(`${origin}/api/v1/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ slotId: cancelSlot.id }),
  });
  const { bookingId: cancelledId } = await toCancel.json() as { bookingId: number };
  const cancelled = await fetch(`${origin}/api/v1/bookings/${cancelledId}/cancel`, {
    method: 'POST', headers: { Origin: origin, Cookie: cookie },
  });
  expectEqual('booking cancelled with 200 before restart', cancelled.status, 200);
  const cancelledBefore = await cancelled.json() as { status: string; cancelledAt: string };
  log(`booking ${cancelledId} cancelled at ${cancelledBefore.cancelledAt}`);

  const toMove = await fetch(`${origin}/api/v1/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ slotId: moveFrom.id }),
  });
  const { bookingId: movedId } = await toMove.json() as { bookingId: number };
  const moved = await fetch(`${origin}/api/v1/bookings/${movedId}/reschedule`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ slotId: moveTo.id }),
  });
  expectEqual('booking rescheduled with 201 before restart', moved.status, 201);
  const { bookingId: replacementId } = await moved.json() as { bookingId: number };
  const movedBefore = await (await fetch(`${origin}/api/v1/bookings/${movedId}`, { headers: { Cookie: cookie } })).json();
  const replacementBefore = await (await fetch(`${origin}/api/v1/bookings/${replacementId}`, { headers: { Cookie: cookie } })).json();
  expectEqual('original is rescheduled and links to its replacement', [movedBefore.status, movedBefore.replacedByBookingId], ['rescheduled', replacementId]);
  expectEqual('replacement is confirmed and links to the original', [replacementBefore.status, replacementBefore.replacesBookingId], ['confirmed', movedId]);
  log(`booking ${movedId} rescheduled to booking ${replacementId}`);

  const operatorLogin = await fetch(`${origin}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ username: operator.username, password }),
  });
  const operatorCookie = operatorLogin.headers.get('set-cookie')!.split(';', 1)[0];
  const closed = await fetch(`${origin}/api/v1/machines/${machineId}/slots/${closeSlot.id}/close`, {
    method: 'POST', headers: { Origin: origin, Cookie: operatorCookie },
  });
  expectEqual('slot closed with 200 before restart', closed.status, 200);
  const { closedAt } = await closed.json() as { closedAt: string };
  log(`slot ${closeSlot.id} closed at ${closedAt}`);

  const firstPid = server.pid;
  await stopServer(server);
  log(`first server process ${firstPid} stopped, port ${port} closed`);

  server = startServer();
  await waitUntil(reachable, 'the restarted server process');
  log(`second server process started, pid ${server.pid}`);
  expectEqual('restarted process has a different pid', server.pid !== firstPid, true);

  const detail = await fetch(`${origin}/api/v1/bookings/${bookingId}`, { headers: { Cookie: cookie } });
  expectEqual('booking detail after restart returns 200', detail.status, 200);
  expectEqual('booking detail after restart matches before restart', await detail.json(), before);
  const list = await fetch(`${origin}/api/v1/bookings`, { headers: { Cookie: cookie } });
  const rows = await list.json() as { bookingId: number }[];
  expectEqual('My Bookings after restart contains every booking', rows.map(row => row.bookingId), [bookingId, cancelledId, movedId, replacementId]);
  log('TC-PERSIST-01 process restart check passed');

  const cancelledAfter = await fetch(`${origin}/api/v1/bookings/${cancelledId}`, { headers: { Cookie: cookie } });
  expectEqual('cancelled booking after restart returns 200', cancelledAfter.status, 200);
  expectEqual('cancelled booking after restart matches before restart', await cancelledAfter.json(), cancelledBefore);
  log('TC-PERSIST-02 cancel part (AC-29) passed');

  const scheduleAfter = await fetch(`${origin}/api/v1/machines/${machineId}/slots?date=${closeDate}`, { headers: { Cookie: operatorCookie } });
  expectEqual('schedule after restart returns 200', scheduleAfter.status, 200);
  const closedRow = (await scheduleAfter.json() as { slotId: number; closedAt: string | null }[]).find(row => row.slotId === closeSlot.id);
  expectEqual('closed slot after restart keeps closedAt', closedRow?.closedAt, closedAt);
  log('TC-PERSIST-02 close part (AC-37) passed');

  const movedAfter = await (await fetch(`${origin}/api/v1/bookings/${movedId}`, { headers: { Cookie: cookie } })).json();
  const replacementAfter = await (await fetch(`${origin}/api/v1/bookings/${replacementId}`, { headers: { Cookie: cookie } })).json();
  expectEqual('rescheduled original after restart matches before restart', movedAfter, movedBefore);
  expectEqual('replacement after restart matches before restart', replacementAfter, replacementBefore);
  log('TC-PERSIST-02 reschedule part (AC-30) passed');
} finally {
  if (server && server.exitCode === null) await stopServer(server);
  await database.booking.deleteMany({ where: { studentId: { in: userIds } } });
  if (machineId) await database.gpuMachine.deleteMany({ where: { id: machineId } });
  await database.user.deleteMany({ where: { id: { in: userIds } } });
  await database.$disconnect();
}
