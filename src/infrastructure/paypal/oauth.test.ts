// @vitest-environment node
/**
 * Slice 4.1: PayPal OAuth service (spec §11). Basic-auth token fetch,
 * cached until near expiry, 401 triggers a refresh, missing Payouts
 * scope fails with an actionable error. MSW intercepts the token
 * endpoint — the real PayPal API is never hit.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { PayPalSandboxAuth } from "./oauth";

const TOKEN_URL = "https://api-m.sandbox.paypal.com/v1/oauth2/token";
const PAYOUTS_SCOPE = "https://uri.paypal.com/payments/payouts";

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return HttpResponse.json({
    access_token: "access-token-1",
    token_type: "Bearer",
    expires_in: 3600,
    scope: `openid ${PAYOUTS_SCOPE}`,
    ...overrides,
  });
}

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function auth(now: () => number = Date.now) {
  return new PayPalSandboxAuth({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://api-m.sandbox.paypal.com",
    now,
  });
}

describe("PayPalSandboxAuth (Slice 4.1)", () => {
  it("caches the token within its validity window", async () => {
    let calls = 0;
    server.use(http.post(TOKEN_URL, () => { calls += 1; return tokenResponse(); }));
    const service = auth(() => 1_000);
    const first = await service.getAccessToken();
    const second = await service.getAccessToken();
    expect(first).toBe("access-token-1");
    expect(second).toBe("access-token-1");
    expect(calls).toBe(1);
  });

  it("refreshes the token once the validity window passes", async () => {
    let calls = 0;
    server.use(http.post(TOKEN_URL, () => { calls += 1; return tokenResponse(); }));
    let now = 1_000;
    const service = auth(() => now);
    await service.getAccessToken();
    now = 1_000 + 3_600_000; // past expiry
    await service.getAccessToken();
    expect(calls).toBe(2);
  });

  it("fails explicitly when the Payouts scope is missing", async () => {
    server.use(http.post(TOKEN_URL, () => tokenResponse({ scope: "openid" })));
    await expect(auth().getAccessToken()).rejects.toThrow(/missing the Payouts scope/i);
  });

  it("refreshes after a 401", async () => {
    let calls = 0;
    server.use(
      http.post(TOKEN_URL, () => {
        calls += 1;
        if (calls === 1) {
          return new HttpResponse("{}", { status: 401 });
        }
        return tokenResponse();
      }),
    );
    await expect(auth().getAccessToken()).resolves.toBe("access-token-1");
    expect(calls).toBe(2);
  });
});
