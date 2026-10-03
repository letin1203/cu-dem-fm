CREATE TABLE "tournament_friend_invites" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "requesterPlayerId" TEXT NOT NULL,
  "targetPlayerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "tournament_friend_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_friend_invites_tournamentId_requesterPlayerId_targetPlayerId_key" ON "tournament_friend_invites"("tournamentId", "requesterPlayerId", "targetPlayerId");
CREATE INDEX "tournament_friend_invites_tournamentId_status_idx" ON "tournament_friend_invites"("tournamentId", "status");
ALTER TABLE "tournament_friend_invites" ADD CONSTRAINT "tournament_friend_invites_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_friend_invites" ADD CONSTRAINT "tournament_friend_invites_requesterPlayerId_fkey" FOREIGN KEY ("requesterPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_friend_invites" ADD CONSTRAINT "tournament_friend_invites_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
