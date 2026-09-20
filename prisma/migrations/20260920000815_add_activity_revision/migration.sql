-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "revisionOfId" TEXT,
ADD COLUMN     "supersededByActivityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activities_supersededByActivityId_key" ON "activities"("supersededByActivityId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
