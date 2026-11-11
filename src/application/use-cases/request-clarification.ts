import type {
  DisbursementRepository,
  LedgerEventRepository,
  PlanClarificationRepository,
  PlanClarificationRecord,
} from "@/application/ports/db";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}
export class EmptyQuestionError extends Error {}

export interface RequestClarificationInput {
  coordinatorId: string;
  disbursementId: string;
  question: string;
}

/**
 * RequestClarification use case (spec §6 Step 7, ADR-0019): the
 * coordinator asks the beneficiary one clarification question. The
 * question is stored for the portal (latest unanswered is shown) and a
 * `PLAN_CLARIFICATION_REQUESTED` ledger event is appended. The plan
 * status and payment status are never touched.
 */
export class RequestClarification {
  private readonly disbursements: DisbursementRepository;
  private readonly clarifications: PlanClarificationRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    disbursements: DisbursementRepository,
    clarifications: PlanClarificationRepository,
    ledger: LedgerEventRepository,
  ) {
    this.disbursements = disbursements;
    this.clarifications = clarifications;
    this.ledger = ledger;
  }

  async execute(input: RequestClarificationInput): Promise<PlanClarificationRecord> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement || disbursement.deletedAt !== null) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    const question = input.question.trim();
    if (!question) {
      throw new EmptyQuestionError("Enter a question.");
    }

    const clarification = await this.clarifications.create({
      disbursementId: disbursement.id,
      question,
      createdByType: "COORDINATOR",
      createdById: input.coordinatorId,
    });
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "PLAN_CLARIFICATION_REQUESTED",
      payloadJson: JSON.stringify({ clarificationId: clarification.id }),
    });
    return clarification;
  }
}
