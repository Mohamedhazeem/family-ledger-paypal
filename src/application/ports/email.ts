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
  /**
   * Short provider-supplied reason when `delivered` is false (email
   * addresses redacted). Absent for the noop adapter and on success.
   */
  error?: string;
}

/** One proposed category line in the plan-proposal email. */
export interface PlanProposalEmailItem {
  category: string;
  /** Canonical integer minor units; null = flexible/unallocated line. */
  amountMinor: bigint | null;
}

/**
 * Data the adapter needs to render the plan-proposal email. Amounts are
 * canonical minor units and are never translated; the adapter formats
 * them for display only.
 */
export interface PlanProposalEmailData {
  to: string;
  beneficiaryDisplayName: string;
  programmeName: string;
  amountMinor: bigint;
  currency: string;
  items: PlanProposalEmailItem[];
  unallocatedMinor: bigint;
  url: string;
  expiresAt: Date;
}

export interface EmailPort {
  send(_message: EmailMessage): Promise<EmailResult>;
  /**
   * Deliver the latest plan proposal (summary + secure link) to the
   * beneficiary. Best-effort: adapters return `delivered: false` rather
   * than throwing, so the copyable link always remains the fallback.
   */
  sendPlanProposal(_data: PlanProposalEmailData): Promise<EmailResult>;
}
