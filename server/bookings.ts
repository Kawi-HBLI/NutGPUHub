import { Prisma, type PrismaClient } from '@prisma/client';
import express from 'express';
import { asyncRoute, currentAccount, sendError } from './http.js';
import { slotView } from './machines.js';
import type { createSessionGuard } from './session.js';
import { lockBooking, lockSlot } from './slot-lock.js';
import { bangkokDayRange, bookingCutoffMs } from './time.js';

type Guard = ReturnType<typeof createSessionGuard>;

/** Only confirmed bookings hold a slot and a student's hour (F-05, BR-01, BR-04). */
const CONFIRMED = 'confirmed';
const bookingInclude = {
  slot: { include: { machine: { select: { code: true } } } },
  replacedBy: { select: { id: true } },
} as const;
type BookingRecord = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/**
 * Student booking view (F-04), extended by F-05 with the status and cancellation time and by F-06
 * with the links between a rescheduled booking and its replacement.
 */
function bookingView(booking: BookingRecord) {
  return {
    bookingId: booking.id, ...slotView(booking.slot), machineCode: booking.slot.machine.code,
    status: booking.status, cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    replacesBookingId: booking.replacesBookingId, replacedByBookingId: booking.replacedBy?.id ?? null,
  };
}

type Refusal = { status: number; code: string; message: string };
const refuse = (status: number, code: string, message: string) => ({ refusal: { status, code, message } });

/** A slot ID from a request body, or null when it is not a positive 32-bit integer (F-03, F-06). */
function parseSlotId(raw: unknown) {
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 1 && raw <= 2_147_483_647 ? raw : null;
}

/**
 * Target-slot checks shared by booking (F-03) and reschedule (F-06), in contract order after
 * SLOT_NOT_FOUND: closed, started, then inside the 30-minute cutoff (D-08, CR-01).
 */
