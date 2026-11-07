import { Prisma, type PrismaClient } from '@prisma/client';
import express from 'express';
import { asyncRoute, currentAccount, sendError } from './http.js';
import { slotView } from './machines.js';
import type { createSessionGuard } from './session.js';
import { bangkokDayRange } from './time.js';

type Guard = ReturnType<typeof createSessionGuard>;

export function createStudentRouter(database: PrismaClient, clock: () => number, guard: Guard) {
  const router = express.Router();
  router.use(guard.requireAccount, guard.requireRole('student'));

  router.get('/slots', asyncRoute(async (request, response) => {
    const day = bangkokDayRange(request.query.date);
    if (!day) {
      sendError(response, 400, 'INVALID_DATE', 'Choose a date in YYYY-MM-DD format.');
      return;
    }
    const slots = await database.slot.findMany({
      where: { startAt: { gte: day.start, lt: day.end, gt: new Date(clock()) }, bookings: { none: {} } },
      include: { machine: { select: { code: true } } },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });
    response.json(slots.map(slot => ({ ...slotView(slot), machineCode: slot.machine.code })));
  }));

  router.post('/bookings', asyncRoute(async (request, response) => {
    const slotId = request.body?.slotId;
    if (!Number.isSafeInteger(slotId) || slotId < 1 || slotId > 2_147_483_647) {
      sendError(response, 400, 'INVALID_SLOT_ID', 'Choose a valid slot.');
      return;
    }
    const slot = await database.slot.findUnique({ where: { id: slotId } });
    if (!slot) {
      sendError(response, 404, 'SLOT_NOT_FOUND', 'The slot does not exist.');
      return;
    }
    if (slot.startAt.getTime() <= clock()) {
      sendError(response, 409, 'SLOT_ALREADY_STARTED', 'This slot has already started.');
      return;
    }
    try {
      const booking = await database.booking.create({ data: {
        slotId: slot.id, studentId: currentAccount(response).id, slotStartAt: slot.startAt,
      } });
      response.location(`/api/v1/bookings/${booking.id}`).status(201).json({ bookingId: booking.id, slotId: slot.id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        const sameSlot = Array.isArray(target) && target.includes('slot_id');
        sendError(response, 409, sameSlot ? 'SLOT_ALREADY_BOOKED' : 'STUDENT_TIME_CONFLICT',
          sameSlot ? 'This slot has already been booked.' : 'You already have a booking at this hour.');
        return;
      }
      throw error;
    }
  }));

  router.get('/bookings/:bookingId', asyncRoute(async (request, response) => {
    const id = /^[1-9]\d{0,9}$/.test(request.params.bookingId) ? Number(request.params.bookingId) : NaN;
    const booking = Number.isSafeInteger(id) && id <= 2_147_483_647
      ? await database.booking.findFirst({
        where: { id, studentId: currentAccount(response).id },
        include: { slot: { include: { machine: { select: { code: true } } } } },
      }) : null;
    if (!booking) {
      sendError(response, 404, 'BOOKING_NOT_FOUND', 'The booking does not exist.');
      return;
    }
    response.json({ bookingId: booking.id, ...slotView(booking.slot), machineCode: booking.slot.machine.code });
  }));
  return router;
}
