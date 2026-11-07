// @vitest-environment node
/**
 * Slice 3.5: decline to share (spec §6 Step 5, §4.4, §4.5).
 * Sets planStatus=BENEFICIARY_DECLINED_TO_SHARE; payment eligibility
 * is unchanged — canSubmitPayout still returns true. Integration
 * test over real Prisma adapters.
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
const { DeclineToShare } = await import("@/application/use-cases/decline-to-share");
const { InvitationNotFoundError } = await import("@/application/use-cases/get-invitation-view");
const { canSubmitPayout } = await import("@/domain/entities/disbursement");
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
      displayName: "Decline Test Beneficiary",
      invitationEmail: "decline-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-DECLINE-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: "Decline test note",
        planStatus: "DRAFT",
        paymentStatus: "NOT_SENT",
        paymentMode: "SANDBOX",
      },
    });
    createdDisbursementIds.push(disbursement.id);
  }
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "decline-test@example.com" } });
  await prisma.$disconnect();
});

function useCase() {
  return new DeclineToShare(
    new PrismaRecipientInvitationRepository(),
    new PrismaDisbursementRepository(),
    new PrismaLedgerEventRepository(),
  );
}

async function makeToken(disbursementId: string): Promise<string> {
  const token = `decline-token-${Math.random().toString(36).slice(2)}`;
  await prisma.recipientInvitation.create({
    data: {
      disbursementId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

describe("DeclineToShare (Slice 3.5)", () => {
  it("sets planStatus to BENEFICIARY_DECLINED_TO_SHARE and keeps payout submittable", async () => {
    const id = createdDisbursementIds[0]!;
    const token = await makeToken(id);
    const result = await useCase().execute(token);
    expect(result.planStatus).toBe("BENEFICIARY_DECLINED_TO_SHARE");

    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.planStatus).toBe("BENEFICIARY_DECLINED_TO_SHARE");
    expect(disbursement!.paymentStatus).toBe("NOT_SENT");
    expect(canSubmitPayout(disbursement!)).toBe(true);
  });

  it("writes a PLAN_DECLINED event and creates no new plan version", async () => {
    const id = createdDisbursementIds[1]!;
    const token = await makeToken(id);
    await useCase().execute(token);
    const event = await prisma.ledgerEvent.findFirst({ where: { disbursementId: id } });
    expect(event!.eventType).toBe("PLAN_DECLINED");
    expect(event!.actorType).toBe("BENEFICIARY");
    const versions = await prisma.planVersion.count({ where: { disbursementId: id } });
    expect(versions).toBe(0);
  });

  it("rejects an unknown token", async () => {
    await expect(useCase().execute("no-such-token")).rejects.toBeInstanceOf(InvitationNotFoundError);
  });
});
