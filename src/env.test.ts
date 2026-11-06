/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV: Record<string, string> = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "test-auth-secret-at-least-16-chars",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/family_ledger",
  APP_ENCRYPTION_KEY: "a".repeat(32),
  AI_PROVIDER: "openai",
  AI_API_KEY: "sk-test-key",
  AI_MODEL: "gpt-4o-mini",
  PAYPAL_ENV: "sandbox",
  PAYPAL_CLIENT_ID: "client-id",
  PAYPAL_CLIENT_SECRET: "client-secret",
  PAYPAL_WEBHOOK_ID: "webhook-id",
  AG_STUDIO_LICENSE_KEY: "license-key",
  DEMO_MODE: "true",
  PORT: "10000",
};

describe("env (Slice 1.2)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("throws when required variables are missing", async () => {
    process.env = {} as unknown as typeof process.env;
    await expect(import("@/env")).rejects.toThrow(/Invalid environment variables/);
  });

  it("throws when a required variable is empty", async () => {
    process.env = { ...VALID_ENV, AUTH_SECRET: "" } as unknown as typeof process.env;
    await expect(import("@/env")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("loads successfully when all required variables are present", async () => {
    process.env = { ...VALID_ENV } as unknown as typeof process.env;
    const mod = await import("@/env");
    expect(mod.env).toBeDefined();
    expect(mod.env.APP_URL).toBe("http://localhost:3000");
    expect(mod.env.AI_PROVIDER).toBe("openai");
    expect(mod.env.PORT).toBe(10000);
    expect(mod.env.DEMO_MODE).toBe("true");
  });

  it("loads successfully without the optional PORT", async () => {
    const withoutPort = { ...VALID_ENV };
    delete withoutPort.PORT;
    process.env = withoutPort as unknown as typeof process.env;
    const mod = await import("@/env");
    expect(mod.env.PORT).toBeUndefined();
  });
});