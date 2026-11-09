/**
 * Email port (ADR-0016, spec §6 Step 4).
 * Invitations work via copyable link without any email provider; the
 * port exists so a provider can be added later without touching
 * business logic. No vendor SDK imports here.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. When provided, Resend sends a multipart message. */
  html?: string;
  /**
   * Optional Resend template reference. When provided, Resend renders the
   * published template and `html`/`text` must be omitted (Resend rejects
   * mixed payloads).
   */
  template?: {
    id: string;
    variables?: Record<string, string | number | boolean>;
  };
}

export interface EmailResult {
  /** True when the message was handed to a provider; false for noop. */
  delivered: boolean;
  /** Provider identifier recorded in logs (never keys or content). */
  provider: string;
}

export interface EmailPort {
  send(_message: EmailMessage): Promise<EmailResult>;
}
