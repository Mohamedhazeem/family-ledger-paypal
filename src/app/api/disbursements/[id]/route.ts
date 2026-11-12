import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { visibleTimeline } from "@/domain/timeline";
import {
  CoordinatorMismatchError,
  DeleteDisbursement,
  DisbursementNotFoundError,
  NotDeletableError,
} from "@/application/use-cases/delete-disbursement";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";

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
  if (!disbursement || disbursement.deletedAt !== null || disbursement.coordinatorId !== session.user.id) {
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
        }, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
      ),
    ),
  );
}

/**
 * DELETE /api/disbursements/[id] (ADR-0018): soft-delete a draft that was
 * never sent. Coordinator-only. The row is kept so the append-only
 * LedgerEvent history survives; active invitations are revoked first.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!isSameOrigin(request)) {
    return withSecurityHeaders(NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }));
  }
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const { id } = await context.params;
  try {
    const result = await new DeleteDisbursement(
      new PrismaDisbursementRepository(),
      new PrismaRecipientInvitationRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });
    return withSecurityHeaders(
      NextResponse.json({
        id: result.id,
        publicReference: result.publicReference,
        deletedAt: result.deletedAt.toISOString(),
      }),
    );
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    if (error instanceof NotDeletableError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 409 }));
    }
    return withSecurityHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not delete the disbursement" },
        { status: 500 },
      ),
    );
  }
}
