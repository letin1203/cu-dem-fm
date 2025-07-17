-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "loserId" TEXT;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
