/**
 * Mock adapters (ADR-0016): deterministic offline stand-ins for
 * tests/dev. Mock AI never invents amounts; Mock PayPal never calls
 * the network.
 */
import { describe, expect, it } from "vitest";
import { MockAiAdapter } from "./mock";
import { MockPayPalAdapter } from "@/infrastructure/paypal/mock";
import { createAiProvider } from "./factory";
import { createPayoutsAdapter } from "@/infrastructure/paypal/factory";

describe("MockAiAdapter", () => {
  it("ping reports mock provider", async () => {
    await expect(new MockAiAdapter().ping()).resolves.toEqual({
      provider: "mock",
      model: "mock-v1",
    });
  });

  it("parseIntent never invents amounts", async () => {
    const plan = await new MockAiAdapter().parseIntent({
      note: "$300 for rent",
      amountMinor: 50000n,
      currency: "USD",
    });
    expect(plan.items).toEqual([]);
    expect(plan.requiresClarification).toBe(true);
  });

  it("explainDiff is deterministic and neutral", async () => {
    const result = await new MockAiAdapter().explainDiff({
      added: [{ category: "Medicine", v1AmountMinor: null, v2AmountMinor: 5000n, deltaMinor: 5000n }],
      removed: [],
      changed: [],
      unchanged: [],
    });
    expect(result.explanation).toContain("1 added");
    expect(result.explanation).not.toMatch(/misused|suspicious|failed/i);
  });

  it("translate passes text through unchanged", async () => {
    const result = await new MockAiAdapter().translate({ text: "Rent $300.00", targetLang: "ta" });
    expect(result.translatedText).toBe("Rent $300.00");
  });

  it("factory selects mock adapter when AI_PROVIDER=mock", () => {
    const old = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "mock";
    try {
      expect(createAiProvider()).toBeInstanceOf(MockAiAdapter);
    } finally {
      process.env.AI_PROVIDER = old;
    }
  });
});

describe("MockPayPalAdapter", () => {
  it("createBatch returns a deterministic PENDING batch without network", async () => {
    const result = await new MockPayPalAdapter().createBatch({
      senderBatchId: "FL-BATCH-TEST",
      senderItemId: "FL-BATCH-TEST-ITM",
      publicReference: "FL-TEST-001",
      receiverEmail: "recipient@example.com",
      amountMinor: 50000n,
      currency: "USD",
    });
    expect(result.payoutBatchId).toBe("MOCK-FL-BATCH-TEST");
    expect(result.batchStatus).toBe("PENDING");
    expect(result.paymentStatus).toBe("PENDING");
  });

  it("getBatchStatus mirrors the batch id", async () => {
    const result = await new MockPayPalAdapter().getBatchStatus("MOCK-FL-BATCH-TEST");
    expect(result.batchStatus).toBe("PENDING");
    expect(result.itemStatus).toBe("PENDING");
    expect(result.paymentStatus).toBe("PENDING");
  });

  it("factory selects mock adapter when PAYPAL_ENV=mock", () => {
    const old = process.env.PAYPAL_ENV;
    process.env.PAYPAL_ENV = "mock";
    try {
      expect(createPayoutsAdapter()).toBeInstanceOf(MockPayPalAdapter);
    } finally {
      process.env.PAYPAL_ENV = old;
    }
  });
});
