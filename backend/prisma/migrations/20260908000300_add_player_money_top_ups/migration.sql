CREATE TABLE "player_money_top_ups" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "player_money_top_ups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "player_money_top_ups_status_requestedAt_idx"
ON "player_money_top_ups"("status", "requestedAt");

ALTER TABLE "player_money_top_ups"
ADD CONSTRAINT "player_money_top_ups_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
