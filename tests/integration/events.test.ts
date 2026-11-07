// @vitest-environment node
/**
 * Slice 3.9: every plan/payment action writes a LedgerEvent
 * (spec §9), the ledger is append-only at the application layer,
 * and events come back ordered by createdAt.
 *
 * Route-level integration: handlers run with a mocked coordinator
 * session; adapters and DB are real.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: () => "127.0.0.1",
  }),
}));

const { prisma } = await import("@/infrastructure/db/prisma");
const { PrismaLedgerEventRepository } = await import("@/infrastructure/db/repositories");

const createdDisbursementIds: string[] = [];

beforeAll(async () => {
  const coordinator = await prisma.user.findUniqueOrThrow({ where: { email: "alex.morgan@example.com" } });
  sessionState.session = { user: { id: coordinator.id, email: coordinator.email } };
});

afterAll(async () => {
  for (const id of createdDisbursementIds) {
    await prisma.ledgerEvent.deleteMany({ where: { disbursementId: id } });
    await prisma.recipientInvitation.deleteMany({ where: { disbursementId: id } });
    await prisma.planItem.deleteMany({ where: { planVersion: { disbursementId: id } } });
    await prisma.planVersion.deleteMany({ where: { disbursementId: id } });
    await prisma.disbursement.delete({ where: { id } });
  }
  await prisma.$disconnect();
});

async function createDisbursement(withPlan: boolean): Promise<string> {
  const { POST } = await import("@/app/api/disbursements/route");
  const res = await POST(
    new Request("http://localhost/api/disbursements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        beneficiary: {
          displayName: "Event Test",
          invitationEmail: "event-test@example.com",
          payPalRecipientEmail: "event-test.paypal@example.com",
          preferredLanguage: "en",
        },
        amountText: "500.00",
        currency: "USD",
        supportNote: "Event test",
        ...(withPlan
          ? { plan: { summary: "Event plan", items: [{ category: "Rent", amountText: "300.00" }] } }
          : {}),
      }),
    }),
  );
  const body = (await res.json()) as { id: string };
  createdDisbursementIds.push(body.id);
  return body.id;
}

async function tokenFor(disbursementId: string): Promise<string> {
  const { POST } = await import("@/app/api/disbursements/[id]/invitations/route");
  const res = await POST(new Request("http://localhost/x"), { params: Promise.resolve({ id: disbursementId }) });
  const body = (await res.json()) as { url: string };
  return body.url.split("/").pop()!;
}

async function postToken(
  path: string,
  token: string,
  body?: unknown,
): Promise<Response> {
  const mod = await import(`@/app/api/beneficiary/[token]/${path}/route`);
  return mod.POST(
    body === undefined
      ? new Request("http://localhost/x")
      : new Request("http://localhost/x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
    { params: Promise.resolve({ token }) },
  );
}

describe("LedgerEvent append-only (Slice 3.9)", () => {
  it("every create/invitation/accept/suggest/decline/acknowledge action writes an event", async () => {
    const id = await createDisbursement(true);
    const token = await tokenFor(id);

    await postToken("accept", token);
    await postToken("decline", token);
    await postToken("suggest", token, { items: [{ category: "Rent", amountText: "200.00" }] });

    const { POST } = await import("@/app/api/disbursements/[id]/acknowledge/route");
    await POST(new Request("http://localhost/x"), { params: Promise.resolve({ id }) });

    const types = (
      await prisma.ledgerEvent.findMany({ where: { disbursementId: id }, orderBy: { createdAt: "asc" } })
    ).map((e) => e.eventType);
    expect(types).toContain("DISBURSEMENT_CREATED");
    expect(types).toContain("PLAN_VERSION_CREATED");
    expect(types).toContain("INVITATION_CREATED");
    expect(types).toContain("PLAN_ACCEPTED");
    expect(types).toContain("PLAN_DECLINED");
    expect(types).toContain("PLAN_REVISION_PROPOSED");
    expect(types).toContain("PLAN_ACKNOWLEDGED");
  });

  it("a disbursement created without a plan still logs its creation", async () => {
    const id = await createDisbursement(false);
    const types = (
      await prisma.ledgerEvent.findMany({ where: { disbursementId: id }, orderBy: { createdAt: "asc" } })
    ).map((e) => e.eventType);
    expect(types).toEqual(["DISBURSEMENT_CREATED"]);
  });

  it("the ledger repository exposes no update or delete operation", () => {
    const repo = new PrismaLedgerEventRepository();
    expect("update" in repo).toBe(false);
    expect("delete" in repo).toBe(false);
  });

  it("events come back ordered by createdAt", async () => {
    const id = await createDisbursement(true);
    const token = await tokenFor(id);
    await postToken("accept", token);
    const events = await prisma.ledgerEvent.findMany({
      where: { disbursementId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const timestamps = events.map((e) => e.createdAt.getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    expect(events.map((e) => e.eventType)).toEqual([
      "DISBURSEMENT_CREATED",
      "PLAN_VERSION_CREATED",
      "INVITATION_CREATED",
      "PLAN_ACCEPTED",
    ]);
  });
});
