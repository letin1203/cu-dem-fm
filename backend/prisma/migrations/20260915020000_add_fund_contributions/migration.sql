CREATE TABLE "fund_contributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "fund_contributions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fund_contributions_status_requestedAt_idx" ON "fund_contributions"("status", "requestedAt");

ALTER TABLE "fund_contributions" ADD CONSTRAINT "fund_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
