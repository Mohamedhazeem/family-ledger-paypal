import type {
  DisbursementRepository,
  LedgerEventRepository,
} from "@/application/ports/db";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}

export interface AcknowledgePlanResult {
  planStatus: "COORDINATOR_ACKNOWLEDGED";
}

/**
 * AcknowledgePlan use case (Slice 3.7, spec §6 Step 7):
 * the coordinator acknowledges the beneficiary's plan. Sets
 * planStatus=COORDINATOR_ACKNOWLEDGED and logs a LedgerEvent.
 * Payment status is never touched — acknowledgement is not a
 * release condition (spec §4.4).
 */
export class AcknowledgePlan {
  private readonly disbursements: DisbursementRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(disbursements: DisbursementRepository, ledger: LedgerEventRepository) {
    this.disbursements = disbursements;
    this.ledger = ledger;
  }

  async execute(input: { coordinatorId: string; disbursementId: string }): Promise<AcknowledgePlanResult> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    await this.disbursements.updatePlanStatus(disbursement.id, "COORDINATOR_ACKNOWLEDGED");
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "PLAN_ACKNOWLEDGED",
      payloadJson: JSON.stringify({ planStatus: "COORDINATOR_ACKNOWLEDGED" }),
    });
    return { planStatus: "COORDINATOR_ACKNOWLEDGED" };
  }
}
