// @vitest-environment node
/**
 * Slice 4.4: single-submission lock (spec §11, ADR-0006).
 * Five parallel POSTs produce exactly one PayoutAttempt row and one
 * outbound call; the four losers reference the winner's batch id.
 * The PayPal endpoints are intercepted with MSW.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

const sessionState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => sessionState.session,
}));

const { prisma } = await import("@/infrastructure/db/prisma");
const { encryptField } = await import("@/lib/security/encryption");

const TOKEN_URL = "https://api-m.sandbox.paypal.com/v1/oauth2/token";
const PAYOUTS_URL = "https://api-m.sandbox.paypal.com/v1/payments/payouts";
const PAYOUTS_SCOPE = "https://uri.paypal.com/payments/payouts";

const server = setupServer();
let payoutsCalls = 0;
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  sessionState.session = { user: { id: coordinator.id, email: coordinator.email } };
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Idem Test Beneficiary",
      invitationEmail: "idempotent-test@example.com",
      encryptedPayPalRecipient: encryptField(
        "idempotent.paypal@example.com",
        process.env.APP_ENCRYPTION_KEY ?? "a".repeat(64),
      ),
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-IDEM-${Date.now().toString(36).toUpperCase()}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "Idempotency test",
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
    await prisma.payoutAttempt.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "idempotent-test@example.com" } });
  await prisma.$disconnect();
});

describe("single-submission lock (Slice 4.4)", () => {
  it("five parallel POSTs create one attempt and one outbound call", async () => {
    const id = createdDisbursementIds[0]!;
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({
          access_token: "access-token-1",
          token_type: "Bearer",
          expires_in: 3600,
          scope: `openid ${PAYOUTS_SCOPE}`,
        }),
      ),
      http.post(PAYOUTS_URL, async () => {
        payoutsCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 250));
        return HttpResponse.json(
          { batch_header: { payout_batch_id: "BATCH-1", batch_status: "PENDING" } },
          { status: 201 },
        );
      }),
    );

    const { POST } = await import("@/app/api/disbursements/[id]/pay/route");
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        POST(new Request("http://localhost/x"), { params: Promise.resolve({ id }) }),
      ),
    );
    const bodies = await Promise.all(responses.map((r) => r.json()));

    expect(payoutsCalls).toBe(1);
    expect(await prisma.payoutAttempt.count({ where: { disbursementId: id } })).toBe(1);

    const senderIds = new Set(bodies.map((b) => b.senderBatchId));
    expect(senderIds.size).toBe(1);
    const attempt = await prisma.payoutAttempt.findFirst({ where: { disbursementId: id } });
    expect(bodies.every((b) => b.senderBatchId === attempt!.senderBatchId)).toBe(true);
  });
});
