-- CreateTable
-- ADR-0019 / spec §6 Step 7: coordinator clarification questions.
CREATE TABLE "PlanClarification" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdByType" "ActorType" NOT NULL,
    "createdById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanClarification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanClarification_disbursementId_idx" ON "PlanClarification"("disbursementId");

-- AddForeignKey
ALTER TABLE "PlanClarification" ADD CONSTRAINT "PlanClarification_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
