/**
 * Shared timeline (Slice 3.12, spec §10/Step 10).
 *
 * Both authorized parties see the allowed parts of the timeline;
 * visibility is declared per event type. Private coordinator notes
 * and private beneficiary explanations are never in timeline data —
 * entries carry only their type, label, and timestamp.
 */

export type TimelineRole = "coordinator" | "beneficiary";

export type LedgerEventType =
  | "DISBURSEMENT_CREATED"
  | "PLAN_VERSION_CREATED"
  | "INVITATION_CREATED"
  | "INVITATION_VIEWED"
  | "PLAN_ACCEPTED"
  | "PLAN_REVISION_PROPOSED"
  | "PLAN_DECLINED"
  | "PLAN_ACKNOWLEDGED"
  | "PAYMENT_SUBMITTED"
  | "PAYOUT_STATUS_UPDATED"
  | "PLAN_CLARIFICATION_REQUESTED";

export interface TimelineVisibility {
  coordinator: boolean;
  beneficiary: boolean;
}

export const TIMELINE_VISIBILITY: Record<LedgerEventType, TimelineVisibility> = {
  DISBURSEMENT_CREATED: { coordinator: true, beneficiary: true },
  PLAN_VERSION_CREATED: { coordinator: true, beneficiary: true },
  INVITATION_CREATED: { coordinator: true, beneficiary: true },
  INVITATION_VIEWED: { coordinator: true, beneficiary: true },
  PLAN_ACCEPTED: { coordinator: true, beneficiary: true },
  PLAN_REVISION_PROPOSED: { coordinator: true, beneficiary: true },
  PLAN_DECLINED: { coordinator: true, beneficiary: true },
  PLAN_ACKNOWLEDGED: { coordinator: true, beneficiary: true },
  // Payout progress is shared state, not private notes (spec Step 8/9).
  PAYMENT_SUBMITTED: { coordinator: true, beneficiary: true },
  PAYOUT_STATUS_UPDATED: { coordinator: true, beneficiary: false },
  // Coordinator clarification asks are operator-only.
  PLAN_CLARIFICATION_REQUESTED: { coordinator: true, beneficiary: false },
};

const LABELS: Record<LedgerEventType, { coordinator: string; beneficiary: string }> = {
  DISBURSEMENT_CREATED: { coordinator: "Disbursement created", beneficiary: "Disbursement created" },
  PLAN_VERSION_CREATED: { coordinator: "Plan draft generated", beneficiary: "Plan draft generated" },
  INVITATION_CREATED: { coordinator: "Invitation created", beneficiary: "Invitation created" },
  INVITATION_VIEWED: { coordinator: "Invitation viewed", beneficiary: "Invitation viewed" },
  PLAN_ACCEPTED: { coordinator: "Beneficiary accepted the plan", beneficiary: "You accepted the plan" },
  PLAN_REVISION_PROPOSED: { coordinator: "Beneficiary suggested changes", beneficiary: "You suggested changes" },
  PLAN_DECLINED: { coordinator: "Beneficiary declined to share a plan", beneficiary: "You chose not to share a plan" },
  PLAN_ACKNOWLEDGED: { coordinator: "Coordinator acknowledged the plan", beneficiary: "Coordinator acknowledged the plan" },
  PAYMENT_SUBMITTED: { coordinator: "Payout submitted", beneficiary: "Payout submitted" },
  PAYOUT_STATUS_UPDATED: { coordinator: "PayPal status updated", beneficiary: "PayPal status updated" },
  PLAN_CLARIFICATION_REQUESTED: { coordinator: "Clarification requested", beneficiary: "Clarification requested" },
};

export function timelineLabel(eventType: LedgerEventType, role: TimelineRole): string {
  return LABELS[eventType][role];
}

export function timelineLabelsFor(eventType: string, role: TimelineRole): string | null {
  const label = (LABELS as Partial<Record<string, { coordinator: string; beneficiary: string }>>)[eventType];
  return label ? label[role] : null;
}

export interface TimelineEntry {
  eventType: string;
  label: string;
  createdAt: Date;
}

/**
 * Filters events to what the role may see, in chronological order,
 * with friendly labels. Unknown types are coordinator-visible and
 * beneficiary-hidden (safe default).
 */
export function visibleTimeline(
  events: { eventType: string; createdAt: Date }[],
  role: TimelineRole,
): TimelineEntry[] {
  return events
    .filter((event) => {
      const visibility = (TIMELINE_VISIBILITY as Partial<Record<string, TimelineVisibility>>)[event.eventType];
      return visibility ? visibility[role] : role === "coordinator";
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.eventType < b.eventType ? -1 : 1))
    .map((event) => ({
      eventType: event.eventType,
      label: timelineLabelsFor(event.eventType, role) ?? event.eventType,
      createdAt: event.createdAt,
    }));
}
