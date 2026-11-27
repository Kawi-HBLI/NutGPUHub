import type { Prisma } from '@prisma/client';

export type LockedSlot = { id: number; machineId: number; startAt: Date; closedAt: Date | null };

/**
 * Locks one slot row for the rest of the transaction and returns its current state, or null when it
 * does not exist. Booking, reschedule and close take this lock first, so a close and a booking on the
 * same slot run one after the other and the second sees what the first committed (Sprint 2 contract,
 * "Serializing writes"; AC-41).
 */
export async function lockSlot(tx: Prisma.TransactionClient, id: number): Promise<LockedSlot | null> {
  const rows = await tx.$queryRaw<{ id: number; machine_id: number; start_at: Date; closed_at: Date | null }[]>`
    SELECT id, machine_id, start_at, closed_at FROM slots WHERE id = ${id} FOR UPDATE`;
  const row = rows[0];
  return row ? { id: row.id, machineId: row.machine_id, startAt: row.start_at, closedAt: row.closed_at } : null;
}

export type LockedBooking = { id: number; slotId: number; slotStartAt: Date; status: string };

/**
 * Locks one of the student's bookings for the rest of the transaction, or returns null when the
 * student has no booking with that ID. Reschedule takes this lock before the target slot's lock
 * (contract 0.3, "Serializing writes"), so a concurrent cancel or second move of the same booking
 * waits and then sees that the booking is no longer confirmed (AC-35, AC-43).
 */
export async function lockBooking(tx: Prisma.TransactionClient, id: number, studentId: number): Promise<LockedBooking | null> {
  const rows = await tx.$queryRaw<{ id: number; slot_id: number; slot_start_at: Date; status: string }[]>`
    SELECT id, slot_id, slot_start_at, status FROM bookings WHERE id = ${id} AND student_id = ${studentId} FOR UPDATE`;
  const row = rows[0];
  return row ? { id: row.id, slotId: row.slot_id, slotStartAt: row.slot_start_at, status: row.status } : null;
}
