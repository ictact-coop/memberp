-- AlterTable
ALTER TABLE "needs" ADD COLUMN     "followsUpOnNeedId" TEXT;

-- AddForeignKey
ALTER TABLE "needs" ADD CONSTRAINT "needs_followsUpOnNeedId_fkey" FOREIGN KEY ("followsUpOnNeedId") REFERENCES "needs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
