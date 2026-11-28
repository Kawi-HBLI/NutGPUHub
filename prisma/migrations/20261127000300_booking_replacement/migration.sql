-- F-06 (#13), Sprint 2 contract 0.3: a reschedule inserts a replacement booking that points to
-- the booking it replaces. UNIQUE means a booking is replaced at most once; RESTRICT keeps an
-- original from being deleted while its replacement still refers to it.
ALTER TABLE "bookings" ADD COLUMN "replaces_booking_id" INTEGER;
CREATE UNIQUE INDEX "bookings_replaces_booking_id_key" ON "bookings"("replaces_booking_id");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_replaces_booking_id_fkey"
  FOREIGN KEY ("replaces_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
