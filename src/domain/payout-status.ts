import type { PaymentStatus } from "@/domain/entities/disbursement";

/**
 * PayPal status mapping + friendly labels (spec §10, ADR-0006).
 * Known statuses map to our enum; unknown values are preserved as
 * STATUS_UNKNOWN at the payment layer while the raw value is stored
 * verbatim in paypalBatchStatus / paypalItemStatus (no coercion
 * into success). Pure domain code — shared by server and client.
 */
const MAPPING: Record<string, PaymentStatus> = {
  SUCCESS: "SUCCESS",
  DENIED: "DENIED",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  UNCLAIMED: "UNCLAIMED",
  ON_HOLD: "ON_HOLD",
  ONHOLD: "ON_HOLD",
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
 * Mapped enum value for a raw status, or null when the raw value is
 * not in our enum (so polling never regresses payment state on
 * unknown future statuses while the raw value is preserved).
 */
export function knownBatchStatus(raw: string | null): PaymentStatus | null {
  if (raw === null) return null;
  return MAPPING[raw] ?? null;
}

/**
 * Friendly label for the coordinator UI. Unknown raw values are
 * surfaced with the raw value inline ("Unknown (FOO)") — the raw
 * value is always preserved in data.
 */
export function friendlyBatchStatus(raw: string | null): string {
  if (!raw) return "Not submitted";
  const friendly = FRIENDLY[raw];
  return friendly ? friendly : `Unknown (${raw})`;
}

const FRIENDLY: Record<string, string> = {
  SUCCESS: "Succeeded",
  DENIED: "Denied",
  PENDING: "Pending",
  PROCESSING: "Processing",
  UNCLAIMED: "Unclaimed",
  ON_HOLD: "On hold",
  ONHOLD: "On hold",
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
