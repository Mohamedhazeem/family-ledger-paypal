// @vitest-environment node
/**
 * Slice 4.2: PayoutAttempt transaction (spec §9, §11).
 * On submit the attempt row (with a unique senderBatchId) and the
 * SUBMITTING payment status are committed BEFORE any HTTP call;
 * a duplicate insert on the same senderBatchId fails on the unique
 * constraint. Integration test over real Prisma adapters.
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
const { SubmitPayout } = await import("@/application/use-cases/submit-payout");
const {
  PrismaDisbursementRepository,
  PrismaPayoutAttemptRepository,
} = await import("@/infrastructure/db/repositories");

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Attempt Test Beneficiary",
      invitationEmail: "attempt-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-ATTEMPT-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: "Attempt test note",
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
    await prisma.payoutAttempt.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "attempt-test@example.com" } });
  await prisma.$disconnect();
});

async function coordinatorId(): Promise<string> {
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  return coordinator.id;
}

describe("SubmitPayout.begin (Slice 4.2)", () => {
  it("persists the attempt row and SUBMITTING status before any HTTP call", async () => {
    const id = createdDisbursementIds[0]!;
    const useCase = new SubmitPayout(
      new PrismaDisbursementRepository(),
      new PrismaPayoutAttemptRepository(),
    );
    const attempt = await useCase.begin({ coordinatorId: await coordinatorId(), disbursementId: id });

    // Simulated crash after commit: re-read from the DB.
    const row = await prisma.payoutAttempt.findUnique({ where: { id: attempt.id } });
    expect(row).not.toBeNull();
    expect(row!.attemptState).toBe("SUBMITTING");
    expect(row!.senderBatchId).toMatch(/^FL-BATCH-/);
    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.paymentStatus).toBe("SUBMITTING");
  });

  it("a duplicate insert on the same senderBatchId fails on the unique constraint", async () => {
    const id = createdDisbursementIds[1]!;
    const repo = new PrismaPayoutAttemptRepository();
    await repo.create({
      disbursementId: id,
      senderBatchId: "FL-BATCH-DUPLICATE",
      senderItemId: "FL-BATCH-DUPLICATE-01",
      paypalPayoutBatchId: null,
      attemptState: "SUBMITTING",
      requestPayloadRedacted: "{}",
    });
    await expect(
      repo.create({
        disbursementId: id,
        senderBatchId: "FL-BATCH-DUPLICATE",
        senderItemId: "FL-BATCH-DUPLICATE-02",
        paypalPayoutBatchId: null,
        attemptState: "SUBMITTING",
        requestPayloadRedacted: "{}",
      }),
    ).rejects.toThrow(/unique/i);
  });
});
