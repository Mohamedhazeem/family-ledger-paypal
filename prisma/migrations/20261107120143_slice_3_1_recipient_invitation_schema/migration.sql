-- CreateTable
CREATE TABLE "RecipientInvitation" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "RecipientInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipientInvitation_tokenHash_key" ON "RecipientInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "RecipientInvitation_disbursementId_idx" ON "RecipientInvitation"("disbursementId");

-- AddForeignKey
ALTER TABLE "RecipientInvitation" ADD CONSTRAINT "RecipientInvitation_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

