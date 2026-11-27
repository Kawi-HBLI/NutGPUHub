import { Prisma, type PrismaClient } from '@prisma/client';
import express from 'express';
import { asyncRoute, currentAccount, sendError } from './http.js';
import { slotView } from './machines.js';
import type { createSessionGuard } from './session.js';
import { bangkokDayRange, bookingCutoffMs } from './time.js';

type Guard = ReturnType<typeof createSessionGuard>;

/** Only confirmed bookings hold a slot and a student's hour (F-05, BR-01, BR-04). */
const CONFIRMED = 'confirmed';
const bookingInclude = { slot: { include: { machine: { select: { code: true } } } } } as const;
type BookingRecord = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** Student booking view (F-04, extended by F-05 with the booking's status and cancellation time). */
function bookingView(booking: BookingRecord) {
  return {
    bookingId: booking.id, ...slotView(booking.slot), machineCode: booking.slot.machine.code,
    status: booking.status, cancelledAt: booking.cancelledAt?.toISOString() ?? null,
  };
}

/** A booking ID from the URL, or null when it cannot name a stored booking. */
function parseBookingId(raw: string) {
  const id = /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : null;
}

/**
 * Maps a violation of the confirmed-booking partial unique indexes to its API error.
 * Prisma reports these indexes by their columns (`slot_id`, or `student_id` + `slot_start_at`),
 * not by index name, so the column check from Sprint 1 stays (contract 0.3, conflict detection).
 */
export function bookingConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return null;
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes('slot_id')
    ? { code: 'SLOT_ALREADY_BOOKED', message: 'This slot has already been booked.' }
    : { code: 'STUDENT_TIME_CONFLICT', message: 'You already have a booking at this hour.' };
}

export function createStudentRouter(database: PrismaClient, clock: () => number, guard: Guard) {
  const router = express.Router();
  const studentOnly = [guard.requireAccount, guard.requireRole('student')];

  router.get('/slots', ...studentOnly, asyncRoute(async (request, response) => {
    const day = bangkokDayRange(request.query.date);
    if (!day) {
      sendError(response, 400, 'INVALID_DATE', 'Choose a date in YYYY-MM-DD format.');
      return;
    }
    const slots = await database.slot.findMany({
      // Only slots that can still be booked: the start is more than 30 minutes away (AC-11, CR-01).
      where: { startAt: { gte: day.start, lt: day.end, gt: new Date(clock() + bookingCutoffMs) }, bookings: { none: { status: CONFIRMED } } },
      include: { machine: { select: { code: true } } },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });
    response.json(slots.map(slot => ({ ...slotView(slot), machineCode: slot.machine.code })));
  }));

  router.post('/bookings', ...studentOnly, asyncRoute(async (request, response) => {
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
    const now = clock();
    if (slot.startAt.getTime() <= now) {
      sendError(response, 409, 'SLOT_ALREADY_STARTED', 'This slot has already started.');
      return;
    }
    // Checked before the insert, so a booked slot inside the window also gets BOOKING_CLOSED (AC-03, CR-01).
    if (slot.startAt.getTime() - bookingCutoffMs <= now) {
      sendError(response, 409, 'BOOKING_CLOSED', 'Booking closes 30 minutes before the slot starts.');
      return;
    }
    try {
      const booking = await database.booking.create({ data: {
        slotId: slot.id, studentId: currentAccount(response).id, slotStartAt: slot.startAt,
      } });
      response.location(`/api/v1/bookings/${booking.id}`).status(201).json({ bookingId: booking.id, slotId: slot.id });
    } catch (error) {
      const conflict = bookingConflict(error);
      if (!conflict) throw error;
      sendError(response, 409, conflict.code, conflict.message);
    }
  }));

  /** F-04 My Bookings: only the signed-in student's bookings, soonest first (AC-18). */
  router.get('/bookings', ...studentOnly, asyncRoute(async (_request, response) => {
    const bookings = await database.booking.findMany({
      where: { studentId: currentAccount(response).id },
      include: bookingInclude,
      orderBy: [{ slotStartAt: 'asc' }, { id: 'asc' }],
    });
    // F-05: cancelled bookings stay in the list as history (FR-06.3).
    response.json(bookings.map(bookingView));
  }));

  router.get('/bookings/:bookingId', ...studentOnly, asyncRoute(async (request, response) => {
    const id = parseBookingId(request.params.bookingId);
    const booking = id === null ? null
      : await database.booking.findFirst({ where: { id, studentId: currentAccount(response).id }, include: bookingInclude });
    if (!booking) {
      sendError(response, 404, 'BOOKING_NOT_FOUND', 'The booking does not exist.');
      return;
    }
    response.json(bookingView(booking));
  }));

  /**
   * F-05 cancel (AC-24 to AC-28). One conditional update decides the outcome, so two cancels
   * cannot both succeed and a booking that started after the first read is never cancelled.
   * `now` comes from the injected clock, not the database clock, so boundary tests stay exact.
   */
  router.post('/bookings/:bookingId/cancel', ...studentOnly, asyncRoute(async (request, response) => {
    const id = parseBookingId(request.params.bookingId);
    const studentId = currentAccount(response).id;
    const now = new Date(clock());
    const changed = id === null ? 0 : (await database.booking.updateMany({
      where: { id, studentId, status: CONFIRMED, slotStartAt: { gt: now } },
      data: { status: 'cancelled', cancelledAt: now },
    })).count;
    const booking = id === null ? null
      : await database.booking.findFirst({ where: { id, studentId }, include: bookingInclude });
    if (!booking) {
      sendError(response, 404, 'BOOKING_NOT_FOUND', 'The booking does not exist.');
      return;
    }
    if (changed === 0) {
      if (booking.status !== CONFIRMED) {
        sendError(response, 409, 'BOOKING_NOT_CONFIRMED', 'This booking is no longer confirmed.');
      } else {
        sendError(response, 409, 'BOOKING_ALREADY_STARTED', 'This booking has already started.');
      }
      return;
    }
    response.json(bookingView(booking));
  }));
  return router;
}
