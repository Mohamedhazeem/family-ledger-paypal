// @vitest-environment node
/**
 * Slice 3.1: invitation token (spec §6 Step 4, §13, ADR-0007).
 * Integration test over the real Prisma adapters: cryptographically
 * random 32-byte token, only the SHA-256 hash stored, and two calls
 * produce two different tokens. Rows created here are cleaned up.
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
const { CreateInvitation } = await import("@/application/use-cases/create-invitation");
const {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaRecipientInvitationRepository,
} = await import("@/infrastructure/db/repositories");

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Invitation Test Beneficiary",
      invitationEmail: "invitation-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-INVTEST-${Date.now().toString(36).toUpperCase()}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "Invitation test",
      planStatus: "DRAFT",
      paymentStatus: "NOT_SENT",
      paymentMode: "SANDBOX",
    },
  });
  createdDisbursementIds.push(disbursement.id);
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "invitation-test@example.com" } });
  await prisma.$disconnect();
});

function useCase() {
  return new CreateInvitation(
    new PrismaDisbursementRepository(),
    new PrismaRecipientInvitationRepository(),
    new PrismaLedgerEventRepository(),
  );
}

async function coordinatorId(): Promise<string> {
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  return coordinator.id;
}

describe("CreateInvitation (Slice 3.1)", () => {
  it("generates a token of at least 32 random bytes", async () => {
    const result = await useCase().execute({
      coordinatorId: await coordinatorId(),
      disbursementId: createdDisbursementIds[0]!,
    });
    expect(Buffer.from(result.token, "base64url").length).toBeGreaterThanOrEqual(32);
  });

  it("stores only the SHA-256 hash of the token", async () => {
    const result = await useCase().execute({
      coordinatorId: await coordinatorId(),
      disbursementId: createdDisbursementIds[0]!,
    });
    const row = await prisma.recipientInvitation.findUnique({
      where: { id: result.invitationId },
    });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).toBe(createHash("sha256").update(result.token).digest("hex"));
    expect(row!.tokenHash).not.toBe(result.token);
    expect(row!.revokedAt).toBeNull();
  });

  it("two calls produce two different tokens", async () => {
    const first = await useCase().execute({
      coordinatorId: await coordinatorId(),
      disbursementId: createdDisbursementIds[0]!,
    });
    const second = await useCase().execute({
      coordinatorId: await coordinatorId(),
      disbursementId: createdDisbursementIds[0]!,
    });
    expect(second.token).not.toBe(first.token);
    expect(second.invitationId).not.toBe(first.invitationId);
  });
});
