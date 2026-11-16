-- Automatic weekly registration preferences.
-- Disabled by default; the player enables it from their profile and must pick
-- at least one pitch, otherwise nothing is registered.
ALTER TABLE "players" ADD COLUMN "autoRegisterEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "players" ADD COLUMN "autoRegisterField5" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "players" ADD COLUMN "autoRegisterField7" BOOLEAN NOT NULL DEFAULT false;
