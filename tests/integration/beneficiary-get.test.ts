// @vitest-environment node
/**
 * Slice 3.2: public invitation view (spec §14F, §13, ADR-0007).
 * Integration test over real Prisma adapters: valid token resolves a
 * shareable view; unknown/expired/revoked tokens are indistinguishable
 * 404s; coordinator notes never leak into the shareable view.
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
const { GetInvitationView, InvitationNotFoundError } = await import("@/application/use-cases/get-invitation-view");
const {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaOrganizationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} = await import("@/infrastructure/db/repositories");

const NOTE = "OPERATOR-ONLY note about the coordinator's private remark";
const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "View Test Beneficiary",
      invitationEmail: "view-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-VIEWTEST-${Date.now().toString(36).toUpperCase()}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: NOTE,
      shareSupportNoteWithBeneficiary: false,
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
      summary: "View test plan",
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
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.planItem.deleteMany({ where: { planVersion: { disbursementId: id } } });
    await prisma.planVersion.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "view-test@example.com" } });
  await prisma.$disconnect();
});

function useCase() {
  return new GetInvitationView(
    new PrismaRecipientInvitationRepository(),
    new PrismaDisbursementRepository(),
    new PrismaBeneficiaryRepository(),
    new PrismaPlanVersionRepository(),
    new PrismaOrganizationRepository(),
    new PrismaLedgerEventRepository(),
  );
}

async function makeToken(params: { expiresAt?: Date; revokedAt?: Date | null }): Promise<string> {
  const token = `view-token-${Math.random().toString(36).slice(2)}-${params.revokedAt ? "revoked" : "active"}`;
  await prisma.recipientInvitation.create({
    data: {
      disbursementId: createdDisbursementIds[0]!,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: params.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: params.revokedAt ?? null,
    },
  });
  return token;
}

describe("GetInvitationView (Slice 3.2)", () => {
  it("resolves a valid token to programme name, amount and items", async () => {
    const token = await makeToken({});
    const view = await useCase().execute(token);
    expect(view.programmeName).toBe("Community Family Support Programme");
    expect(view.amountMinor).toBe(50000n);
    expect(view.items).toEqual([
      { category: "Rent", amountMinor: 30000n },
      { category: "Food", amountMinor: 15000n },
    ]);
  });

  it("never includes coordinator notes in the shareable view", async () => {
    const token = await makeToken({});
    const view = await useCase().execute(token);
    const serialized = JSON.stringify(view, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    expect(serialized).not.toContain(NOTE);
    expect(view.supportNote).toBeNull();
  });

  it("treats unknown tokens as not found", async () => {
    await expect(useCase().execute("no-such-token")).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it("treats expired tokens as not found", async () => {
    const token = await makeToken({ expiresAt: new Date(Date.now() - 1000) });
    await expect(useCase().execute(token)).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it("treats revoked tokens as not found", async () => {
    const token = await makeToken({ revokedAt: new Date() });
    await expect(useCase().execute(token)).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