function slotRefusal(slot: { startAt: Date; closedAt: Date | null }, now: number) {
  if (slot.closedAt) return refuse(409, 'SLOT_CLOSED', 'This slot has been closed.');
  if (slot.startAt.getTime() <= now) return refuse(409, 'SLOT_ALREADY_STARTED', 'This slot has already started.');
  if (slot.startAt.getTime() - bookingCutoffMs <= now) {
    return refuse(409, 'BOOKING_CLOSED', 'Booking closes 30 minutes before the slot starts.');
  }
  return null;
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
      // F-07: closed slots are never offered (AC-38).
      where: { startAt: { gte: day.start, lt: day.end, gt: new Date(clock() + bookingCutoffMs) }, closedAt: null, bookings: { none: { status: CONFIRMED } } },
      include: { machine: { select: { code: true } } },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });
    response.json(slots.map(slot => ({ ...slotView(slot), machineCode: slot.machine.code })));
  }));

  router.post('/bookings', ...studentOnly, asyncRoute(async (request, response) => {
    const slotId = parseSlotId(request.body?.slotId);
    if (slotId === null) {
      sendError(response, 400, 'INVALID_SLOT_ID', 'Choose a valid slot.');
      return;
    }
    const now = clock();
    const studentId = currentAccount(response).id;
    let outcome: { refusal: Refusal } | { bookingId: number };
    try {
      // F-07: lock the slot first so a concurrent close and this booking cannot both succeed (AC-41).
      outcome = await database.$transaction(async tx => {
        const slot = await lockSlot(tx, slotId);
        if (!slot) return refuse(404, 'SLOT_NOT_FOUND', 'The slot does not exist.');
        // Checked before the insert, so a booked slot inside the window also gets BOOKING_CLOSED (AC-03, CR-01).
        const refusal = slotRefusal(slot, now);
        if (refusal) return refusal;
        const booking = await tx.booking.create({ data: { slotId: slot.id, studentId, slotStartAt: slot.startAt } });
        return { bookingId: booking.id };
      });
    } catch (error) {
      const conflict = bookingConflict(error);
      if (!conflict) throw error;
      sendError(response, 409, conflict.code, conflict.message);
      return;
    }
    if ('refusal' in outcome) {
      sendError(response, outcome.refusal.status, outcome.refusal.code, outcome.refusal.message);
      return;
    }
    response.location(`/api/v1/bookings/${outcome.bookingId}`).status(201).json({ bookingId: outcome.bookingId, slotId });
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

  /**
   * F-06 reschedule (AC-30 to AC-36, AC-42 to AC-44). One transaction locks the original booking,
   * then the target slot, checks both, marks the original rescheduled and inserts the replacement.
   * The explicit conflict checks run before any write, so a swap or cross-move between two
   * transactions returns 409 instead of deadlocking (contract 0.3, "Serializing writes").
   */
  router.post('/bookings/:bookingId/reschedule', ...studentOnly, asyncRoute(async (request, response) => {
    // The body is validated first, as in F-03, so a bad slot ID never reveals whether a booking exists.
    const slotId = parseSlotId(request.body?.slotId);
    if (slotId === null) {
      sendError(response, 400, 'INVALID_SLOT_ID', 'Choose a valid slot.');
      return;
    }
    const id = parseBookingId(request.params.bookingId);
    if (id === null) {
      sendError(response, 404, 'BOOKING_NOT_FOUND', 'The booking does not exist.');
      return;
    }
    const now = clock();
    const studentId = currentAccount(response).id;
    let outcome: { refusal: Refusal } | { bookingId: number; replacesBookingId: number };
    try {
      outcome = await database.$transaction(async tx => {
        const original = await lockBooking(tx, id, studentId);
        if (!original) return refuse(404, 'BOOKING_NOT_FOUND', 'The booking does not exist.');
        if (original.status !== CONFIRMED) return refuse(409, 'BOOKING_NOT_CONFIRMED', 'This booking is no longer confirmed.');
        if (original.slotStartAt.getTime() <= now) return refuse(409, 'BOOKING_ALREADY_STARTED', 'This booking has already started.');
        const slot = await lockSlot(tx, slotId);
        if (!slot) return refuse(404, 'SLOT_NOT_FOUND', 'The slot does not exist.');
        if (slot.id === original.slotId) return refuse(409, 'SAME_SLOT', 'Choose a different slot.');
        const refusal = slotRefusal(slot, now);
        if (refusal) return refusal;
        if (await tx.booking.count({ where: { slotId, status: CONFIRMED } }) > 0) {
          return refuse(409, 'SLOT_ALREADY_BOOKED', 'This slot has already been booked.');
        }
        // The original is excluded, so a move to another machine at the same hour is allowed (AC-32).
        const sameHour = { studentId, slotStartAt: slot.startAt, status: CONFIRMED, id: { not: original.id } };
        if (await tx.booking.count({ where: sameHour }) > 0) {
          return refuse(409, 'STUDENT_TIME_CONFLICT', 'You already have a booking at this hour.');
        }
        await tx.booking.update({ where: { id: original.id }, data: { status: 'rescheduled' } });
        const replacement = await tx.booking.create({
          data: { slotId, studentId, slotStartAt: slot.startAt, replacesBookingId: original.id },
        });
        return { bookingId: replacement.id, replacesBookingId: original.id };
      });
    } catch (error) {
      // The indexes still catch two moves of one student into one hour on different machines.
      const conflict = bookingConflict(error);
      if (!conflict) throw error;
      sendError(response, 409, conflict.code, conflict.message);
      return;
    }
    if ('refusal' in outcome) {
      sendError(response, outcome.refusal.status, outcome.refusal.code, outcome.refusal.message);
      return;
    }
    response.location(`/api/v1/bookings/${outcome.bookingId}`).status(201)
      .json({ bookingId: outcome.bookingId, slotId, replacesBookingId: outcome.replacesBookingId });
  }));
  return router;
}
