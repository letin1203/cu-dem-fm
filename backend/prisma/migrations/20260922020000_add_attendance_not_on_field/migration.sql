-- A player can be checked in to the tournament without taking a place on the pitch.
ALTER TABLE "tournament_player_attendances"
ADD COLUMN "notOnField" BOOLEAN NOT NULL DEFAULT false;
