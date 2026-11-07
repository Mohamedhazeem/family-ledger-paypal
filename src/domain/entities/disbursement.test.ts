import { describe, expect, it } from "vitest";
import { canSubmitPayout, createDisbursement, PAYMENT_STATUSES, PLAN_STATUSES } from "@/domain/entities/disbursement";

describe("createDisbursement (spec §6, ADR-0004)", () => {
  it("starts DRAFT / NOT_SENT with null PayPal fields", () => {
    const d = createDisbursement({
      publicReference: "FL-TEST-001",
      organizationId: "org-1",
      coordinatorId: "user-1",
      beneficiaryId: "ben-1",
      amountMinor: 50000n,
      supportNote: "Please allocate $300 for rent, $150 for school fees and $50 for food.",
    });
    expect(d.planStatus).toBe("DRAFT");
    expect(d.paymentStatus).toBe("NOT_SENT");
    expect(d.currency).toBe("USD");
    expect(d.amountMinor).toBe(50000n);
    expect(d.paypalPayoutBatchId).toBeNull();
    expect(d.paymentMode).toBe("SANDBOX");
  });

  it("keeps plan and payment state machines independent", () => {
    expect(PLAN_STATUSES).toContain("BENEFICIARY_DECLINED_TO_SHARE");
    expect(PAYMENT_STATUSES).toContain("NOT_SENT");
    // Declining to share a plan must not change payment eligibility.
    expect(PAYMENT_STATUSES).not.toContain("BENEFICIARY_DECLINED_TO_SHARE");
  });

  it("rejects non-positive amounts and non-USD currency", () => {
    const base = {
      publicReference: "FL-TEST-002",
      organizationId: "org-1",
      coordinatorId: "user-1",
      beneficiaryId: "ben-1",
      supportNote: "note",
    };
    expect(() => createDisbursement({ ...base, amountMinor: 0n })).toThrow();
    expect(() => createDisbursement({ ...base, amountMinor: -1n })).toThrow();
    expect(() => createDisbursement({ ...base, amountMinor: 100n, currency: "INR" })).toThrow();
  });
});

describe("canSubmitPayout (spec §4.4-4.5, ADR-0004)", () => {
  function disbursementWith(planStatus: (typeof PLAN_STATUSES)[number], paymentStatus: (typeof PAYMENT_STATUSES)[number]) {
    const d = createDisbursement({
      publicReference: "FL-PAYOUT-001",
      organizationId: "org-1",
      coordinatorId: "user-1",
      beneficiaryId: "ben-1",
      amountMinor: 50000n,
      supportNote: "note",
    });
    return { ...d, planStatus, paymentStatus };
  }

  it("returns true after declining to share (payment unchanged)", () => {
    expect(
      canSubmitPayout(disbursementWith("BENEFICIARY_DECLINED_TO_SHARE", "NOT_SENT")),
    ).toBe(true);
  });

  it("ignores planStatus entirely", () => {
    for (const planStatus of PLAN_STATUSES) {
      expect(canSubmitPayout(disbursementWith(planStatus, "NOT_SENT"))).toBe(true);
      expect(canSubmitPayout(disbursementWith(planStatus, "READY"))).toBe(true);
    }
  });

  it("returns false once payment has moved past the pre-send states", () => {
    expect(canSubmitPayout(disbursementWith("DRAFT", "SUBMITTING"))).toBe(false);
    expect(canSubmitPayout(disbursementWith("DRAFT", "SUCCESS"))).toBe(false);
    expect(canSubmitPayout(disbursementWith("DRAFT", "FAILED"))).toBe(false);
  });
});
