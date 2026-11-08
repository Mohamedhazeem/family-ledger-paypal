import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { visibleTimeline } from "@/domain/timeline";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";

/**
 * GET /api/disbursements/[id] (spec §8): coordinator-only detail —
 * disbursement (BigInt-safe), plan versions with items, invitations
 * metadata, and the role-filtered shared timeline. Never exposes the
 * encrypted PayPal recipient email or token hashes.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const { id } = await context.params;
  const disbursement = await prisma.disbursement.findUnique({
    where: { id },
    include: { beneficiary: true },
  });
  if (!disbursement || disbursement.coordinatorId !== session.user.id) {
    return withSecurityHeaders(NextResponse.json({ error: "Disbursement not found" }, { status: 404 }));
  }
  const versions = await prisma.planVersion.findMany({
    where: { disbursementId: id },
    orderBy: { versionNumber: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  const invitations = await prisma.recipientInvitation.findMany({
    where: { disbursementId: id },
    orderBy: { createdAt: "desc" },
  });
  const ledgerEvents = await prisma.ledgerEvent.findMany({
    where: { disbursementId: id },
    orderBy: { createdAt: "asc" },
  });
  const timeline = visibleTimeline(ledgerEvents, "coordinator");
  return withSecurityHeaders(
    NextResponse.json(
      JSON.parse(
        JSON.stringify({
          disbursement: {
            id: disbursement.id,
            publicReference: disbursement.publicReference,
            organizationId: disbursement.organizationId,
            coordinatorId: disbursement.coordinatorId,
            beneficiaryId: disbursement.beneficiaryId,
            amountMinor: disbursement.amountMinor,
            currency: disbursement.currency,
            supportNote: disbursement.supportNote,
            planStatus: disbursement.planStatus,
            paymentStatus: disbursement.paymentStatus,
            paypalPayoutBatchId: disbursement.paypalPayoutBatchId,
            paypalPayoutItemId: disbursement.paypalPayoutItemId,
            paypalBatchStatus: disbursement.paypalBatchStatus,
            paypalItemStatus: disbursement.paypalItemStatus,
            paymentMode: disbursement.paymentMode,
            beneficiary: {
              displayName: disbursement.beneficiary.displayName,
              preferredLanguage: disbursement.beneficiary.preferredLanguage,
            },
          },
          versions: versions.map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
            createdByType: version.createdByType,
            summary: version.summary,
            status: version.status,
            totalAllocatedMinor: version.totalAllocatedMinor,
            unallocatedMinor: version.unallocatedMinor,
            requiresClarification: version.requiresClarification,
            items: version.items.map((item) => ({
              category: item.category,
              amountMinor: item.amountMinor,
              sortOrder: item.sortOrder,
            })),
          })),
          invitations: invitations.map((invitation) => ({
            id: invitation.id,
            expiresAt: invitation.expiresAt,
            revokedAt: invitation.revokedAt,
            lastViewedAt: invitation.lastViewedAt,
          })),
          timeline,
        }),
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      ),
    ),
  );
}
