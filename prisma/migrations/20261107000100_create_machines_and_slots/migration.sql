BEGIN;

CREATE TABLE "gpu_machines" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "operator_id" INTEGER NOT NULL,
    CONSTRAINT "gpu_machines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "slots" (
    "id" SERIAL NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "slots_pkey" PRIMARY KEY ("id"),
    -- BR-01: slots start on the hour. Bangkok is UTC+7, so a whole UTC hour is a whole Bangkok hour.
    CONSTRAINT "slots_start_on_the_hour" CHECK (date_trunc('hour', "start_at") = "start_at")
);

CREATE UNIQUE INDEX "gpu_machines_code_key" ON "gpu_machines"("code");
CREATE INDEX "gpu_machines_operator_id_idx" ON "gpu_machines"("operator_id");
CREATE UNIQUE INDEX "slots_machine_id_start_at_key" ON "slots"("machine_id", "start_at");

ALTER TABLE "gpu_machines" ADD CONSTRAINT "gpu_machines_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "slots" ADD CONSTRAINT "slots_machine_id_fkey"
  FOREIGN KEY ("machine_id") REFERENCES "gpu_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
