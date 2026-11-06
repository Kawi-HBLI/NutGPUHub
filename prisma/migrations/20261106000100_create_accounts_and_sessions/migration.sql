BEGIN;

CREATE TYPE "Role" AS ENUM ('student', 'operator');

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
