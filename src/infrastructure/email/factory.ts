import "server-only";
import type { EmailPort } from "@/application/ports/email";
import { NoopEmailAdapter } from "./noop";
import { ResendEmailAdapter } from "./resend";

/**
 * Factory: selects the EmailPort adapter from the environment
 * (ADR-0016). Default is `noop` (copyable links only). `resend`
 * requires RESEND_API_KEY. Unknown providers throw instead of
 * silently dropping invitations.
 */
export function createEmailAdapter(): EmailPort {
  const provider = process.env.EMAIL_PROVIDER ?? "noop";
  if (provider === "noop" || provider === "") {
    return new NoopEmailAdapter();
  }
  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is required when EMAIL_PROVIDER=resend. " +
          "Invitations remain available as copyable links.",
      );
    }
    const from = process.env.RESEND_FROM ?? "FamilyLedger <onboarding@resend.dev>";
    return new ResendEmailAdapter(apiKey, from);
  }
  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${provider}. Supported: noop, resend. ` +
      "Invitations remain available as copyable links.",
  );
}
