-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "fromSubjectId" TEXT NOT NULL,
    "toSubjectId" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,
    "role" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relationships_fromSubjectId_idx" ON "relationships"("fromSubjectId");

-- CreateIndex
CREATE INDEX "relationships_toSubjectId_idx" ON "relationships"("toSubjectId");

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_fromSubjectId_fkey" FOREIGN KEY ("fromSubjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_toSubjectId_fkey" FOREIGN KEY ("toSubjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "classifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
