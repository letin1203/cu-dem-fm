CREATE TABLE "tournament_deadmatch_entries" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "opponentTeamId" TEXT NOT NULL,
  "queueNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "matchKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "matchedAt" TIMESTAMP(3),
  CONSTRAINT "tournament_deadmatch_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_deadmatch_entries_tournamentId_playerId_opponentTeamId_key"
  ON "tournament_deadmatch_entries"("tournamentId", "playerId", "opponentTeamId");
CREATE INDEX "tournament_deadmatch_entries_tournamentId_teamId_opponentTeamId_status_queueNumber_idx"
  ON "tournament_deadmatch_entries"("tournamentId", "teamId", "opponentTeamId", "status", "queueNumber");
CREATE INDEX "tournament_deadmatch_entries_tournamentId_matchKey_idx"
  ON "tournament_deadmatch_entries"("tournamentId", "matchKey");

ALTER TABLE "tournament_deadmatch_entries"
  ADD CONSTRAINT "tournament_deadmatch_entries_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_deadmatch_entries"
  ADD CONSTRAINT "tournament_deadmatch_entries_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
