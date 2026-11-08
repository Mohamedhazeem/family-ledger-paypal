import "server-only";
import type { EmailMessage, EmailPort, EmailResult } from "@/application/ports/email";

/**
 * Noop email adapter (spec §6 Step 4): invitations are delivered via
 * copyable links, so the MVP needs no email provider. Messages are
 * accepted and dropped; the caller can always fall back to the link.
 */
export class NoopEmailAdapter implements EmailPort {
  async send(_message: EmailMessage): Promise<EmailResult> {
    void _message;
    return { delivered: false, provider: "noop" };
  }
}
