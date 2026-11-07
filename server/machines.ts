import { Prisma, type PrismaClient } from '@prisma/client';
import express, { type Response } from 'express';
import { asyncRoute, currentAccount, sendError } from './http.js';
import type { createSessionGuard } from './session.js';
import { bangkokDayRange, isOnTheHour, parseOffsetTimestamp, slotEnd } from './time.js';

type Guard = ReturnType<typeof createSessionGuard>;
type SlotRecord = { id: number; machineId: number; startAt: Date };

export function slotView(slot: SlotRecord) {
  return {
    slotId: slot.id,
    machineId: slot.machineId,
    startAt: slot.startAt.toISOString(),
    endAt: slotEnd(slot.startAt).toISOString(),
  };
}

/** F-02: operators list assigned machines, read a machine's day schedule and open slots. */
export function createMachineRouter(database: PrismaClient, clock: () => number, guard: Guard) {
  const router = express.Router();
  // Guards are attached per route so unmatched paths still reach the API's 404 handler.
  const operatorOnly = [guard.requireAccount, guard.requireRole('operator')];

  /** Finds the machine and checks that the signed-in operator is assigned to it. Sends 404 or 403 otherwise. */
  async function assignedMachine(rawId: string, response: Response) {
    const id = /^[1-9]\d{0,9}$/.test(rawId) ? Number(rawId) : NaN;
    const machine = Number.isSafeInteger(id) && id <= 2_147_483_647
      ? await database.gpuMachine.findUnique({ where: { id } })
      : null;
    if (!machine) {
      sendError(response, 404, 'MACHINE_NOT_FOUND', 'The GPU machine does not exist.');
      return null;
    }
    if (machine.operatorId !== currentAccount(response).id) {
      sendError(response, 403, 'MACHINE_NOT_ASSIGNED', 'You are not assigned to this GPU machine.');
      return null;
    }
    return machine;
  }

  router.get('/', ...operatorOnly, asyncRoute(async (_request, response) => {
    const machines = await database.gpuMachine.findMany({
      where: { operatorId: currentAccount(response).id },
      orderBy: { code: 'asc' },
    });
    response.json(machines.map(machine => ({ machineId: machine.id, machineCode: machine.code })));
  }));

  router.get('/:machineId/slots', ...operatorOnly, asyncRoute(async (request, response) => {
    const machine = await assignedMachine(request.params.machineId, response);
    if (!machine) return;
    const day = bangkokDayRange(request.query.date);
    if (!day) {
      sendError(response, 400, 'INVALID_DATE', 'Choose a date in YYYY-MM-DD format.');
      return;
    }
    const slots = await database.slot.findMany({
      where: { machineId: machine.id, startAt: { gte: day.start, lt: day.end } },
      orderBy: { startAt: 'asc' },
      include: { bookings: { select: { id: true, student: { select: { username: true } } } } },
    });
    // F-04 (AC-14): the assigned operator sees who booked each slot. A slot has at most one booking (BR-01).
    response.json(slots.map(slot => {
      const booking = slot.bookings[0];
      return {
        ...slotView(slot),
        booking: booking ? { bookingId: booking.id, studentUsername: booking.student.username } : null,
      };
    }));
  }));

  router.post('/:machineId/slots', ...operatorOnly, asyncRoute(async (request, response) => {
    const machine = await assignedMachine(request.params.machineId, response);
    if (!machine) return;
    const startAt = parseOffsetTimestamp(request.body?.startAt);
    if (!startAt) {
      sendError(response, 400, 'INVALID_START_AT', 'Send startAt as a timestamp with a time zone offset.');
      return;
    }
    if (!isOnTheHour(startAt)) {
      sendError(response, 400, 'START_NOT_ON_HOUR', 'Slots must start on the hour.');
      return;
    }
    if (startAt.getTime() <= clock()) {
      sendError(response, 400, 'START_NOT_IN_FUTURE', 'Slots must start after the current time.');
      return;
    }

    try {
      const slot = await database.slot.create({ data: { machineId: machine.id, startAt } });
      response.status(201).json(slotView(slot));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        sendError(response, 409, 'SLOT_ALREADY_EXISTS', 'This machine already has a slot at that time.');
        return;
      }
      throw error;
    }
  }));

  return router;
}
