/**
 * PayPal port (ADR-0006, ADR-0017, spec Part C §11).
 * Defined in the application layer; adapters implement it from the
 * environment. No vendor SDK imports here.
 */

export interface PayPalAuthPort {
  /** Returns a cached OAuth access token, refreshing near expiry. */
  getAccessToken(): Promise<string>;
}
