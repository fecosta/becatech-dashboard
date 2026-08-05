-- CreateTable
CREATE TABLE "SyncLock" (
    "name" TEXT NOT NULL,
    "holder" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("name")
);
