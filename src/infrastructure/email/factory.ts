import "server-only";
import type { EmailPort } from "@/application/ports/email";
import { NoopEmailAdapter } from "./noop";

/**
 * Factory: selects the EmailPort adapter from the environment
 * (ADR-0016). The MVP default is `noop`; a future provider (e.g.
 * Resend) registers here without touching callers. Unknown providers
 * throw instead of silently dropping invitations.
 */
export function createEmailAdapter(): EmailPort {
  const provider = process.env.EMAIL_PROVIDER ?? "noop";
  if (provider === "noop") {
    return new NoopEmailAdapter();
  }
  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${provider}. Supported: noop. ` +
      "Invitations remain available as copyable links.",
  );
}
