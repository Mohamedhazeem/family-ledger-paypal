import "server-only";
import type {
  EmailMessage,
  EmailPort,
  EmailResult,
  PlanProposalEmailData,
} from "@/application/ports/email";
import { buildPlanProposalEmail } from "./plan-proposal-template";

/**
 * Resend email adapter (optional, spec §6 Step 4). Uses the Resend
 * HTTP API directly so no SDK dependency is required. Activated via
 * EMAIL_PROVIDER=resend + RESEND_API_KEY. Failures are returned as
 * delivered:false rather than thrown, so invitation creation never
 * breaks because of an email outage.
 */
/**
 * Extract a short, non-sensitive reason from a provider error body.
 * Email addresses are redacted so PII never reaches the UI or logs.
 */
function safeError(raw: string): string {
  const redacted = raw.replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g, "[redacted]");
  try {
    const parsed = JSON.parse(redacted) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return parsed.message.slice(0, 200);
    }
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return redacted.slice(0, 200).trim() || "Resend rejected the request.";
}

export class ResendEmailAdapter implements EmailPort {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const body: Record<string, unknown> = {
        from: this.from,
        to: message.to,
        subject: message.subject,
      };
      if (message.template) {
        body.template = message.template;
      } else {
        body.text = message.text;
        if (message.html) body.html = message.html;
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return {
          delivered: false,
          provider: "resend",
          error: safeError(await res.text().catch(() => "")),
        };
      }
      return { delivered: true, provider: "resend" };
    } catch {
      return { delivered: false, provider: "resend", error: "Could not reach Resend." };
    }
  }

  async sendPlanProposal(data: PlanProposalEmailData): Promise<EmailResult> {
    const email = buildPlanProposalEmail(data);
    return this.send({
      to: data.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }
}
