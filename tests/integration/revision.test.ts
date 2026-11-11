// @vitest-environment node
/**
 * Slice 3.4: beneficiary suggest-changes (spec §6 Step 5).
 * A revised PlanVersion is created (immutable), planStatus moves to
 * REVISION_PROPOSED, the optional explanation is stored on the
 * version, and over-total revisions are rejected. Integration test
 * over real Prisma adapters.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
const { ProposeRevision } = await import("@/application/use-cases/propose-revision");
const { InvitationNotFoundError } = await import("@/application/use-cases/get-invitation-view");
const {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanClarificationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} = await import("@/infrastructure/db/repositories");

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Revision Test Beneficiary",
      invitationEmail: "revision-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-REV-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: "Revision test note",
        planStatus: "DRAFT",
        paymentStatus: "NOT_SENT",
        paymentMode: "SANDBOX",
      },
    });
    createdDisbursementIds.push(disbursement.id);
    const version = await prisma.planVersion.create({
      data: {
        disbursementId: disbursement.id,
        versionNumber: 1,
        createdByType: "COORDINATOR",
        createdById: coordinator.id,
        summary: "Revision test plan",
        status: "DRAFT",
        totalAllocatedMinor: 45000n,
        unallocatedMinor: 5000n,
        requiresClarification: false,
      },
    });
    await prisma.planItem.createMany({
      data: [
        { planVersionId: version.id, category: "Rent", amountMinor: 30000n, sourceText: "$300 for rent", sortOrder: 0 },
        { planVersionId: version.id, category: "Food", amountMinor: 15000n, sourceText: "$150 for food", sortOrder: 1 },
      ],
    });
  }
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.planItem.deleteMany({ where: { planVersion: { disbursementId: id } } });
    await prisma.planVersion.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "revision-test@example.com" } });
  await prisma.$disconnect();
});

function useCase() {
  return new ProposeRevision(
    new PrismaRecipientInvitationRepository(),
    new PrismaDisbursementRepository(),
    new PrismaPlanVersionRepository(),
    new PrismaLedgerEventRepository(),
    new PrismaPlanClarificationRepository(),
  );
}

async function makeToken(disbursementId: string): Promise<string> {
  const token = `revise-token-${Math.random().toString(36).slice(2)}`;
  await prisma.recipientInvitation.create({
    data: {
      disbursementId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

describe("ProposeRevision (Slice 3.4)", () => {
  it("creates v2 reflecting the changes, keeps v1, stores the explanation", async () => {
    const id = createdDisbursementIds[0]!;
    const token = await makeToken(id);
    const v1Id = (await prisma.planVersion.findFirst({ where: { disbursementId: id } }))!.id;

    const result = await useCase().execute(token, {
      items: [
        { category: "Rent", amountText: "250.00" },
        { category: "Medicine", amountText: "50.00" },
      ],
      explanation: "School starts next month",
    });
    expect(result.versionNumber).toBe(2);

    const v2 = await prisma.planVersion.findFirst({ where: { disbursementId: id, versionNumber: 2 } });
    expect(v2).not.toBeNull();
    expect(v2!.createdByType).toBe("BENEFICIARY");
    expect(v2!.explanation).toBe("School starts next month");
    const v2Items = await prisma.planItem.findMany({ where: { planVersionId: v2!.id }, orderBy: { sortOrder: "asc" } });
    expect(v2Items.map((i) => i.category)).toEqual(["Rent", "Medicine"]);
    expect(v2Items.map((i) => i.amountMinor)).toEqual([25000n, 5000n]);

    const v1Items = await prisma.planItem.findMany({ where: { planVersionId: v1Id }, orderBy: { sortOrder: "asc" } });
    expect(v1Items.map((i) => i.category)).toEqual(["Rent", "Food"]);

    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.planStatus).toBe("REVISION_PROPOSED");
    expect(disbursement!.paymentStatus).toBe("NOT_SENT");
  });

  it("rejects an over-total revision before any write", async () => {
    const id = createdDisbursementIds[1]!;
    const token = await makeToken(id);
    await expect(
      useCase().execute(token, { items: [{ category: "Rent", amountText: "600.00" }] }),
    ).rejects.toThrow(/exceed/i);
    const versions = await prisma.planVersion.count({ where: { disbursementId: id } });
    expect(versions).toBe(1);
  });

  it("rejects an unknown token", async () => {
    await expect(useCase().execute("no-such-token", { items: [] })).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
