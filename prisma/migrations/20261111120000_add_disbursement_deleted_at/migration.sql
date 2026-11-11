-- AlterTable
-- Soft delete for drafts that were never sent (ADR-0018). Rows are kept
-- so the append-only LedgerEvent history (ADR-0009) and all audit data
-- survive; read surfaces filter `deletedAt: null`.
ALTER TABLE "Disbursement" ADD COLUMN     "deletedAt" TIMESTAMP(3);
