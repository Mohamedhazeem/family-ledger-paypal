import "server-only";
import type { EmailMessage, EmailPort, EmailResult } from "@/application/ports/email";

/**
 * Resend email adapter (optional, spec §6 Step 4). Uses the Resend
 * HTTP API directly so no SDK dependency is required. Activated via
 * EMAIL_PROVIDER=resend + RESEND_API_KEY. Failures are returned as
 * delivered:false rather than thrown, so invitation creation never
 * breaks because of an email outage.
 */
export class ResendEmailAdapter implements EmailPort {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!res.ok) {
        return { delivered: false, provider: "resend" };
      }
      return { delivered: true, provider: "resend" };
    } catch {
      return { delivered: false, provider: "resend" };
    }
  }
}
