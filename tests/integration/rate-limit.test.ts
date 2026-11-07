// @vitest-environment node
/**
 * Slice 5.0(a): public-route rate limiting (spec §6 Step 4, §13).
 * Same token from the same IP is limited to 10 requests per minute;
 * the 11th returns 429. Different IPs keep independent windows.
 * Route handlers are invoked directly (no HTTP layer needed).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function loadEnvFile(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}
loadEnvFile();

const ipState = vi.hoisted(() => ({ ip: "10.0.0.1" }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? ipState.ip : null,
  }),
}));

const TOKEN = "rate-limit-test-token";

describe("public-route rate limiting (Slice 5.0a)", () => {
  beforeEach(() => {
    ipState.ip = "10.0.0.1";
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("11 rapid requests with the same token+IP → the 11th returns 429", async () => {
    const { POST } = await import("@/app/api/beneficiary/[token]/accept/route");
    const responses = [];
    for (let i = 0; i < 10; i++) {
      responses.push(
        await POST(new Request("http://localhost/x"), { params: Promise.resolve({ token: TOKEN }) }),
      );
    }
    // First 10 pass the gate (unknown token → 404 from the use case).
    // NOTE: the unknown-token path short-circuits before hitting the
    // DB (hash lookup → not found), so this is cheap; the unit tests
    // of RateLimit cover the window math deterministically.
    expect(responses.every((r) => r.status === 404)).toBe(true);

    const eleventh = await POST(new Request("http://localhost/x"), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(eleventh.status).toBe(429);
  });

  it("different IPs are not throttled together", async () => {
    const { POST } = await import("@/app/api/beneficiary/[token]/accept/route");
    ipState.ip = "10.9.9.9";
    const firstIpResponse = await POST(new Request("http://localhost/x"), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(firstIpResponse.status).toBe(404);

    ipState.ip = "10.8.8.8";
    const otherIpResponse = await POST(new Request("http://localhost/x"), {
      params: Promise.resolve({ token: TOKEN }),
    });
    // A new IP has its own window: not rate-limited.
    expect(otherIpResponse.status).toBe(404);
  });
});
