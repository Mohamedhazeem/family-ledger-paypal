/**
 * Slice 3.8: beneficiary portal translations (spec §6, §12C).
 * Static EN/TA/HI dictionaries for display labels only — canonical
 * amounts and IDs are never translated.
 */
import { describe, expect, it } from "vitest";
import { BENEFICIARY_STRINGS, localizeView } from "./beneficiary";
import type { InvitationView } from "@/application/use-cases/get-invitation-view";

const VIEW: InvitationView = {
  disbursementId: "disbursement-1",
  programmeName: "Community Family Support Programme",
  beneficiaryDisplayName: "Priya Raman",
  beneficiaryLanguage: "en",
  amountMinor: 50000n,
  currency: "USD",
  items: [
    { category: "Rent", amountMinor: 30000n },
    { category: "School fees", amountMinor: 15000n },
    { category: "Food", amountMinor: 5000n },
  ],
  supportNote: null,
};

describe("beneficiary translations (Slice 3.8)", () => {
  it("every key exists in all three languages", () => {
    const keys = Object.keys(BENEFICIARY_STRINGS.en);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(BENEFICIARY_STRINGS.ta[key as keyof typeof BENEFICIARY_STRINGS.en]).toBeTruthy();
      expect(BENEFICIARY_STRINGS.hi[key as keyof typeof BENEFICIARY_STRINGS.en]).toBeTruthy();
    }
  });

  it("label strings differ across languages", () => {
    const en = BENEFICIARY_STRINGS.en;
    const ta = BENEFICIARY_STRINGS.ta;
    const hi = BENEFICIARY_STRINGS.hi;
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(ta[key]).not.toBe(en[key]);
      expect(hi[key]).not.toBe(en[key]);
    }
  });

  it("amountMinor is identical for every item across all three languages", () => {
    const en = localizeView(VIEW, "en");
    const ta = localizeView(VIEW, "ta");
    const hi = localizeView(VIEW, "hi");
    for (const localized of [en, ta, hi]) {
      expect(localized.view.amountMinor).toBe(50000n);
      expect(localized.view.items.map((i) => i.amountMinor)).toEqual([30000n, 15000n, 5000n]);
    }
  });
});
