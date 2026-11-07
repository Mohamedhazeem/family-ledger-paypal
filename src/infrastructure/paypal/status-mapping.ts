import type { PaymentStatus } from "@/domain/entities/disbursement";

/**
 * PayPal batch-status mapping (spec §10, ADR-0006, AGENTS §10).
 * Known statuses map to our enum; unknown values are preserved as
 * STATUS_UNKNOWN at the payment layer while the raw value is stored
 * verbatim in paypalBatchStatus (no coercion into success).
 */
const MAPPING: Record<string, PaymentStatus> = {
  SUCCESS: "SUCCESS",
  DENIED: "DENIED",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  UNCLAIMED: "UNCLAIMED",
  ON_HOLD: "ON_HOLD",
  BLOCKED: "BLOCKED",
  REFUNDED: "REFUNDED",
  REVERSED: "REVERSED",
  RETURNED: "RETURNED",
  READY: "READY",
  SUBMITTING: "SUBMITTING",
  CANCELED: "FAILED",
  CANCELLED: "FAILED",
  FAILED: "FAILED",
};

export function mapBatchStatus(raw: string | null): PaymentStatus {
  if (raw === null) return "STATUS_UNKNOWN";
  return MAPPING[raw] ?? "STATUS_UNKNOWN";
}

/**
 * Friendly label for the coordinator UI. Unknown raw values are
 * surfaced as "Unknown (raw value)" — raw is always preserved in data.
 */
export function friendlyBatchStatus(raw: string | null): string {
  if (!raw) return "Not submitted";
  return MAPPING[raw] ? toFriendly(raw) : `Unknown (${raw})`;
}

function toFriendly(raw: string): string {
  const map: Record<string, string> = {
    SUCCESS: "Succeeded",
    DENIED: "Denied",
    PENDING: "Pending",
    PROCESSING: "Processing",
    UNCLAIMED: "Unclaimed",
    ON_HOLD: "On hold",
    BLOCKED: "Blocked",
    REFUNDED: "Refunded",
    REVERSED: "Reversed",
    RETURNED: "Returned",
    READY: "Ready",
    SUBMITTING: "Submitting",
    CANCELED: "Canceled",
    CANCELLED: "Canceled",
    FAILED: "Failed",
  };
  return map[raw] ?? raw;
}
