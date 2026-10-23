-- Add a per-user token version so issued JWTs can be revoked on logout.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
