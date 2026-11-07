// @vitest-environment node
/**
 * Slice 4.6: payout status polling (spec §11, §10, §9).
 * GET the batch, persist paypalBatchStatus and paypalItemStatus
 * separately, preserve unknown statuses verbatim (no coercion).
 * MSW intercepts PayPal.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

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
const { GetPayoutStatus } = await import("@/application/use-cases/get-payout-status");
const {
  PrismaDisbursementRepository,
  PrismaPayoutAttemptRepository,
} = await import("@/infrastructure/db/repositories");
const { PayPalSandboxAdapter } = await import("@/infrastructure/paypal/payouts");

const BATCH_URL = "https://api-m.sandbox.paypal.com/v1/payments/payouts/:payoutBatchId";
const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Status Test Beneficiary",
      invitationEmail: "status-test@example.com",
      encryptedPayPalRecipient: "test-ciphertext",
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-STATUS-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: "Status test",
        planStatus: "DRAFT",
        paymentStatus: "PENDING",
        paymentMode: "SANDBOX",
        paypalPayoutBatchId: `BATCH-LIVE-${i + 1}`,
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
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "status-test@example.com" } });
  await prisma.$disconnect();
});

async function coordinatorId(): Promise<string> {
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  return coordinator.id;
}

function useCase() {
  return new GetPayoutStatus(
    new PrismaDisbursementRepository(),
    new PrismaPayoutAttemptRepository(),
    new PayPalSandboxAdapter({
      auth: { getAccessToken: async () => "access-token-1" },
      baseUrl: "https://api-m.sandbox.paypal.com",
    }),
  );
}

describe("GetPayoutStatus (Slice 4.6)", () => {
  it("stores batch SUCCESS and item UNCLAIMED separately", async () => {
    const id = createdDisbursementIds[0]!;
    server.use(
      http.get(BATCH_URL, () =>
        HttpResponse.json({
          batch_header: { payout_batch_id: "BATCH-LIVE-1", batch_status: "SUCCESS" },
          items: [{ sender_item_id: "ITM-1", transaction_status: "UNCLAIMED" }],
        }),
      ),
    );
    const result = await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id });
    expect(result.paypalBatchStatus).toBe("SUCCESS");
    expect(result.paypalItemStatus).toBe("UNCLAIMED");

    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.paypalBatchStatus).toBe("SUCCESS");
    expect(disbursement!.paypalItemStatus).toBe("UNCLAIMED");
    expect(disbursement!.paymentStatus).toBe("SUCCESS");
  });

  it("preserves an unknown raw status verbatim without coercion", async () => {
    const id = createdDisbursementIds[1]!;
    server.use(
      http.get(BATCH_URL, () =>
        HttpResponse.json({
          batch_header: { payout_batch_id: "BATCH-LIVE-2", batch_status: "FOO" },
          items: [{ sender_item_id: "ITM-2", transaction_status: "FOO-ITEM" }],
        }),
      ),
    );
    await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id });
    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.paypalBatchStatus).toBe("FOO");
    expect(disbursement!.paypalItemStatus).toBe("FOO-ITEM");
    // Unknown raw values must not regress the payment state.
    expect(disbursement!.paymentStatus).toBe("PENDING");
  });
});
