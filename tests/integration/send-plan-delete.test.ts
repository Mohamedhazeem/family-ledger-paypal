// @vitest-environment node
/**
 * Plan proposal delivery + draft soft delete (ADR-0018) over the real
 * Prisma adapters. Synthetic data only; rows are cleaned up afterwards.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

function loadEnvFile(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}
loadEnvFile();

const { prisma } = await import("@/infrastructure/db/prisma");
const { SendPlanProposal } = await import("@/application/use-cases/send-plan-proposal");
const { DeleteDisbursement, NotDeletableError } = await import("@/application/use-cases/delete-disbursement");
const { CreateInvitation } = await import("@/application/use-cases/create-invitation");
const { GetInvitationView, InvitationNotFoundError } = await import("@/application/use-cases/get-invitation-view");
const { NoopEmailAdapter } = await import("@/infrastructure/email/noop");
const {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaOrganizationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} = await import("@/infrastructure/db/repositories");

const suffix = Date.now().toString(36).toUpperCase();
const created: { disbursementIds: string[]; beneficiaryIds: string[] } = {
  disbursementIds: [],
  beneficiaryIds: [],
};
let referenceSeq = 0;

async function makeDisbursement(paymentStatus: "NOT_SENT" | "SUCCESS" = "NOT_SENT") {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: `Proposal Test ${suffix}`,
      invitationEmail: `proposal-${suffix}@example.test`,
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-PROP-${suffix}-${++referenceSeq}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "integration test note",
      planStatus: "DRAFT",
      paymentStatus,
      paymentMode: "SANDBOX",
    },
  });
  await prisma.planVersion.create({
    data: {
      disbursementId: disbursement.id,
      versionNumber: 1,
      createdByType: "COORDINATOR",
      createdById: coordinator.id,
      summary: "v1",
      status: "DRAFT",
      totalAllocatedMinor: 30000n,
      unallocatedMinor: 20000n,
      requiresClarification: false,
      items: {
        create: [
          { category: "Rent", amountMinor: 30000n, sortOrder: 0 },
          { category: "Food", amountMinor: null, sortOrder: 1 },
        ],
      },
    },
  });
  created.disbursementIds.push(disbursement.id);
  created.beneficiaryIds.push(beneficiary.id);
  return { disbursement, beneficiary, coordinatorId: coordinator.id };
}

function sendPlan(coordinatorId: string, disbursementId: string) {
  return new SendPlanProposal(
    new PrismaDisbursementRepository(),
    new PrismaBeneficiaryRepository(),
    new PrismaOrganizationRepository(),
    new PrismaPlanVersionRepository(),
    new PrismaLedgerEventRepository(),
    new NoopEmailAdapter(),
    new CreateInvitation(
      new PrismaDisbursementRepository(),
      new PrismaRecipientInvitationRepository(),
      new PrismaLedgerEventRepository(),
    ),
  ).execute({ coordinatorId, disbursementId, appUrl: "https://app.example.com" });
}

function deleteDraft(coordinatorId: string, disbursementId: string) {
  return new DeleteDisbursement(
    new PrismaDisbursementRepository(),
    new PrismaRecipientInvitationRepository(),
    new PrismaLedgerEventRepository(),
  ).execute({ coordinatorId, disbursementId });
}

afterAll(async () => {
  for (const id of created.disbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.planItem.deleteMany({ where: { planVersion: { disbursementId: id } } });
    await prisma.planVersion.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  for (const id of created.beneficiaryIds) {
    await prisma.beneficiary.delete({ where: { id } });
  }
  await prisma.$disconnect();
});

describe("SendPlanProposal + DeleteDisbursement (integration)", () => {
  it("delivers the latest plan version and logs PLAN_PROPOSAL_SENT", async () => {
    const { disbursement, coordinatorId } = await makeDisbursement();
    const result = await sendPlan(coordinatorId, disbursement.id);

    expect(result.url).toContain(`/beneficiary/`);
    expect(result.delivered).toBe(false);
    expect(result.provider).toBe("noop");
    expect(result.planVersionNumber).toBe(1);

    const events = await prisma.ledgerEvent.findMany({ where: { disbursementId: disbursement.id } });
    expect(events.map((e) => e.eventType)).toContain("PLAN_PROPOSAL_SENT");

    const invitation = await prisma.recipientInvitation.findFirstOrThrow({
      where: { disbursementId: disbursement.id },
    });
    expect(invitation.revokedAt).toBeNull();
  });

  it("soft-deletes the draft, revokes the invitation and hides the portal link", async () => {
    const { disbursement, coordinatorId } = await makeDisbursement();
    const sent = await sendPlan(coordinatorId, disbursement.id);

    const result = await deleteDraft(coordinatorId, disbursement.id);
    expect(result.deletedAt).toBeInstanceOf(Date);

    const row = await prisma.disbursement.findUniqueOrThrow({ where: { id: disbursement.id } });
    expect(row.deletedAt).not.toBeNull();

    const invitation = await prisma.recipientInvitation.findFirstOrThrow({
      where: { disbursementId: disbursement.id },
    });
    expect(invitation.revokedAt).not.toBeNull();

    const events = await prisma.ledgerEvent.findMany({ where: { disbursementId: disbursement.id } });
    expect(events.map((e) => e.eventType)).toContain("DISBURSEMENT_DELETED");

    // The read surface excludes the deleted row.
    const visible = await prisma.disbursement.findMany({
      where: { id: disbursement.id, deletedAt: null },
    });
    expect(visible).toHaveLength(0);

    // The public portal no longer resolves the token.
    const token = sent.url.split("/beneficiary/")[1]!;
    const view = new GetInvitationView(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaBeneficiaryRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaOrganizationRepository(),
      new PrismaLedgerEventRepository(),
    );
    await expect(view.execute(token)).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it("refuses to delete a disbursement that has been sent", async () => {
    const { disbursement, coordinatorId } = await makeDisbursement("SUCCESS");
    await expect(deleteDraft(coordinatorId, disbursement.id)).rejects.toBeInstanceOf(NotDeletableError);
    const row = await prisma.disbursement.findUniqueOrThrow({ where: { id: disbursement.id } });
    expect(row.deletedAt).toBeNull();
  });
});
