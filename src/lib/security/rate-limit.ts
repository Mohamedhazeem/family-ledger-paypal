/**
 * Rate limit (ADR-0007, spec §13): in-memory per-key sliding window
 * counter for the public invitation lookup. Single-instance MVP;
 * replace with a shared store if the app scales out.
 */
export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export class RateLimit {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly counts = new Map<string, { windowStart: number; count: number }>();

  constructor(options: RateLimitOptions) {
    this.max = options.max;
    this.windowMs = options.windowMs;
  }

  /** Returns true when the request is allowed. */
  check(key: string, nowMs: number = Date.now()): boolean {
    const entry = this.counts.get(key);
    if (!entry || nowMs - entry.windowStart >= this.windowMs) {
      this.counts.set(key, { windowStart: nowMs, count: 1 });
      return true;
    }
    if (entry.count >= this.max) {
      return false;
    }
    entry.count += 1;
    return true;
  }
}
