/**
 * GetInvitationView use case (Slice 3.2): the "Invitation viewed" ledger
 * event is written once per invitation — on the first view only. Repeat
 * portal opens update lastViewedAt but must not flood the shared timeline.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { GetInvitationView } from "./get-invitation-view";

const TOKEN = "test-token";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

function makeDeps() {
  const invitations = {
    findByTokenHash: async (hash: string) =>
      hash === TOKEN_HASH
        ? {
            id: "inv-1",
            disbursementId: "d-1",
            tokenHash: TOKEN_HASH,
            expiresAt: new Date(Date.now() + 86_400_000),
            revokedAt: null,
            createdAt: new Date(0),
            lastViewedAt: null as Date | null,
          }
        : null,
    markViewedCalls: [] as Array<{ id: string; at: Date }>,
    markViewed: async function (id: string, at: Date) {
      this.markViewedCalls.push({ id, at });
    },
  };
  const disbursements = {
    findById: async () => ({
      id: "d-1",
      organizationId: "org-1",
      beneficiaryId: "b-1",
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "note",
      shareSupportNoteWithBeneficiary: false,
    }),
  };
  const beneficiaries = { findById: async () => ({ displayName: "Maria", preferredLanguage: "en" }) };
  const plans = {
    findLatestByDisbursementId: async () => null,
    findItemsByVersionId: async () => [],
  };
  const organizations = { findById: async () => ({ name: "Programme" }) };
  const ledger = {
    events: [] as Array<{ eventType: string }>,
    create: async function (input: { eventType: string }) {
      this.events.push(input);
      return input;
    },
  };
  return { invitations, disbursements, beneficiaries, plans, organizations, ledger };
}

function makeUseCase(deps: ReturnType<typeof makeDeps>) {
  return new GetInvitationView(
    deps.invitations as never,
    deps.disbursements as never,
    deps.beneficiaries as never,
    deps.plans as never,
    deps.organizations as never,
    deps.ledger as never,
  );
}

describe("GetInvitationView view tracking", () => {
  it("writes INVITATION_VIEWED once on the first view", async () => {
    const deps = makeDeps();
    await makeUseCase(deps).execute(TOKEN);
    expect(deps.ledger.events.map((e) => e.eventType)).toEqual(["INVITATION_VIEWED"]);
    expect(deps.invitations.markViewedCalls).toHaveLength(1);
  });

  it("does not repeat INVITATION_VIEWED when the invitation was already viewed", async () => {
    const deps = makeDeps();
    deps.invitations.findByTokenHash = async (hash: string) =>
      hash === TOKEN_HASH
        ? {
            id: "inv-1",
            disbursementId: "d-1",
            tokenHash: TOKEN_HASH,
            expiresAt: new Date(Date.now() + 86_400_000),
            revokedAt: null,
            createdAt: new Date(0),
            lastViewedAt: new Date(1), // already viewed before
          }
        : null;
    await makeUseCase(deps).execute(TOKEN);
    expect(deps.ledger.events).toEqual([]);
    // lastViewedAt still refreshes.
    expect(deps.invitations.markViewedCalls).toHaveLength(1);
  });
});
