import "server-only";
import type { PayPalAuthPort } from "@/application/ports/paypal";

/**
 * PayPal payout webhook signature verifier (spec §11 stretch).
 * Sends the received event to PayPal's Verify Webhook Signature
 * endpoint (POST /v1/notifications/verify-webhook-signature) with a
 * bearer token. Only events with verification_status SUCCESS are
 * trusted; anything else is rejected.
 */

export interface WebhookEventPayload {
  id?: string;
  event_type?: string;
  resource?: {
    payout_batch_id?: string;
    batch_status?: string;
    id?: string;
  };
}

export interface WebhookSignatureHeaders {
  authAlgo: string | null;
  transmissionId: string | null;
  transmissionSig: string | null;
  transmissionTime: string | null;
}

export class PayPalWebhookVerifier {
  private readonly auth: PayPalAuthPort;
  private readonly baseUrl: string;
  private readonly webhookId: string;

  constructor(config: { auth: PayPalAuthPort; baseUrl: string; webhookId: string }) {
    this.auth = config.auth;
    this.baseUrl = config.baseUrl;
    this.webhookId = config.webhookId;
  }

  /** Extracts the Payouts signature headers PayPal signs with. */
  static fromHeaders(headers: Headers): WebhookSignatureHeaders {
    return {
      authAlgo: headers.get("paypal-auth-algo"),
      transmissionId: headers.get("paypal-transmission-id"),
      transmissionSig: headers.get("paypal-transmission-sig"),
      transmissionTime: headers.get("paypal-transmission-time"),
    };
  }

  /** Returns true only when PayPal confirms the signature. */
  async verify(event: WebhookEventPayload, sig: WebhookSignatureHeaders): Promise<boolean> {
    if (
      !sig.authAlgo ||
      !sig.transmissionId ||
      !sig.transmissionSig ||
      !sig.transmissionTime ||
      !this.webhookId
    ) {
      return false;
    }
    const token = await this.auth.getAccessToken();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth_algo: sig.authAlgo,
          transmission_id: sig.transmissionId,
          transmission_sig: sig.transmissionSig,
          transmission_time: sig.transmissionTime,
          webhook_id: this.webhookId,
          webhook_event: event,
        }),
      });
    } catch {
      return false;
    }
    if (!response.ok) return false;
    const data = (await response.json()) as { verification_status?: string };
    return data.verification_status === "SUCCESS";
  }
}

/** Extracts the payout batch id from a webhook event resource. */
export function payoutBatchIdFromEvent(event: WebhookEventPayload): string | null {
  return event.resource?.payout_batch_id ?? null;
}
