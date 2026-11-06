-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('en', 'ta', 'hi');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'INVITED', 'BENEFICIARY_ACCEPTED', 'REVISION_PROPOSED', 'COORDINATOR_ACKNOWLEDGED', 'BENEFICIARY_DECLINED_TO_SHARE', 'NO_RESPONSE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_SENT', 'READY', 'SUBMITTING', 'STATUS_UNKNOWN', 'PENDING', 'PROCESSING', 'SUCCESS', 'DENIED', 'FAILED', 'UNCLAIMED', 'RETURNED', 'ON_HOLD', 'BLOCKED', 'REFUNDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('SANDBOX', 'MOCK');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "invitationEmail" TEXT NOT NULL,
    "encryptedPayPalRecipient" TEXT NOT NULL,
    "preferredLanguage" "PreferredLanguage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coordinatorId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "supportNote" TEXT NOT NULL,
    "shareSupportNoteWithBeneficiary" BOOLEAN NOT NULL DEFAULT false,
    "planStatus" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_SENT',
    "paypalPayoutBatchId" TEXT,
    "paypalPayoutItemId" TEXT,
    "paypalBatchStatus" TEXT,
    "paypalItemStatus" TEXT,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'SANDBOX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Beneficiary_organizationId_idx" ON "Beneficiary"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Disbursement_publicReference_key" ON "Disbursement"("publicReference");

-- CreateIndex
CREATE INDEX "Disbursement_organizationId_idx" ON "Disbursement"("organizationId");

-- CreateIndex
CREATE INDEX "Disbursement_organizationId_createdAt_idx" ON "Disbursement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Disbursement_organizationId_paymentStatus_idx" ON "Disbursement"("organizationId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Disbursement_organizationId_planStatus_idx" ON "Disbursement"("organizationId", "planStatus");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

