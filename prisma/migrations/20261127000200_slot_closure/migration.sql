-- F-07 (#14): a slot can be closed once and never reopened (D-13).
ALTER TABLE "slots" ADD COLUMN "closed_at" TIMESTAMPTZ(3);
