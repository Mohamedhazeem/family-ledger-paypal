/**
 * Clock port (ADR-0016, ADR-0017).
 * All time-derived logic (invitation expiry, token lifetime) goes
 * through this port so tests can freeze time. No vendor imports.
 */

export interface Clock {
  /** Current time as epoch milliseconds. */
  now(): number;
  /** Current time as a Date. */
  date(): Date;
}
