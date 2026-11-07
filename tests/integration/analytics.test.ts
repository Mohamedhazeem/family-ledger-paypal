// @vitest-environment node
/**
 * Slice 5.1: AG Studio analytics aggregates (ADR-0010).
 * Aggregate-only reads: status counts, totals, per-category sums.
 * Privacy rule: the snapshot carries no emails, token hashes,
 * notes, explanations, or recipient data (guardrail test below).
 */
import { readFileSync } from "node:fs";
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
const { PrismaAnalyticsAdapter } = await import("@/infrastructure/analytics/prisma");
const { toStudioSources } = await import("@/infrastructure/analytics/studio-sources");

const orgId = "analytics-test-org";
const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  await prisma.organization.create({ data: { id: orgId, name: "Analytics Test Org" } });
  const coordinator = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: "Analytics Coordinator",
      email: "analytics-coordinator@example.com",
      role: "COORDINATOR",
    },
  });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: orgId,
      displayName: "Analytics Beneficiary",
      invitationEmail: "analytics@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 3; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-ANALYTICS-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: orgId,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: BigInt((i + 1) * 10000),
        currency: "USD",
        supportNote: `PRIVATE NOTE ${i}`,
        planStatus: i === 0 ? "DRAFT" : i === 1 ? "BENEFICIARY_ACCEPTED" : "BENEFICIARY_DECLINED_TO_SHARE",
        paymentStatus: i === 2 ? "SUCCESS" : "NOT_SENT",
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
        summary: "Analytics plan",
        explanation: `PRIVATE EXPLANATION ${i}`,
        status: "DRAFT",
        totalAllocatedMinor: BigInt(i * 5000),
        unallocatedMinor: 0n,
        requiresClarification: false,
      },
    });
    if (i < 2) {
      await prisma.planItem.createMany({
        data: [
          { planVersionId: version.id, category: "Rent", amountMinor: 20000n, sourceText: `PRIVATE ${i}`, sortOrder: 0 },
          { planVersionId: version.id, category: "Food", amountMinor: 5000n, sortOrder: 1 },
        ],
      });
    }
  }
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.planItem.deleteMany({ where: { planVersion: { disbursementId: id } } });
    await prisma.planVersion.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "analytics@example.com" } });
  await prisma.user.deleteMany({ where: { email: "analytics-coordinator@example.com" } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("PrismaAnalyticsAdapter (Slice 5.1)", () => {
  it("computes org-scoped status counts and totals", async () => {
    const snapshot = await new PrismaAnalyticsAdapter().getAggregates(orgId);
    expect(snapshot.totalDisbursements).toBe(3);
    expect(snapshot.totalAmountMinor).toBe("60000");
    expect(snapshot.byPlanStatus).toEqual(
      expect.arrayContaining([
        { status: "DRAFT", count: 1 },
        { status: "BENEFICIARY_ACCEPTED", count: 1 },
        { status: "BENEFICIARY_DECLINED_TO_SHARE", count: 1 },
      ]),
    );
    expect(snapshot.byPaymentStatus).toEqual(
      expect.arrayContaining([
        { status: "NOT_SENT", count: 2 },
        { status: "SUCCESS", count: 1 },
      ]),
    );
  });

  it("aggregates the latest plan items per category", async () => {
    const snapshot = await new PrismaAnalyticsAdapter().getAggregates(orgId);
    expect(snapshot.categories).toEqual([
      { category: "Food", amountMinor: "10000", itemCount: 2 },
      { category: "Rent", amountMinor: "40000", itemCount: 2 },
    ]);
  });

  it("never exposes emails, token hashes, notes, or explanations", async () => {
    const snapshot = await new PrismaAnalyticsAdapter().getAggregates(orgId);
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE");
    expect(JSON.stringify(snapshot)).not.toContain("@");
    expect(JSON.stringify(snapshot)).not.toContain("tokenHash");
    expect(JSON.stringify(snapshot)).not.toContain("ciphertext");
  });

  it("studio sources carry the same aggregate rows", async () => {
    const snapshot = await new PrismaAnalyticsAdapter().getAggregates(orgId);
    const sources = toStudioSources(snapshot);
    expect(sources.map((s) => s.id)).toContain("categories");
    const categories = sources.find((s) => s.id === "categories")!;
    expect(categories.data).toEqual(
      expect.arrayContaining([
        { category: "Food", amount_minor: 10000, item_count: 2 },
        { category: "Rent", amount_minor: 40000, item_count: 2 },
      ]),
    );
    expect(JSON.stringify(sources)).not.toContain("@");
  });
});
