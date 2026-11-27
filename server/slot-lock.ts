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
