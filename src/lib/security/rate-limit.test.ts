/**
 * Slice 3.2: public invitation lookup rate limiting (ADR-0007).
 * In-memory per-key window counter (single-instance MVP).
 */
import { describe, expect, it } from "vitest";
import { RateLimit } from "./rate-limit";

describe("RateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const limit = new RateLimit({ max: 2, windowMs: 60_000 });
    expect(limit.check("ip-1", 0)).toBe(true);
    expect(limit.check("ip-1", 1_000)).toBe(true);
  });

  it("blocks after the limit is exceeded in the window", () => {
    const limit = new RateLimit({ max: 2, windowMs: 60_000 });
    expect(limit.check("ip-1", 0)).toBe(true);
    expect(limit.check("ip-1", 1_000)).toBe(true);
    expect(limit.check("ip-1", 2_000)).toBe(false);
  });

  it("resets after the window passes", () => {
    const limit = new RateLimit({ max: 1, windowMs: 60_000 });
    expect(limit.check("ip-1", 0)).toBe(true);
    expect(limit.check("ip-1", 1_000)).toBe(false);
    expect(limit.check("ip-1", 61_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limit = new RateLimit({ max: 1, windowMs: 60_000 });
    expect(limit.check("ip-1", 0)).toBe(true);
    expect(limit.check("ip-2", 0)).toBe(true);
  });
});
