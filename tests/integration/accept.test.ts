// @vitest-environment node
/**
 * Slice 3.3: beneficiary accept action (spec §6 Step 5, §10, §9).
 * Accepting creates an immutable PlanVersion v2 (items identical to
 * v1), sets planStatus=BENEFICIARY_ACCEPTED, and never touches
 * paymentStatus. Integration test over real Prisma adapters.
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
const { AcceptPlan } = await import("@/application/use-cases/accept-plan");
const { InvitationNotFoundError } = await import("@/application/use-cases/get-invitation-view");
const {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
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
      displayName: "Accept Test Beneficiary",
      invitationEmail: "accept-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-ACCEPT-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: "Accept test note",
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
        summary: "Accept test plan",
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
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "accept-test@example.com" } });
  await prisma.$disconnect();
});

function useCase() {
  return new AcceptPlan(
    new PrismaRecipientInvitationRepository(),
    new PrismaDisbursementRepository(),
    new PrismaPlanVersionRepository(),
    new PrismaLedgerEventRepository(),
  );
}

async function makeToken(disbursementId: string): Promise<string> {
  const token = `accept-token-${Math.random().toString(36).slice(2)}`;
  await prisma.recipientInvitation.create({
    data: {
      disbursementId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

describe("AcceptPlan (Slice 3.3)", () => {
  it("creates PlanVersion v2 identical to v1 and leaves v1 untouched", async () => {
    const id = createdDisbursementIds[0]!;
    const token = await makeToken(id);
    const v1Before = await prisma.planVersion.findFirst({ where: { disbursementId: id } });
    const itemsBefore = await prisma.planItem.findMany({
      where: { planVersionId: v1Before!.id },
      orderBy: { sortOrder: "asc" },
    });

    const result = await useCase().execute(token);
    expect(result.versionNumber).toBe(2);

    const v1After = await prisma.planVersion.findUnique({ where: { id: v1Before!.id } });
    const itemsAfter = await prisma.planItem.findMany({
      where: { planVersionId: v1Before!.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(serialize(v1After)).toBe(serialize(v1Before));
    const project = (rows: { category: string; amountMinor: bigint | null; sortOrder: number }[]) =>
      serialize(rows.map((i) => ({ category: i.category, amountMinor: i.amountMinor, sortOrder: i.sortOrder })));
    expect(project(itemsAfter)).toBe(project(itemsBefore));

    const v2 = await prisma.planVersion.findFirst({ where: { disbursementId: id, versionNumber: 2 } });
    expect(v2).not.toBeNull();
    const v2Items = await prisma.planItem.findMany({ where: { planVersionId: v2!.id }, orderBy: { sortOrder: "asc" } });
    expect(v2Items.map((i) => i.category)).toEqual(["Rent", "Food"]);
    expect(v2Items.map((i) => i.amountMinor)).toEqual([30000n, 15000n]);
  });

  it("sets planStatus to BENEFICIARY_ACCEPTED without touching payment status", async () => {
    const id = createdDisbursementIds[1]!;
    const token = await makeToken(id);
    await useCase().execute(token);
    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.planStatus).toBe("BENEFICIARY_ACCEPTED");
    expect(disbursement!.paymentStatus).toBe("NOT_SENT");
  });

  it("rejects an unknown token", async () => {
    await expect(useCase().execute("no-such-token")).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
