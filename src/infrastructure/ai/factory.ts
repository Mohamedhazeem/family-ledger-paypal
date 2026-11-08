import "server-only";
import type { AiProvider } from "@/application/ports/ai";
import { OpenAiAdapter } from "./openai";
import { MockAiAdapter } from "./mock";

/**
 * Factory: selects the AiProvider adapter from the environment
 * (ADR-0016, AGENTS §4). `openai` uses the OpenAI-compatible adapter;
 * `mock` is the deterministic offline fallback for tests/dev. Unknown
 * providers throw instead of silently falling back.
 */
export function createAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER;
  if (provider === "mock") {
    return new MockAiAdapter();
  }
  if (provider === "openai") {
    return new OpenAiAdapter({
      provider,
      apiKey: process.env.AI_API_KEY ?? "",
      model: process.env.AI_MODEL ?? "",
      baseURL: process.env.AI_BASE_URL,
    });
  }
  throw new Error(`Unsupported AI_PROVIDER: ${provider ?? "(unset)"}. Supported: openai.`);
}
