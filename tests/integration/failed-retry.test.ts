// @vitest-environment node
/**
 * Slice 4.5-retry / FAILED-fresh-attempt (spec §11):
 * after a definitive 4xx (attempt FAILED), a coordinator resubmit
 * creates a FRESH attempt with a NEW sender batch id; the FAILED
 * attempt stays in history; the newer result wins.
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

beforeAll(async () => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  sessionState.session = { user: { id: coordinator.id, email: coordinator.email } };
  const beneficiary = await prisma.beneficiary.create({
    data: {
      organizationId: org.id,
      displayName: "Failed Retry Beneficiary",
      invitationEmail: "failed-retry@example.com",
      encryptedPayPalRecipient: encryptField(
        "failedretry.paypal@example.com",
        process.env.APP_ENCRYPTION_KEY ?? "a".repeat(64),
      ),
      preferredLanguage: "en",
    },
  });
  const disbursement = await prisma.disbursement.create({
    data: {
      publicReference: `FL-FAILED-${Date.now().toString(36).toUpperCase()}`,
      organizationId: org.id,
      coordinatorId: coordinator.id,
      beneficiaryId: beneficiary.id,
      amountMinor: 50000n,
      currency: "USD",
      supportNote: "Failed retry test",
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
  await prisma.beneficiary.deleteMany({ where: { invitationEmail: "failed-retry@example.com" } });
  await prisma.$disconnect();
});

describe("fresh attempt after FAILED (4xx-retry)", () => {
  it("a 400 fails the attempt; resubmitting mints a new batch id and succeeds", async () => {
    const id = createdDisbursementIds[0]!;
    const senderIds: string[] = [];
    let calls = 0;
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
        senderIds.push(body.sender_batch_header.sender_batch_id);
        if (calls === 1) {
          return new HttpResponse("{}", { status: 400 });
        }
        return HttpResponse.json(
          { batch_header: { payout_batch_id: "BATCH-FRESH-1", batch_status: "PENDING" } },
          { status: 201 },
        );
      }),
    );

    const { POST } = await import("@/app/api/disbursements/[id]/pay/route");
    const pay = () => POST(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });

    const first = await pay();
    expect(((await first.json()) as { paymentStatus: string }).paymentStatus).toBe("FAILED");

    const second = await pay();
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { paypalPayoutBatchId: string };
    expect(secondBody.paypalPayoutBatchId).toBe("BATCH-FRESH-1");

    // The retry minted a NEW sender batch id (the 4xx attempt is history).
    expect(senderIds).toHaveLength(2);
    expect(senderIds[0]).not.toBe(senderIds[1]);

    const attempts = await prisma.payoutAttempt.findMany({ where: { disbursementId: id }, orderBy: { createdAt: "asc" } });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.attemptState).toBe("FAILED");
    expect(attempts[1]!.attemptState).toBe("ACKNOWLEDGED");
  });
});
