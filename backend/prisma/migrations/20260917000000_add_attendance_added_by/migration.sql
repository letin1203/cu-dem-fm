ALTER TABLE "tournament_player_attendances"
  ADD COLUMN "addedById" TEXT;

ALTER TABLE "tournament_player_attendances"
  ADD CONSTRAINT "tournament_player_attendances_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tournament_player_attendances_addedById_idx"
  ON "tournament_player_attendances"("addedById");
