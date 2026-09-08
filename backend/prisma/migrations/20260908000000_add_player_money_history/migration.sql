-- CreateTable
CREATE TABLE "player_money_history" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_money_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_money_history_playerId_createdAt_idx" ON "player_money_history"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "player_money_history_tournamentId_idx" ON "player_money_history"("tournamentId");

-- AddForeignKey
ALTER TABLE "player_money_history" ADD CONSTRAINT "player_money_history_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_money_history" ADD CONSTRAINT "player_money_history_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
