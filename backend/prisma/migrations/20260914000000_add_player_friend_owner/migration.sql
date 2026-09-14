ALTER TABLE "players" ADD COLUMN "friendOwnerId" TEXT;
ALTER TABLE "players" ADD CONSTRAINT "players_friendOwnerId_fkey" FOREIGN KEY ("friendOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "players_friendOwnerId_idx" ON "players"("friendOwnerId");
