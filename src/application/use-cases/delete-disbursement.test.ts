/**
 * DeleteDisbursement use case (ADR-0018): only drafts that were never
 * sent can be soft-deleted; active invitations are revoked first and
 * the append-only ledger records the deletion. Repositories are stubbed.
 */
import { describe, expect, it } from "vitest";
import { DeleteDisbursement } from "./delete-disbursement";
import type {
  DisbursementRecord,
  LedgerEventInput,
  RecipientInvitationRecord,
  RecipientInvitationRepository,
} from "@/application/ports/db";

function makeDisbursement(overrides: Partial<DisbursementRecord> = {}): DisbursementRecord {
  return {
    id: "d-1",
    publicReference: "FL-DRAFT-001",
    organizationId: "org-1",
    coordinatorId: "coord-1",
    beneficiaryId: "b-1",
    amountMinor: 50000n,
    currency: "USD",
    supportNote: "note",
    shareSupportNoteWithBeneficiary: false,
    planStatus: "DRAFT",
    paymentStatus: "NOT_SENT",
    paypalPayoutBatchId: null,
    paypalPayoutItemId: null,
    paypalBatchStatus: null,
    paypalItemStatus: null,
    paymentMode: "SANDBOX",
    deletedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function stubDeps(disbursement: DisbursementRecord) {
  const deleted: Date[] = [];
  const disbursements = {
    findById: async () => disbursement,
    softDelete: async (_id: string, at: Date) => {
      deleted.push(at);
      disbursement.deletedAt = at;
      return disbursement;
    },
  };
  const invitations = new FakeInvitations();
  const events: LedgerEventInput[] = [];
  const ledger = {
    create: async (input: LedgerEventInput) => {
      events.push(input);
      return { id: `evt-${events.length}`, createdAt: new Date(0), ...input };
    },
  };
  return { disbursements, invitations, ledger, deleted, events };
}

class FakeInvitations implements RecipientInvitationRepository {
  readonly rows: RecipientInvitationRecord[] = [];
  private seq = 0;

  seed(overrides: Partial<RecipientInvitationRecord> = {}) {
    this.rows.push({
      id: `inv-${++this.seq}`,
      disbursementId: "d-1",
      tokenHash: `hash-${this.seq}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      createdAt: new Date(0),
      lastViewedAt: null,
      ...overrides,
    });
  }

  async create(_input: never): Promise<RecipientInvitationRecord> {
    throw new Error("unused");
  }
  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async findByTokenHash(tokenHash: string) {
    return this.rows.find((r) => r.tokenHash === tokenHash) ?? null;
  }
  async listByDisbursementId(disbursementId: string) {
    return this.rows.filter((r) => r.disbursementId === disbursementId);
  }
  async revoke(id: string, revokedAt: Date) {
    const row = this.rows.find((r) => r.id === id)!;
    row.revokedAt = revokedAt;
    return row;
  }
  async markViewed() {}
}

function makeUseCase(deps: ReturnType<typeof stubDeps>) {
  return new DeleteDisbursement(
    deps.disbursements as never,
    deps.invitations,
    deps.ledger as never,
    { now: () => 1_000_000, date: () => new Date(1_000_000) },
  );
}

const INPUT = { coordinatorId: "coord-1", disbursementId: "d-1" };

describe("DeleteDisbursement (ADR-0018)", () => {
  it("soft-deletes a NOT_SENT draft and logs DISBURSEMENT_DELETED", async () => {
    const deps = stubDeps(makeDisbursement());
    const result = await makeUseCase(deps).execute(INPUT);

    expect(deps.deleted).toHaveLength(1);
    expect(result.deletedAt.getTime()).toBe(1_000_000);
    expect(result.publicReference).toBe("FL-DRAFT-001");
    const event = deps.events.find((e) => e.eventType === "DISBURSEMENT_DELETED");
    expect(event).toBeDefined();
    expect(event!.payloadJson).not.toContain("note");
  });

  it("blocks a disbursement that has been sent", async () => {
    const deps = stubDeps(makeDisbursement({ paymentStatus: "SUCCESS" }));
    await expect(makeUseCase(deps).execute(INPUT)).rejects.toThrow(/never been sent/i);
    expect(deps.deleted).toHaveLength(0);
  });

  it("blocks a disbursement that is ready to send", async () => {
    const deps = stubDeps(makeDisbursement({ paymentStatus: "READY" }));
    await expect(makeUseCase(deps).execute(INPUT)).rejects.toThrow(/never been sent/i);
  });

  it("blocks a coordinator who does not own the disbursement", async () => {
    const deps = stubDeps(makeDisbursement());
    await expect(
      makeUseCase(deps).execute({ ...INPUT, coordinatorId: "coord-2" }),
    ).rejects.toThrow("Not your disbursement.");
    expect(deps.deleted).toHaveLength(0);
  });

  it("treats an already deleted disbursement as not found", async () => {
    const deps = stubDeps(makeDisbursement({ deletedAt: new Date(1) }));
    await expect(makeUseCase(deps).execute(INPUT)).rejects.toThrow("Disbursement not found.");
  });

  it("revokes active invitations before deleting", async () => {
    const deps = stubDeps(makeDisbursement());
    deps.invitations.seed(); // active
    deps.invitations.seed({ revokedAt: new Date(1) }); // already revoked
    deps.invitations.seed({ expiresAt: new Date(1) }); // already expired

    await makeUseCase(deps).execute(INPUT);

    const [active, revoked, expired] = deps.invitations.rows;
    expect(active!.revokedAt).not.toBeNull();
    expect(revoked!.revokedAt?.getTime()).toBe(1);
    expect(expired!.revokedAt).toBeNull();
    const revokeEvents = deps.events.filter((e) => e.eventType === "INVITATION_REVOKED");
    expect(revokeEvents).toHaveLength(1);
    expect(revokeEvents[0]!.payloadJson).toContain("DISBURSEMENT_DELETED");
  });
});
