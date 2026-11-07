import "server-only";
import OpenAI from "openai";
import type { AiPingResult, AiProvider } from "@/application/ports/ai";

/**
 * OpenAI-compatible adapter (ADR-0005, ADR-0016).
 * Wraps the `openai` SDK against any OpenAI-compatible base URL
 * (OpenAI, NVIDIA NIM, …), configured from the environment.
 * Config only — no network call is made in this slice.
 */
export interface OpenAiAdapterConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseURL?: string;
}

export class OpenAiAdapter implements AiProvider {
  readonly provider: string;
  readonly model: string;
  readonly baseURL: string | undefined;

  private readonly client: OpenAI;

  constructor(config: OpenAiAdapterConfig) {
    if (!config.apiKey) {
      throw new Error("AI_API_KEY is not set. Configure it in the environment (see .env.example).");
    }
    if (!config.model) {
      throw new Error("AI_MODEL is not set. Configure it in the environment (see .env.example).");
    }
    this.provider = config.provider;
    this.model = config.model;
    this.baseURL = config.baseURL?.trim() ? config.baseURL : undefined;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
  }

  async ping(): Promise<AiPingResult> {
    return { provider: this.provider, model: this.model };
  }
}
