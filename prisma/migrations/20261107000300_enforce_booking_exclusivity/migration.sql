BEGIN;
CREATE UNIQUE INDEX "bookings_slot_id_key" ON "bookings"("slot_id");
CREATE UNIQUE INDEX "bookings_student_id_slot_start_at_key" ON "bookings"("student_id", "slot_start_at");
COMMIT;
