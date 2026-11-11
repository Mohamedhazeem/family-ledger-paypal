/**
 * @vitest-environment node
 */
/**
 * Email adapters: the plan-proposal delivery path. Resend is intercepted
 * with MSW — the real provider is never hit.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { NoopEmailAdapter } from "./noop";
import { ResendEmailAdapter } from "./resend";
import type { PlanProposalEmailData } from "@/application/ports/email";

const DATA: PlanProposalEmailData = {
  to: "priya@example.com",
  beneficiaryDisplayName: "Priya Raman",
  programmeName: "Family Support Programme",
  amountMinor: 50000n,
  currency: "USD",
  items: [
    { category: "Rent", amountMinor: 30000n },
    { category: "Food", amountMinor: null },
  ],
  unallocatedMinor: 20000n,
  url: "https://app.example.com/beneficiary/token-abc",
  expiresAt: new Date("2026-11-18T00:00:00.000Z"),
};

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("NoopEmailAdapter.sendPlanProposal", () => {
  it("drops the proposal and reports noop delivery", async () => {
    const result = await new NoopEmailAdapter().sendPlanProposal(DATA);
    expect(result).toEqual({ delivered: false, provider: "noop" });
  });
});

describe("ResendEmailAdapter.sendPlanProposal", () => {
  it("posts the rendered proposal email", async () => {
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post("https://api.resend.com/emails", async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "email-1" });
      }),
    );

    const result = await new ResendEmailAdapter(
      "re_test_key",
      "FamilyLedger <onboarding@resend.dev>",
    ).sendPlanProposal(DATA);

    expect(result).toEqual({ delivered: true, provider: "resend" });
    expect(captured).not.toBeNull();
    expect(captured!.to).toBe("priya@example.com");
    expect(captured!.subject).toContain("Family Support Programme");
    const html = String(captured!.html);
    expect(html).toContain("$500.00");
    expect(html).toContain("$300.00");
    expect(html).toContain("Flexible");
    expect(html).toContain(DATA.url);
    expect(String(captured!.text)).toContain("$300.00");
  });

  it("returns delivered:false on a provider error", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => new HttpResponse(null, { status: 500 })),
    );
    const result = await new ResendEmailAdapter("re_test_key", "from@example.com").sendPlanProposal(DATA);
    expect(result).toEqual({ delivered: false, provider: "resend" });
  });
});
