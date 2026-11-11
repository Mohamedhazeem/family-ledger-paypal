// @vitest-environment node
/**
 * ADR-0019 over real Prisma adapters: coordinator revision (amount +
 * categories) and clarification questions, including the mark-answered
 * hook when the beneficiary responds. Synthetic data; cleaned up after.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
const { ProposeCoordinatorRevision } = await import("@/application/use-cases/propose-coordinator-revision");
const { RequestClarification } = await import("@/application/use-cases/request-clarification");
const { ProposeRevision } = await import("@/application/use-cases/propose-revision");
const {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanClarificationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} = await import("@/infrastructure/db/repositories");

const suffix = Date.now().toString(36).toUpperCase();
const created: { disbursementId?: string; beneficiaryId?: string } = {};
let seq = 0;

async function makeDisbursement() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: `Coordinator Revision ${suffix}`,
      invitationEmail: `coordinator-revision-${suffix}@example.test`,
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-ADJ-${suffix}-${++seq}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "integration note",
      planStatus: "REVISION_PROPOSED",
      paymentStatus: "NOT_SENT",
      paymentMode: "SANDBOX",
    },
  });
  await prisma.planVersion.create({
    data: {
      disbursementId: disbursement.id,
      versionNumber: 1,
      createdByType: "BENEFICIARY",
      createdById: null,
      summary: "v1",
      explanation: "we need more money for transport",
      status: "REVISION_PROPOSED",
      totalAllocatedMinor: 50000n,
      unallocatedMinor: 0n,
      requiresClarification: false,
      items: {
        create: [{ category: "Rent", amountMinor: 30000n, sortOrder: 0 }],
      },
    },
  });
  created.disbursementId = disbursement.id;
  created.beneficiaryId = beneficiary.id;
  return { disbursement, coordinatorId: coordinator.id };
}

function revise(coordinatorId: string, disbursementId: string) {
  return new ProposeCoordinatorRevision(
    new PrismaDisbursementRepository(),
    new PrismaPlanVersionRepository(),
    new PrismaLedgerEventRepository(),
  ).execute({
    coordinatorId,
    disbursementId,
    totalText: "600.00",
    items: [
      { category: "Rent", amountText: "300.00" },
      { category: "Transport", amountText: "100.00" },
    ],
  });
}

afterAll(async () => {
  if (created.disbursementId) {
    const id = created.disbursementId;
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.planClarification.deleteMany({ where: { disbursementId: id } });
    await prisma.planItem.deleteMany({ where: { planVersion: { disbursementId: id } } });
    await prisma.planVersion.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  if (created.beneficiaryId) {
    await prisma.beneficiary.delete({ where: { id: created.beneficiaryId } });
  }
  await prisma.$disconnect();
});

describe("Coordinator revision + clarification (ADR-0019)", () => {
  it("updates the amount and appends a coordinator version", async () => {
    const { disbursement, coordinatorId } = await makeDisbursement();
    const result = await revise(coordinatorId, disbursement.id);

    expect(result.amountChanged).toBe(true);
    expect(result.versionNumber).toBe(2);

    const row = await prisma.disbursement.findUniqueOrThrow({ where: { id: disbursement.id } });
    expect(row.amountMinor).toBe(60000n);
    expect(row.planStatus).toBe("REVISION_PROPOSED");

    const versions = await prisma.planVersion.findMany({
      where: { disbursementId: disbursement.id },
      orderBy: { versionNumber: "asc" },
      include: { items: true },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]!.createdByType).toBe("BENEFICIARY");
    expect(versions[1]!.createdByType).toBe("COORDINATOR");
    expect(versions[1]!.items.map((i) => i.category)).toEqual(["Rent", "Transport"]);

    const events = await prisma.ledgerEvent.findMany({ where: { disbursementId: disbursement.id } });
    expect(events.map((e) => e.eventType)).toContain("DISBURSEMENT_AMOUNT_UPDATED");
    expect(events.map((e) => e.eventType)).toContain("PLAN_COORDINATOR_REVISION");
  });

  it("asks a clarification and marks it answered when the beneficiary responds", async () => {
    const { disbursement, coordinatorId } = await makeDisbursement();
    const question = await new RequestClarification(
      new PrismaDisbursementRepository(),
      new PrismaPlanClarificationRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({
      coordinatorId,
      disbursementId: disbursement.id,
      question: "Could you tell us more about the transport costs?",
    });
    expect(question.respondedAt).toBeNull();

    const token = `clar-token-${Math.random().toString(36).slice(2)}`;
    await prisma.recipientInvitation.create({
      data: {
        disbursementId: disbursement.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await new ProposeRevision(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaLedgerEventRepository(),
      new PrismaPlanClarificationRepository(),
    ).execute(token, {
      items: [{ category: "Transport", amountText: "100.00" }],
      explanation: "added transport",
    });

    const answered = await prisma.planClarification.findUniqueOrThrow({ where: { id: question.id } });
    expect(answered.respondedAt).not.toBeNull();

    // The latest unanswered question is now null for the portal.
    const pending = await new PrismaPlanClarificationRepository().findLatestUnansweredByDisbursementId(
      disbursement.id,
    );
    expect(pending).toBeNull();
  });
});
