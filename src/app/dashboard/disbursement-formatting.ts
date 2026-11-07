// Pure formatting helpers for the disbursement register.
// No framework, AG Grid, or vendor imports — unit-testable in any environment.

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const LABELS: Record<string, string> = {
  BENEFICIARY_ACCEPTED: "Accepted",
  REVISION_PROPOSED: "Revision proposed",
  COORDINATOR_ACKNOWLEDGED: "Acknowledged",
  BENEFICIARY_DECLINED_TO_SHARE: "Declined to share",
  NO_RESPONSE: "No response",
  STATUS_UNKNOWN: "Unknown",
  NOT_SENT: "Not sent",
  SUCCESS: "Succeeded",
  UNCLAIMED: "Unclaimed",
  ON_HOLD: "On hold",
};

export function formatStatusLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TONE_BY_STATUS: Record<string, StatusTone> = {
  SUCCESS: "success",
  BENEFICIARY_ACCEPTED: "success",
  COORDINATOR_ACKNOWLEDGED: "success",
  FAILED: "danger",
  DENIED: "danger",
  BLOCKED: "danger",
  PENDING: "info",
  PROCESSING: "info",
  READY: "info",
  INVITED: "info",
  SUBMITTING: "warning",
  STATUS_UNKNOWN: "warning",
  REVISION_PROPOSED: "warning",
  NO_RESPONSE: "warning",
  UNCLAIMED: "warning",
  ON_HOLD: "warning",
  RETURNED: "warning",
  REFUNDED: "warning",
  REVERSED: "warning",
};

export function toneForStatus(status: string): StatusTone {
  return TONE_BY_STATUS[status] ?? "neutral";
}

export function formatCreatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
    .toUpperCase();
}

export function sumMinor(values: string[]): bigint {
  return values.reduce((acc, v) => acc + BigInt(v), 0n);
}
