CREATE TABLE "tournament_challenges" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "requesterPlayerId" TEXT NOT NULL,
  "targetPlayerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "tournament_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_challenges_tournamentId_requesterPlayerId_targetPlayerId_key" ON "tournament_challenges"("tournamentId", "requesterPlayerId", "targetPlayerId");
CREATE INDEX "tournament_challenges_tournamentId_status_idx" ON "tournament_challenges"("tournamentId", "status");
ALTER TABLE "tournament_challenges" ADD CONSTRAINT "tournament_challenges_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_challenges" ADD CONSTRAINT "tournament_challenges_requesterPlayerId_fkey" FOREIGN KEY ("requesterPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_challenges" ADD CONSTRAINT "tournament_challenges_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
