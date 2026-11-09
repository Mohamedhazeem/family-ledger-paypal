/**
 * CreateInvitation use case (Slice 3.1): token hashing, ledger event, and
 * the regenerate pattern — creating a new invitation auto-revokes the
 * disbursement's other still-active invitations (one live link at a time).
 * Repositories are stubbed; no DB here.
 */
import { describe, expect, it } from "vitest";
import { CreateInvitation } from "./create-invitation";
import type {
  DisbursementRepository,
  LedgerEventInput,
  RecipientInvitationInput,
  RecipientInvitationRecord,
  RecipientInvitationRepository,
} from "@/application/ports/db";

function stubDisbursements(): DisbursementRepository {
  return {
    findById: async (id: string) =>
      id === "d-1"
        ? {
            id: "d-1",
            coordinatorId: "c-1",
          }
        : null,
  } as unknown as DisbursementRepository;
}

class FakeInvitations implements RecipientInvitationRepository {
  readonly rows: RecipientInvitationRecord[] = [];
  readonly revokedIds: string[] = [];
  private seq = 0;

  seed(overrides: Partial<RecipientInvitationRecord> = {}) {
    this.rows.push({
      id: `inv-${++this.seq}`,
      disbursementId: "d-1",
      tokenHash: `hash-${this.seq}`,
      expiresAt: new Date(7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(0),
      lastViewedAt: null,
      ...overrides,
    });
  }

  async create(input: RecipientInvitationInput): Promise<RecipientInvitationRecord> {
    const record: RecipientInvitationRecord = {
      id: `inv-${++this.seq}`,
      revokedAt: null,
      lastViewedAt: null,
      createdAt: new Date(0),
      ...input,
    };
    this.rows.push(record);
    return record;
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
    this.revokedIds.push(id);
    const row = this.rows.find((r) => r.id === id)!;
    row.revokedAt = revokedAt;
    return row;
  }
  async markViewed() {}
}

class FakeLedger {
  readonly events: LedgerEventInput[] = [];
  async create(input: LedgerEventInput) {
    this.events.push(input);
    return { id: `evt-${this.events.length}`, createdAt: new Date(0), ...input };
  }
}

function makeUseCase(invitations: FakeInvitations, ledger: FakeLedger) {
  return new CreateInvitation(
    stubDisbursements(),
    invitations,
    ledger as never,
    { now: () => 1_000_000, date: () => new Date(1_000_000) },
  );
}

describe("CreateInvitation", () => {
  it("stores only the token hash and logs a ledger event", async () => {
    const invitations = new FakeInvitations();
    const ledger = new FakeLedger();

    const result = await makeUseCase(invitations, ledger).execute({
      coordinatorId: "c-1",
      disbursementId: "d-1",
    });

    expect(invitations.rows).toHaveLength(1);
    expect(result.token).toBeTruthy();
    // Token stored as SHA-256 hash, never plaintext.
    expect(invitations.rows[0]!.tokenHash).not.toBe(result.token);
    expect(invitations.rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger.events.map((e) => e.eventType)).toEqual(["INVITATION_CREATED"]);
  });

  it("auto-revokes previously active invitations for the same disbursement", async () => {
    const invitations = new FakeInvitations();
    invitations.seed(); // existing active invitation
    const ledger = new FakeLedger();

    await makeUseCase(invitations, ledger).execute({
      coordinatorId: "c-1",
      disbursementId: "d-1",
    });

    expect(invitations.revokedIds).toEqual(["inv-1"]);
    expect(invitations.rows[0]!.revokedAt).not.toBeNull();
    // The new invitation itself stays active.
    expect(invitations.rows[1]!.revokedAt).toBeNull();
  });

  it("leaves already revoked or expired invitations untouched", async () => {
    const invitations = new FakeInvitations();
    invitations.seed({ revokedAt: new Date(1) });
    invitations.seed({ expiresAt: new Date(1) }); // already expired
    const ledger = new FakeLedger();

    await makeUseCase(invitations, ledger).execute({
      coordinatorId: "c-1",
      disbursementId: "d-1",
    });

    expect(invitations.revokedIds).toEqual([]);
  });

  it("does not revoke other disbursements' invitations", async () => {
    const invitations = new FakeInvitations();
    invitations.seed({ disbursementId: "d-other" });
    const ledger = new FakeLedger();

    await makeUseCase(invitations, ledger).execute({
      coordinatorId: "c-1",
      disbursementId: "d-1",
    });

    expect(invitations.revokedIds).toEqual([]);
  });

  it("rejects a coordinator who does not own the disbursement", async () => {
    const invitations = new FakeInvitations();
    const ledger = new FakeLedger();

    await expect(
      makeUseCase(invitations, ledger).execute({ coordinatorId: "c-2", disbursementId: "d-1" }),
    ).rejects.toThrow("Not your disbursement.");
    expect(invitations.rows).toHaveLength(0);
  });
});
