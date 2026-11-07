-- CreateEnum
CREATE TYPE "AttemptState" AS ENUM ('CREATED', 'SUBMITTING', 'ACKNOWLEDGED', 'UNKNOWN', 'FAILED', 'RESOLVED');

-- CreateTable
CREATE TABLE "PayoutAttempt" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "senderBatchId" TEXT NOT NULL,
    "senderItemId" TEXT NOT NULL,
    "paypalPayoutBatchId" TEXT,
    "attemptState" "AttemptState" NOT NULL DEFAULT 'SUBMITTING',
    "requestPayloadRedacted" TEXT NOT NULL,
    "responsePayloadRedacted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAttempt_senderBatchId_key" ON "PayoutAttempt"("senderBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAttempt_senderItemId_key" ON "PayoutAttempt"("senderItemId");

-- CreateIndex
CREATE INDEX "PayoutAttempt_disbursementId_idx" ON "PayoutAttempt"("disbursementId");

-- AddForeignKey
ALTER TABLE "PayoutAttempt" ADD CONSTRAINT "PayoutAttempt_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

