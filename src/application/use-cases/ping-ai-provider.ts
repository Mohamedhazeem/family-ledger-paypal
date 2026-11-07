import type { AiPingResult, AiProvider } from "@/application/ports/ai";

/**
 * PingAiProvider use case (Slice 2.1): reports the configured AI
 * provider and model name. Depends only on the AiProvider port.
 */
export class PingAiProvider {
  private readonly provider: AiProvider;

  constructor(provider: AiProvider) {
    this.provider = provider;
  }

  async execute(): Promise<AiPingResult> {
    return this.provider.ping();
  }
}
