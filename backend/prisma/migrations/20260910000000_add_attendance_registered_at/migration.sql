-- Keep a dedicated registration time so attendee lists can be ordered by when a player joined.
ALTER TABLE "tournament_player_attendances" ADD COLUMN "registeredAt" TIMESTAMP(3);

-- Existing attendance records predate this field. Their creation time is the closest available registration time.
UPDATE "tournament_player_attendances"
SET "registeredAt" = "createdAt"
WHERE "status" = 'ATTEND' AND "registeredAt" IS NULL;
