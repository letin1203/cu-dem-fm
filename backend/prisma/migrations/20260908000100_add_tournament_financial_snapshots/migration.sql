-- Preserve the financial settings that were in effect when a tournament ended.
ALTER TABLE "tournaments" ADD COLUMN "sponsorMoney" INTEGER;
ALTER TABLE "tournaments" ADD COLUMN "stadiumCost" INTEGER;
