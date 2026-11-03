-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "withdrawalRequestReason" TEXT,
ADD COLUMN     "withdrawalRequestedAt" TIMESTAMP(3);
