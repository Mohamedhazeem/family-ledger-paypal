/**
 * Email + analytics fallback adapters (ADR-0016).
 */
import { describe, expect, it } from "vitest";
import { NoopEmailAdapter } from "./noop";
import { createEmailAdapter } from "./factory";
import { buildGridFallbackModel } from "@/infrastructure/analytics/ag-grid-fallback";

describe("NoopEmailAdapter", () => {
  it("accepts and drops messages", async () => {
    const result = await new NoopEmailAdapter().send({
      to: "beneficiary@example.com",
      subject: "Invitation",
      text: "link",
    });
    expect(result).toEqual({ delivered: false, provider: "noop" });
  });

  it("factory defaults to noop and rejects unknown providers", () => {
    const old = process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_PROVIDER;
    try {
      expect(createEmailAdapter()).toBeInstanceOf(NoopEmailAdapter);
      process.env.EMAIL_PROVIDER = "definitely-unknown";
      expect(() => createEmailAdapter()).toThrow(/Unsupported EMAIL_PROVIDER/);
      // resend is supported but requires a key.
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;
      expect(() => createEmailAdapter()).toThrow(/RESEND_API_KEY/);
    } finally {
      if (old === undefined) delete process.env.EMAIL_PROVIDER;
      else process.env.EMAIL_PROVIDER = old;
    }
  });
});

describe("buildGridFallbackModel", () => {
  it("maps aggregate DTOs without PII", () => {
    const model = buildGridFallbackModel({
      organizationId: "org-1",
      totalDisbursements: 2,
      totalAmountMinor: "100000",
      byPlanStatus: [{ status: "DRAFT", count: 2 }],
      byPaymentStatus: [{ status: "NOT_SENT", count: 2 }],
      byAttemptState: [],
      categories: [{ category: "Rent", amountMinor: "50000", itemCount: 1 }],
      generatedAt: new Date().toISOString(),
    });
    expect(model.totals.totalDisbursements).toBe(2);
    expect(model.categories).toEqual([{ category: "Rent", amountMinor: "50000", itemCount: 1 }]);
    expect(JSON.stringify(model)).not.toMatch(/@example\.com|tokenHash/i);
  });
});
