import { toMinorUnits } from "@/domain/value-objects/money";
import type {
  DisbursementRepository,
  LedgerEventRepository,
  PlanVersionRepository,
} from "@/application/ports/db";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}
/** Raised when the amount or plan is changed after a payout exists. */
export class PlanLockedError extends Error {}
/** Raised when the allocations exceed the (possibly new) total. */
export class OverTotalError extends Error {}
/** Raised when the supplied total is not a positive amount. */
export class InvalidTotalError extends Error {}

export interface CoordinatorRevisionItem {
  category: string;
  /** Decimal string, or null to keep the line flexible. */
  amountText: string | null;
}

export interface ProposeCoordinatorRevisionInput {
  coordinatorId: string;
  disbursementId: string;
  /** New full amount as a decimal string; omit to keep the current total. */
  totalText?: string;
  items: CoordinatorRevisionItem[];
}

export interface CoordinatorRevisionResult {
  versionNumber: number;
  planStatus: "REVISION_PROPOSED";
  /** New full amount in minor units, as a string (BigInt-safe JSON). */
  totalMinor: string;
  amountChanged: boolean;
}

/**
 * ProposeCoordinatorRevision use case (ADR-0019): the coordinator
 * adjusts the proposal after a beneficiary suggestion — categories and
 * the full amount — and appends a NEW immutable PlanVersion. The
 * beneficiary's version stays in history untouched.
 *
 * Guard: `paymentStatus === NOT_SENT`. Once a payout exists the amount
 * and plan are locked. Allocations may not exceed the (possibly new)
 * total; the check runs before any write.
 *
 * `planStatus` is set to REVISION_PROPOSED for any pending revision;
 * the version's `createdByType` records who proposed it (ADR-0019).
 */
export class ProposeCoordinatorRevision {
  private readonly disbursements: DisbursementRepository;
  private readonly plans: PlanVersionRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    disbursements: DisbursementRepository,
    plans: PlanVersionRepository,
    ledger: LedgerEventRepository,
  ) {
    this.disbursements = disbursements;
    this.plans = plans;
    this.ledger = ledger;
  }

  async execute(input: ProposeCoordinatorRevisionInput): Promise<CoordinatorRevisionResult> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement || disbursement.deletedAt !== null) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    if (disbursement.paymentStatus !== "NOT_SENT") {
      throw new PlanLockedError(
        "The plan and amount are locked once a payout has been submitted.",
      );
    }

    const totalMinor =
      input.totalText !== undefined
        ? toMinorUnits(input.totalText, disbursement.currency)
        : disbursement.amountMinor;
    if (totalMinor <= 0n) {
      throw new InvalidTotalError("The total must be greater than zero.");
    }

    let totalAllocated = 0n;
    for (const item of input.items) {
      if (item.amountText !== null) {
        totalAllocated += toMinorUnits(item.amountText, disbursement.currency);
      }
    }
    if (totalAllocated > totalMinor) {
      throw new OverTotalError(
        "Allocations exceed the disbursement total. Adjust the plan before saving.",
      );
    }

    const latest = await this.plans.findLatestByDisbursementId(disbursement.id);
    const versionNumber = latest ? latest.versionNumber + 1 : 1;
    const amountChanged = totalMinor !== disbursement.amountMinor;

    if (amountChanged) {
      await this.disbursements.updateAmount(disbursement.id, totalMinor);
      await this.ledger.create({
        disbursementId: disbursement.id,
        actorType: "COORDINATOR",
        actorId: input.coordinatorId,
        eventType: "DISBURSEMENT_AMOUNT_UPDATED",
        payloadJson: JSON.stringify({
          previousMinor: disbursement.amountMinor.toString(),
          newMinor: totalMinor.toString(),
        }),
      });
    }

    const version = await this.plans.create({
      disbursementId: disbursement.id,
      versionNumber,
      createdByType: "COORDINATOR",
      createdById: input.coordinatorId,
      summary: latest?.summary ?? "",
      status: "COORDINATOR_REVISION",
      totalAllocatedMinor: totalAllocated,
      unallocatedMinor: totalMinor - totalAllocated,
      requiresClarification: false,
    });
    await this.plans.createItems(
      input.items.map((item, index) => ({
        planVersionId: version.id,
        category: item.category,
        amountMinor:
          item.amountText === null ? null : toMinorUnits(item.amountText, disbursement.currency),
        sourceText: null,
        sortOrder: index,
      })),
    );

    await this.disbursements.updatePlanStatus(disbursement.id, "REVISION_PROPOSED");
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "PLAN_COORDINATOR_REVISION",
      payloadJson: JSON.stringify({
        versionNumber,
        totalAllocatedMinor: totalAllocated.toString(),
        unallocatedMinor: (totalMinor - totalAllocated).toString(),
        amountChanged,
      }),
    });

    return {
      versionNumber,
      planStatus: "REVISION_PROPOSED",
      totalMinor: totalMinor.toString(),
      amountChanged,
    };
  }
}
