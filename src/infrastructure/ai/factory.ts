import "server-only";
import type { AiProvider } from "@/application/ports/ai";
import { OpenAiAdapter } from "./openai";

/**
 * Factory: selects the AiProvider adapter from the environment
 * (ADR-0016, AGENTS §4). One OpenAI-compatible adapter only;
 * unknown providers throw instead of silently falling back.
 */
export function createAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER;
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
