import { describe, expect, it } from "vitest";
import { formatMinor, Money, toMinorUnits } from "@/domain/value-objects/money";

describe("Money (ADR-0003)", () => {
  it("converts USD 500.00 to 50000n minor units", () => {
    expect(toMinorUnits("500.00")).toBe(50000n);
    expect(Money.fromAmountText("500.00").minor).toBe(50000n);
    expect(Money.fromAmountText("500.00").format()).toBe("500.00");
  });

  it("handles whole and single-decimal amounts without floats", () => {
    expect(toMinorUnits("500")).toBe(50000n);
    expect(toMinorUnits("0.50")).toBe(50n);
    expect(formatMinor(50000n)).toBe("500.00");
    expect(formatMinor(5n)).toBe("0.05");
  });

  it("rejects >2 decimals, negatives and non-decimals", () => {
    expect(() => toMinorUnits("10.999")).toThrow();
    expect(() => toMinorUnits("-1.00")).toThrow();
    expect(() => toMinorUnits("abc")).toThrow();
    expect(() => toMinorUnits("")).toThrow();
  });

  it("rejects non-USD currency", () => {
    expect(() => toMinorUnits("500.00", "INR")).toThrow();
    expect(() => Money.fromMinor(50000n, "EUR")).toThrow();
  });
});
