import { describe, expect, it } from "vitest";
import {
  formatCreatedDate,
  formatStatusLabel,
  initials,
  sumMinor,
  toneForStatus,
} from "./disbursement-formatting";

describe("formatStatusLabel", () => {
  it("turns BENEFICIARY_ACCEPTED into a friendly label", () => {
    expect(formatStatusLabel("BENEFICIARY_ACCEPTED")).toBe("Accepted");
  });

  it("turns BENEFICIARY_DECLINED_TO_SHARE into a friendly label", () => {
    expect(formatStatusLabel("BENEFICIARY_DECLINED_TO_SHARE")).toBe("Declined to share");
  });

  it("falls back to title case for unknown statuses", () => {
    expect(formatStatusLabel("STATUS_UNKNOWN")).toBe("Unknown");
  });
});

describe("toneForStatus", () => {
  it("maps SUCCESS to success", () => {
    expect(toneForStatus("SUCCESS")).toBe("success");
  });

  it("maps FAILED to danger", () => {
    expect(toneForStatus("FAILED")).toBe("danger");
  });

  it("maps PENDING to info", () => {
    expect(toneForStatus("PENDING")).toBe("info");
  });

  it("maps DRAFT to neutral", () => {
    expect(toneForStatus("DRAFT")).toBe("neutral");
  });
});

describe("formatCreatedDate", () => {
  it("formats an ISO date as 7 Nov 2026", () => {
    expect(formatCreatedDate("2026-11-07T10:00:00.000Z")).toBe("7 Nov 2026");
  });
});

describe("initials", () => {
  it("derives initials from a display name", () => {
    expect(initials("Priya Raman")).toBe("PR");
  });

  it("handles single-word names", () => {
    expect(initials("Muthu")).toBe("M");
  });
});

describe("sumMinor", () => {
  it("sums minor-unit strings with integer arithmetic", () => {
    expect(sumMinor(["50000", "25000", "10000"])).toBe(85000n);
  });

  it("returns 0n for an empty list", () => {
    expect(sumMinor([])).toBe(0n);
  });
});
