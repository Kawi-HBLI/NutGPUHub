import type { PrismaClient } from '@prisma/client';
import express from 'express';
import { asyncRoute, currentAccount, sendError } from './http.js';
import { assignedMachine } from './machines.js';
import type { createSessionGuard } from './session.js';
import { bangkokDayRange, bookingCutoffMs } from './time.js';

type Guard = ReturnType<typeof createSessionGuard>;

const dayMs = 24 * 60 * 60_000;
/** Longest range, counting both dates (Sprint 3 contract, AC-49). */
const maxRangeDays = 31;

/** Both dates as Bangkok day ranges, or null when either is missing or invalid, from > to, or over 31 days. */
function parseRange(from: unknown, to: unknown) {
  const first = bangkokDayRange(from);
  const last = bangkokDayRange(to);
  if (!first || !last || first.start > last.start) return null;
  const days = (last.start.getTime() - first.start.getTime()) / dayMs + 1;
  return days <= maxRangeDays ? { from: from as string, to: to as string, start: first.start, end: last.end } : null;
}

/**
 * F-08 (AC-45 to AC-50): an operator counts open, booked and bookable slots on their assigned
 * machines over a date range. Counting rules are D-11; the summary only reads.
 */
export function createSummaryRouter(database: PrismaClient, clock: () => number, guard: Guard) {
  const router = express.Router();

  router.get('/booking-summary', guard.requireAccount, guard.requireRole('operator'), asyncRoute(async (request, response) => {
    // The machine is checked before the range, as in the schedule route (TC-SUM-07).
    let machineIds: number[];
    let machineId: number | null = null;
    if (request.query.machineId !== undefined) {
      const machine = await assignedMachine(database, request.query.machineId, response);
      if (!machine) return;
      machineIds = [machine.id];
      machineId = machine.id;
    } else {
      const machines = await database.gpuMachine.findMany({ where: { operatorId: currentAccount(response).id }, select: { id: true } });
      machineIds = machines.map(machine => machine.id);
    }

    const range = parseRange(request.query.from, request.query.to);
    if (!range) {
      sendError(response, 400, 'INVALID_DATE_RANGE', 'Choose a From and To date (YYYY-MM-DD), From not after To, at most 31 days.');
      return;
    }

    const inRange = { machineId: { in: machineIds }, startAt: { gte: range.start, lt: range.end } };
    const confirmed = { status: 'confirmed' };
    const [open, booked, bookable] = await Promise.all([
      database.slot.count({ where: { ...inRange, closedAt: null } }),
      database.slot.count({ where: { ...inRange, bookings: { some: confirmed } } }),
      database.slot.count({
        where: {
          ...inRange,
          startAt: { ...inRange.startAt, gt: new Date(clock() + bookingCutoffMs) },
          closedAt: null,
          bookings: { none: confirmed },
        },
      }),
    ]);
    response.json({ from: range.from, to: range.to, machineId, open, booked, bookable });
  }));

  return router;
}
