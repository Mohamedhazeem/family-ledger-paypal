import { createHash } from "node:crypto";
import { toMinorUnits } from "@/domain/value-objects/money";
import type {
  DisbursementRepository,
  LedgerEventRepository,
  PlanClarificationRepository,
  PlanVersionRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";
import { InvitationNotFoundError } from "./get-invitation-view";

export interface RevisionDraftItem {
  category: string;
  amountText: string | null;
  description?: string | null;
}

export interface ProposeRevisionInput {
  items: RevisionDraftItem[];
  /** Optional beneficiary explanation, stored on the new version. */
  explanation?: string | null;
}

export interface ProposeRevisionResult {
  versionNumber: number;
  planStatus: "REVISION_PROPOSED";
}

/**
 * ProposeRevision use case (Slice 3.4, spec §6 Step 5): the
 * beneficiary suggests changes. Creates an immutable PlanVersion
 * v(n+1) with the proposed items, stores the optional explanation,
 * moves planStatus to REVISION_PROPOSED, and logs a LedgerEvent.
 * Over-total revisions are rejected before any write (spec §6);
 * payment status is never touched.
 */
export class ProposeRevision {
  private readonly invitations: RecipientInvitationRepository;
  private readonly disbursements: DisbursementRepository;
  private readonly plans: PlanVersionRepository;
  private readonly ledger: LedgerEventRepository;
  private readonly clarifications: PlanClarificationRepository;

  constructor(
    invitations: RecipientInvitationRepository,
    disbursements: DisbursementRepository,
    plans: PlanVersionRepository,
    ledger: LedgerEventRepository,
    clarifications: PlanClarificationRepository,
  ) {
    this.invitations = invitations;
    this.disbursements = disbursements;
    this.plans = plans;
    this.ledger = ledger;
    this.clarifications = clarifications;
  }

  async execute(token: string, input: ProposeRevisionInput): Promise<ProposeRevisionResult> {
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
      throw new Error("No plan to revise.");
    }

    let totalAllocated = 0n;
    for (const item of input.items) {
      if (item.amountText !== null) {
        totalAllocated += toMinorUnits(item.amountText, disbursement.currency);
      }
    }
    if (totalAllocated > disbursement.amountMinor) {
      throw new Error("Allocations exceed the disbursement total. Adjust the plan before submitting.");
    }

    const versionNumber = latest.versionNumber + 1;
    const version = await this.plans.create({
      disbursementId: disbursement.id,
      versionNumber,
      createdByType: "BENEFICIARY",
      createdById: null,
      summary: latest.summary,
      explanation: input.explanation ?? null,
      status: "REVISION_PROPOSED",
      totalAllocatedMinor: totalAllocated,
      unallocatedMinor: disbursement.amountMinor - totalAllocated,
      requiresClarification: false,
    });
    await this.plans.createItems(
      input.items.map((item, index) => ({
        planVersionId: version.id,
        category: item.category,
        description: item.description ?? null,
        amountMinor:
          item.amountText === null ? null : toMinorUnits(item.amountText, disbursement.currency),
        sourceText: null,
        sortOrder: index,
      })),
    );
    await this.disbursements.updatePlanStatus(disbursement.id, "REVISION_PROPOSED");
    // The beneficiary's new suggestion answers the pending question, if any.
    const pending = await this.clarifications.findLatestUnansweredByDisbursementId(disbursement.id);
    if (pending) {
      await this.clarifications.markResponded(pending.id, new Date());
    }
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "BENEFICIARY",
      actorId: null,
      eventType: "PLAN_REVISION_PROPOSED",
      payloadJson: JSON.stringify({ versionNumber, itemCount: input.items.length }),
    });
    return { versionNumber, planStatus: "REVISION_PROPOSED" };
  }
}
