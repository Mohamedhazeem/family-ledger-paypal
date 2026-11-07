// @vitest-environment node
/**
 * Slice 5.0(b): security headers (spec §13). A request to the API
 * returns all five headers with expected values. Route handlers are
 * invoked directly with a mocked coordinator session.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const sessionState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => sessionState.session,
}));

describe("security headers (Slice 5.0b)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the five security headers on an API response", async () => {
    sessionState.session = { user: { id: "coordinator-1", email: "coord@example.com" } };
    vi.stubEnv("NODE_ENV", "production");
    const { GET } = await import("@/app/api/ai/ping/route");
    const res = await GET();
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });

  it("omits HSTS outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { GET } = await import("@/app/api/ai/ping/route");
    const res = await GET();
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });
});
