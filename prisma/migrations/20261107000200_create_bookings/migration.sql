BEGIN;
CREATE UNIQUE INDEX "slots_id_start_at_key" ON "slots"("id", "start_at");
CREATE TABLE "bookings" (
  "id" SERIAL PRIMARY KEY,
  "slot_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "slot_start_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_slot_id_slot_start_at_fkey" FOREIGN KEY ("slot_id", "slot_start_at")
    REFERENCES "slots"("id", "start_at") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
COMMIT;
