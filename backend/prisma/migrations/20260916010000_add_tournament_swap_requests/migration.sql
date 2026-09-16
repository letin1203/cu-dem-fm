CREATE TABLE "tournament_swap_requests" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "requesterPlayerId" TEXT NOT NULL,
  "targetPlayerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "tournament_swap_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_swap_requests_tournamentId_requesterPlayerId_targetPlayerId_key"
  ON "tournament_swap_requests"("tournamentId", "requesterPlayerId", "targetPlayerId");
CREATE INDEX "tournament_swap_requests_tournamentId_targetPlayerId_status_idx"
  ON "tournament_swap_requests"("tournamentId", "targetPlayerId", "status");

ALTER TABLE "tournament_swap_requests"
  ADD CONSTRAINT "tournament_swap_requests_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_swap_requests"
  ADD CONSTRAINT "tournament_swap_requests_requesterPlayerId_fkey"
  FOREIGN KEY ("requesterPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_swap_requests"
  ADD CONSTRAINT "tournament_swap_requests_targetPlayerId_fkey"
  FOREIGN KEY ("targetPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
