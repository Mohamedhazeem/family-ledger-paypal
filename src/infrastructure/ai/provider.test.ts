/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAiProvider } from "./factory";
import { OpenAiAdapter } from "./openai";

/**
 * Slice 2.1 acceptance tests: the OpenAI-compatible adapter must build
 * from env (AI_PROVIDER/AI_BASE_URL/AI_MODEL), and changing AI_BASE_URL
 * must change the baseURL the client is built with.
 */
describe("createAiProvider (Slice 2.1)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "sk-test-key";
    process.env.AI_MODEL = "model-a";
    process.env.AI_BASE_URL = "https://a.example/v1";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds an OpenAI-compatible adapter from env", () => {
    const provider = createAiProvider();
    expect(provider).toBeInstanceOf(OpenAiAdapter);
    const adapter = provider as OpenAiAdapter;
    expect(adapter.provider).toBe("openai");
    expect(adapter.model).toBe("model-a");
    expect(adapter.baseURL).toBe("https://a.example/v1");
  });

  it("changing AI_BASE_URL changes the adapter baseURL", () => {
    process.env.AI_BASE_URL = "https://integrate.api.nvidia.com/v1";
    const adapter = createAiProvider() as OpenAiAdapter;
    expect(adapter.baseURL).toBe("https://integrate.api.nvidia.com/v1");
  });

  it("throws for an unsupported AI_PROVIDER", () => {
    process.env.AI_PROVIDER = "anthropic";
    expect(() => createAiProvider()).toThrow(/Unsupported AI_PROVIDER/);
  });

  it("ping returns the configured provider and model name", async () => {
    const result = await createAiProvider().ping();
    expect(result).toEqual({ provider: "openai", model: "model-a" });
  });
});
