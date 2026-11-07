import { createHash } from "node:crypto";
import type {
  DisbursementRepository,
  LedgerEventRepository,
  PlanVersionRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";
import { InvitationNotFoundError } from "./get-invitation-view";

export interface AcceptPlanResult {
  versionNumber: number;
  planStatus: "BENEFICIARY_ACCEPTED";
}

/**
 * AcceptPlan use case (Slice 3.3, spec §6 Step 5, §10, §9):
 * the beneficiary accepts the latest plan. Creates an immutable
 * PlanVersion v(n+1) copying the latest items verbatim, moves
 * planStatus to BENEFICIARY_ACCEPTED, and logs a LedgerEvent.
 * Payment status is never touched (spec §4.3).
 */
export class AcceptPlan {
  private readonly invitations: RecipientInvitationRepository;
  private readonly disbursements: DisbursementRepository;
  private readonly plans: PlanVersionRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    invitations: RecipientInvitationRepository,
    disbursements: DisbursementRepository,
    plans: PlanVersionRepository,
    ledger: LedgerEventRepository,
  ) {
    this.invitations = invitations;
    this.disbursements = disbursements;
    this.plans = plans;
    this.ledger = ledger;
  }

  async execute(token: string): Promise<AcceptPlanResult> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await this.invitations.findByTokenHash(tokenHash);
    if (
      !invitation ||
      invitation.revokedAt !== null ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new InvitationNotFoundError("This invitation link is not valid.");
    }
    const disbursement = await this.disbursements.findById(invitation.disbursementId);
    if (!disbursement) {
      throw new InvitationNotFoundError("This invitation link is not valid.");
    }
    const latest = await this.plans.findLatestByDisbursementId(disbursement.id);
    if (!latest) {
      throw new Error("No plan to accept.");
    }
    const items = await this.plans.findItemsByVersionId(latest.id);
    const versionNumber = latest.versionNumber + 1;
    const version = await this.plans.create({
      disbursementId: disbursement.id,
      versionNumber,
      createdByType: "BENEFICIARY",
      createdById: null,
      summary: latest.summary,
      status: "BENEFICIARY_ACCEPTED",
      totalAllocatedMinor: latest.totalAllocatedMinor,
      unallocatedMinor: latest.unallocatedMinor,
      requiresClarification: latest.requiresClarification,
    });
    await this.plans.createItems(
      items.map((item, index) => ({
        planVersionId: version.id,
        category: item.category,
        description: item.description,
        amountMinor: item.amountMinor,
        sourceText: item.sourceText,
        sortOrder: index,
      })),
    );
    await this.disbursements.updatePlanStatus(disbursement.id, "BENEFICIARY_ACCEPTED");
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "BENEFICIARY",
      actorId: null,
      eventType: "PLAN_ACCEPTED",
      payloadJson: JSON.stringify({ versionNumber }),
    });
    return { versionNumber, planStatus: "BENEFICIARY_ACCEPTED" };
  }
}
