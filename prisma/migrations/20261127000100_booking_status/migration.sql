-- F-05 (#12), Sprint 2 contract 0.3: keep cancelled bookings as history.
-- The Sprint 1 unique indexes become partial indexes over confirmed bookings only, so a slot
-- and a student's hour stay exclusive (BR-01, BR-04) while cancelled rows remain. Prisma's
-- schema language cannot declare partial indexes; this migration is their source of truth.
BEGIN;
ALTER TABLE "bookings" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" TIMESTAMPTZ(3);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check"
  CHECK ("status" IN ('confirmed', 'cancelled', 'rescheduled'));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_at_check"
  CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL));
DROP INDEX "bookings_slot_id_key";
DROP INDEX "bookings_student_id_slot_start_at_key";
CREATE UNIQUE INDEX "bookings_confirmed_slot_key" ON "bookings"("slot_id") WHERE "status" = 'confirmed';
CREATE UNIQUE INDEX "bookings_confirmed_student_hour_key" ON "bookings"("student_id", "slot_start_at")
  WHERE "status" = 'confirmed';
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");
COMMIT;
