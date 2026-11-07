/**
 * AiProvider port (ADR-0005, ADR-0016, ADR-0017, spec Part C §12).
 * Defined in the application layer; adapters implement it from the
 * environment. No vendor SDK imports here.
 */

export interface AiPingResult {
  provider: string;
  model: string;
}

export interface AiProvider {
  /** Config probe: returns the configured provider and model name. */
  ping(): Promise<AiPingResult>;
}
