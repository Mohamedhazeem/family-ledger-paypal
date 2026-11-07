import "server-only";
import type { PayPalAuthPort } from "@/application/ports/paypal";

/**
 * PayPal sandbox OAuth (Slice 4.1, spec §11).
 * client_credentials via HTTP Basic; the token is cached until 60s
 * before expiry; a 401 clears the cache and refreshes; the returned
 * scope must include the Payouts scope or the call fails with an
 * actionable error. Server-only by construction (credentials never
 * reach the client).
 */
const PAYOUTS_SCOPE = "https://uri.paypal.com/services/payouts";
export const TOKEN_REFRESH_MARGIN_MS = 60_000;

export interface PayPalAuthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  /** Injectable clock for tests. */
  now?: () => number;
}

export class PayPalSandboxAuth implements PayPalAuthPort {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly now: () => number;
  private cached: { token: string; validUntil: number } | null = null;

  constructor(config: PayPalAuthConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = config.baseUrl;
    this.now = config.now ?? Date.now;
  }

  async getAccessToken(): Promise<string> {
    if (this.cached && this.now() < this.cached.validUntil) {
      return this.cached.token;
    }
    const fresh = await this.fetchToken();
    this.cached = fresh;
    return fresh.token;
  }

  private async fetchToken(retried = false): Promise<{ token: string; validUntil: number }> {
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });
    if (response.status === 401 && !retried) {
      // A 401 invalidates any cached token; refresh once and retry.
      this.cached = null;
      return this.fetchToken(true);
    }
    if (!response.ok) {
      throw new Error(`PayPal OAuth failed with HTTP ${response.status}.`);
    }
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!data.access_token) {
      throw new Error("PayPal OAuth response did not include an access token.");
    }
    const scopes = (data.scope ?? "").split(" ");
    if (!scopes.includes(PAYOUTS_SCOPE)) {
      throw new Error(
        "PayPal OAuth token is missing the Payouts scope (https://uri.paypal.com/services/payouts). " +
          "Grant Payouts access for this sandbox application in the PayPal developer dashboard.",
      );
    }
    const expiresInMs = (data.expires_in ?? 3600) * 1000;
    return {
      token: data.access_token,
      validUntil: this.now() + expiresInMs - TOKEN_REFRESH_MARGIN_MS,
    };
  }
}
