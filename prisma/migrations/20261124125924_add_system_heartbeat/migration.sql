-- CreateTable
CREATE TABLE "system_heartbeats" (
    "id" TEXT NOT NULL,
    "pingedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_heartbeats_pkey" PRIMARY KEY ("id")
);
