-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('COORDINATOR', 'BENEFICIARY', 'SYSTEM');

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdByType" "ActorType" NOT NULL,
    "createdById" TEXT,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAllocatedMinor" BIGINT NOT NULL,
    "unallocatedMinor" BIGINT NOT NULL,
    "requiresClarification" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amountMinor" BIGINT,
    "sourceText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEvent" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanVersion_disbursementId_idx" ON "PlanVersion"("disbursementId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_disbursementId_versionNumber_key" ON "PlanVersion"("disbursementId", "versionNumber");

-- CreateIndex
CREATE INDEX "PlanItem_planVersionId_idx" ON "PlanItem"("planVersionId");

-- CreateIndex
CREATE INDEX "LedgerEvent_disbursementId_idx" ON "LedgerEvent"("disbursementId");

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEvent" ADD CONSTRAINT "LedgerEvent_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "Disbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

