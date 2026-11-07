/**
 * PayPal port (ADR-0006, ADR-0017, spec Part C §11).
 * Defined in the application layer; adapters implement it from the
 * environment. No vendor SDK imports here.
 */
import type { PaymentStatus } from "@/domain/entities/disbursement";

export interface PayPalAuthPort {
  /** Returns a cached OAuth access token, refreshing near expiry. */
  getAccessToken(): Promise<string>;
}

export interface CreateBatchInput {
  senderBatchId: string;
  senderItemId: string;
  publicReference: string;
  receiverEmail: string;
  /** Integer minor units as BigInt. */
  amountMinor: bigint;
  currency: string;
}

export interface CreateBatchResult {
  payoutBatchId: string | null;
  /** Raw PayPal result, preserved verbatim. */
  batchStatus: string;
  /** Mapped to our payment enum by the adapter (unknown → STATUS_UNKNOWN). */
  paymentStatus: PaymentStatus;
  raw: unknown;
}

export interface BatchStatusResult {
  /** Raw batch status, preserved verbatim. */
  batchStatus: string | null;
  /** Raw item transaction status of the first item, preserved verbatim. */
  itemStatus: string | null;
  /**
   * paymentStatus mapped from the batch status, or null when the raw
   * value is unknown (so polling never regresses payment state on
   * an unrecognized future status).
   */
  paymentStatus: PaymentStatus | null;
  raw: unknown;
}

/** HTTP-level failure from PayPal (carries the status for routing). */
export class PayPalHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Transport-level failure (network error, timeout): outcome unknown. */
export class PayPalNetworkError extends Error {}

export interface PayoutsPort extends PayPalAuthPort {
  /**
   * Creates one PayPal payout batch with a single item for the FULL
   * amount (never split by category). Throws PayPalHttpError for
   * HTTP failures (status < 500 = definitive; >= 500 = uncertain)
   * and PayPalNetworkError for transport failures.
   */
  createBatch(_input: CreateBatchInput): Promise<CreateBatchResult>;
  /**
   * Fetches the current batch + item statuses (spec Step 9). Batch
   * and item statuses are returned separately; unknowns preserved.
   */
  getBatchStatus(_payoutBatchId: string): Promise<BatchStatusResult>;
}
