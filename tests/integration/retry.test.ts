// @vitest-environment node
/**
 * Slice 4.5: uncertain outcomes (spec §11).
 * A 5xx makes the outcome STATUS_UNKNOWN; the retry reuses the SAME
 * sender_batch_id (never regenerated) and the single attempt row
 * transitions SUBMITTING → ACKNOWLEDGED. MSW intercepts PayPal.
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
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createdDisbursementIds: string[] = [];
let attemptSenderIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  sessionState.session = { user: { id: coordinator.id, email: coordinator.email } };
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Retry Test Beneficiary",
      invitationEmail: "retry-test@example.com",
      encryptedPayPalRecipient: encryptField(
        "retry.paypal@example.com",
        process.env.APP_ENCRYPTION_KEY ?? "a".repeat(64),
      ),
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-RETRY-${Date.now().toString(36).toUpperCase()}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "Retry test",
      planStatus: "DRAFT",
      paymentStatus: "NOT_SENT",
      paymentMode: "SANDBOX",
    },
  });
  createdDisbursementIds.push(disbursement.id);
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.payoutAttempt.deleteMany({ where: { disbursementId: id } });
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "retry-test@example.com" } });
  await prisma.$disconnect();
});

describe("uncertain outcome retry (Slice 4.5)", () => {
  it("500 then success reuses the same sender batch id", async () => {
    const id = createdDisbursementIds[0]!;
    let calls = 0;
    attemptSenderIds = [];
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({
          access_token: "access-token-1",
          token_type: "Bearer",
          expires_in: 3600,
          scope: `openid ${PAYOUTS_SCOPE}`,
        }),
      ),
      http.post(PAYOUTS_URL, async ({ request }) => {
        calls += 1;
        const body = (await request.clone().json()) as {
          sender_batch_header: { sender_batch_id: string };
        };
        attemptSenderIds.push(body.sender_batch_header.sender_batch_id);
        if (calls === 1) {
          return new HttpResponse("Server Error", { status: 500 });
        }
        return HttpResponse.json(
          { batch_header: { payout_batch_id: "BATCH-RETRY-1", batch_status: "PENDING" } },
          { status: 201 },
        );
      }),
    );

    const { POST } = await import("@/app/api/disbursements/[id]/pay/route");
    const pay = () => POST(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });

    const first = await pay();
    const firstBody = (await first.json()) as { paymentStatus: string };
    expect(firstBody.paymentStatus).toBe("STATUS_UNKNOWN");

    const second = await pay();
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { paymentStatus: string; paypalPayoutBatchId: string };
    expect(secondBody.paypalPayoutBatchId).toBe("BATCH-RETRY-1");

    // Both outbound requests carried the same sender batch id. The
    // first is a fresh attempt; the retry MUST reuse it.
    expect(attemptSenderIds).toHaveLength(2);
    expect(attemptSenderIds[0]).toBe(attemptSenderIds[1]);

    const attempts = await prisma.payoutAttempt.findMany({ where: { disbursementId: id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.attemptState).toBe("ACKNOWLEDGED");
    expect(attempts[0]!.paypalPayoutBatchId).toBe("BATCH-RETRY-1");
  });
});
