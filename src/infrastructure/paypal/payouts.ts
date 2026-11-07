import "server-only";
import type {
  CreateBatchInput,
  CreateBatchResult,
  PayPalAuthPort,
  PayoutsPort,
} from "@/application/ports/paypal";
import { PayPalHttpError, PayPalNetworkError } from "@/application/ports/paypal";
import { formatMinor } from "@/domain/value-objects/money";
import { mapBatchStatus } from "./status-mapping";

/**
 * PayPal sandbox payouts adapter (Slice 4.3, spec §11 / §6 Step 8).
 * Sends exactly one batch with one item for the full amount; the
 * note carries only the FamilyLedger reference (never categories).
 */
export interface PayPalAdapterConfig {
  auth: PayPalAuthPort;
  baseUrl: string;
}

export class PayPalSandboxAdapter implements PayoutsPort {
  private readonly auth: PayPalAuthPort;
  private readonly baseUrl: string;

  constructor(config: PayPalAdapterConfig) {
    this.auth = config.auth;
    this.baseUrl = config.baseUrl;
  }

  async getAccessToken(): Promise<string> {
    return this.auth.getAccessToken();
  }

  async createBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
    let token = await this.auth.getAccessToken();
    let response = await this.postPayouts(input, token);
    if (response.status === 401) {
      // Stale token raced the cache: drop it and retry exactly once.
      if ("invalidate" in this.auth && typeof this.auth.invalidate === "function") {
        this.auth.invalidate();
        token = await this.auth.getAccessToken();
        response = await this.postPayouts(input, token);
      } else {
        throw new PayPalHttpError(401, "PayPal rejected the access token.");
      }
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new PayPalHttpError(response.status, `PayPal payouts failed with HTTP ${response.status}: ${text}`);
    }
    const data = (await response.json()) as {
      payout_batch_id?: string;
      batch_status?: string;
      batch_header?: { payout_batch_id?: string; batch_status?: string };
    };
    const batchId = data.payout_batch_id ?? data.batch_header?.payout_batch_id ?? null;
    const status = data.batch_status ?? data.batch_header?.batch_status ?? "PENDING";
    return {
      payoutBatchId: batchId,
      batchStatus: status,
      paymentStatus: mapBatchStatus(status),
      raw: data,
    };
  }

  private async postPayouts(input: CreateBatchInput, token: string): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/v1/payments/payouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sender_batch_header: {
            sender_batch_id: input.senderBatchId,
            email_subject: "You received a family support payment",
          },
          items: [
            {
              recipient_type: "EMAIL",
              receiver: input.receiverEmail,
              amount: { value: formatMinor(input.amountMinor), currency: input.currency },
              note: `Family support ${input.publicReference}`,
              sender_item_id: input.senderItemId,
            },
          ],
        }),
      });
    } catch (cause) {
      throw new PayPalNetworkError(
        `PayPal request failed: ${cause instanceof Error ? cause.message : "network error"}`,
      );
    }
  }
}
