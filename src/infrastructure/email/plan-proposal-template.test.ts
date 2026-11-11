/**
 * Plan-proposal email template: renders the latest plan version with
 * canonical amounts and escapes every dynamic value. The free-text
 * support note is never part of this template.
 */
import { describe, expect, it } from "vitest";
import { buildPlanProposalEmail } from "./plan-proposal-template";
import type { PlanProposalEmailData } from "@/application/ports/email";

const DATA: PlanProposalEmailData = {
  to: "priya@example.com",
  beneficiaryDisplayName: "Priya Raman",
  programmeName: "Family Support <Programme>",
  amountMinor: 50000n,
  currency: "USD",
  items: [
    { category: "Rent", amountMinor: 30000n },
    { category: "School fees", amountMinor: 15000n },
    { category: "Food", amountMinor: null },
  ],
  unallocatedMinor: 5000n,
  url: "https://app.example.com/beneficiary/token-abc",
  expiresAt: new Date("2026-11-18T00:00:00.000Z"),
};

describe("buildPlanProposalEmail", () => {
  it("includes the total, category amounts, remainder and secure link", () => {
    const email = buildPlanProposalEmail(DATA);
    expect(email.subject).toContain("Family Support <Programme>");
    expect(email.text).toContain("$500.00 USD");
    expect(email.text).toContain("Rent: $300.00");
    expect(email.text).toContain("School fees: $150.00");
    expect(email.text).toContain("Food: Flexible");
    expect(email.text).toContain("Flexible / unallocated support: $50.00");
    expect(email.text).toContain(DATA.url);
    expect(email.html).toContain("$500.00");
    expect(email.html).toContain("$300.00");
    expect(email.html).toContain("Flexible");
    expect(email.html).toContain(DATA.url);
  });

  it("escapes HTML in programme, beneficiary and category values", () => {
    const email = buildPlanProposalEmail({
      ...DATA,
      programmeName: "<script>alert('x')</script>",
      beneficiaryDisplayName: "<b>Priya</b>",
      items: [{ category: "<img onerror=alert(1)>", amountMinor: 100n }],
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Priya</b>");
    expect(email.html).not.toContain("<img onerror");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("<script>alert('x')</script>");
  });

  it("omits the unallocated line when nothing remains", () => {
    const email = buildPlanProposalEmail({ ...DATA, unallocatedMinor: 0n });
    expect(email.text).not.toContain("Flexible / unallocated support");
    expect(email.html).not.toContain("Flexible / unallocated support");
  });
});
