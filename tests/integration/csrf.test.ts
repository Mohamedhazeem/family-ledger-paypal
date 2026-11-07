// @vitest-environment node
/**
 * Slice 5.0(d): CSRF origin check (spec §13).
 * State-changing operator routes reject cross-origin POSTs
 * (mismatched Origin header) with 403 while same-origin and
 * non-browser (no Origin) requests proceed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

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

describe("origin check on state-changing routes (Slice 5.0d)", () => {
  it("rejects a cross-origin POST with 403", async () => {
    const { POST } = await import("@/app/api/disbursements/route");
    const res = await POST(
      new Request("http://localhost/api/disbursements", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example.com" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("allows a same-origin POST past the origin check (reaches validation)", async () => {
    const { POST } = await import("@/app/api/disbursements/route");
    const res = await POST(
      new Request("http://localhost/api/disbursements", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({}),
      }),
    );
    // Session-less requests hit the auth gate; the origin check runs
    // first, so 401 (not 403) proves the origin passed.
    expect(res.status).toBe(401);
  });

  it("does not 403 non-browser requests without an Origin header", async () => {
    const { POST } = await import("@/app/api/disbursements/route");
    const res = await POST(
      new Request("http://localhost/api/disbursements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(401);
  });
});
