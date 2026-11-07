// @vitest-environment node
/**
 * Slice 4.3: create payout (spec §6 Step 8, §11, AGENTS §10).
 * One payout item for the FULL disbursement; the PayPal note
 * carries only the FL reference, never categories. MSW intercepts
 * PayPal — the real external service is never hit in tests.
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
const { encryptField } = await import("@/lib/security/encryption");
const { SubmitPayout } = await import("@/application/use-cases/submit-payout");
const {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPayoutAttemptRepository,
} = await import("@/infrastructure/db/repositories");
const { PayPalSandboxAdapter } = await import("@/infrastructure/paypal/payouts");

const TOKEN_URL = "https://api-m.sandbox.paypal.com/v1/oauth2/token";
const PAYOUTS_URL = "https://api-m.sandbox.paypal.com/v1/payments/payouts";
const PAYOUTS_SCOPE = "https://uri.paypal.com/services/payouts";

function tokenHandler() {
  return http.post(TOKEN_URL, () =>
    HttpResponse.json({
      access_token: "access-token-1",
      token_type: "Bearer",
      expires_in: 3600,
      scope: `openid ${PAYOUTS_SCOPE}`,
    }),
  );
}

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
      displayName: "Payout Test Beneficiary",
      invitationEmail: "payout-test@example.com",
      encryptedPayPalRecipient: encryptField(
        "payout.test.paypal@example.com",
        process.env.APP_ENCRYPTION_KEY ?? "a".repeat(64),
      ),
      preferredLanguage: "en",
    },
  });
  for (let i = 0; i < 2; i++) {
    const disbursement = await prisma.disbursement.create({
      data: {
        publicReference: `FL-PAYOUT-${i}-${Date.now().toString(36).toUpperCase()}`,
        organizationId: org.id,
        coordinatorId: coordinator.id,
        beneficiaryId: beneficiary.id,
        amountMinor: 50000n,
        currency: "USD",
        supportNote: `note ${i}`,
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
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "payout-test@example.com" } });
  await prisma.$disconnect();
});

async function coordinatorId(): Promise<string> {
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  return coordinator.id;
}

function useCase() {
  return new SubmitPayout(
    new PrismaDisbursementRepository(),
    new PrismaPayoutAttemptRepository(),
    new PrismaBeneficiaryRepository(),
    new PrismaLedgerEventRepository(),
    new PayPalSandboxAdapter({
      auth: { getAccessToken: async () => "access-token-1" },
      baseUrl: "https://api-m.sandbox.paypal.com",
    }),
  );
}

async function latestAttempt(disbursementId: string) {
  return new PrismaPayoutAttemptRepository().findLatestByDisbursementId(disbursementId);
}

describe("SubmitPayout.execute (Slice 4.3)", () => {
  it("stores the PayPal batch ID and mapped status on 201", async () => {
    const id = createdDisbursementIds[0]!;
    let captured: unknown = null;
    server.use(
      tokenHandler(),
      http.post(PAYOUTS_URL, async ({ request }) => {
        captured = await request.clone().json();
        return HttpResponse.json(
          {
            batch_header: {
              payout_batch_id: "PAYOUT-BATCH-1",
              batch_status: "PENDING",
            },
          },
          { status: 201 },
        );
      }),
    );

    const result = await useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id });
    expect(result.paypalPayoutBatchId).toBe("PAYOUT-BATCH-1");

    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.paypalPayoutBatchId).toBe("PAYOUT-BATCH-1");
    expect(disbursement!.paypalBatchStatus).toBe("PENDING");
    expect(disbursement!.paymentStatus).toBe("PENDING");

    const attempt = await latestAttempt(id);
    expect(attempt!.paypalPayoutBatchId).toBe("PAYOUT-BATCH-1");
    expect(attempt!.attemptState).toBe("ACKNOWLEDGED");

    const body = captured as {
      sender_batch_header: { sender_batch_id: string };
      items: { recipient_type: string; receiver: string; amount: { value: string; currency: string }; note: string }[];
    };
    expect(body.sender_batch_header.sender_batch_id).toBe(attempt!.senderBatchId);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.recipient_type).toBe("EMAIL");
    expect(body.items[0]!.amount).toEqual({ value: "500.00", currency: "USD" });
    expect(body.items[0]!.note).toContain(disbursement!.publicReference);
    expect(body.items[0]!.note).not.toMatch(/rent|school|food/i);
  });

  it("marks payment FAILED on a 400", async () => {
    const id = createdDisbursementIds[1]!;
    server.use(
      tokenHandler(),
      http.post(PAYOUTS_URL, () =>
        HttpResponse.json({ name: "BLAH", message: "invalid receiver" }, { status: 400 }),
      ),
    );

    await expect(
      useCase().execute({ coordinatorId: await coordinatorId(), disbursementId: id }),
    ).resolves.toMatchObject({ paymentStatus: "FAILED" });

    const disbursement = await prisma.disbursement.findUnique({ where: { id } });
    expect(disbursement!.paymentStatus).toBe("FAILED");
    const attempt = await latestAttempt(id);
    expect(attempt!.attemptState).toBe("FAILED");
  });
});
