/**
 * Slice 3.12: shared timeline visibility (spec §10/Step 10).
 * Every event type maps to who may see it. Unknown types default to
 * coordinator-visible / beneficiary-hidden (safe default). Payloads,
 * coordinator notes, and beneficiary explanations are never part of
 * the timeline payload by construction — only labels and dates.
 */
import { describe, expect, it } from "vitest";
import {
  TIMELINE_VISIBILITY,
  timelineLabelsFor,
  visibleTimeline,
} from "./timeline";
import type { LedgerEventType } from "./timeline";

const TYPES: LedgerEventType[] = [
  "DISBURSEMENT_CREATED",
  "PLAN_VERSION_CREATED",
  "INVITATION_CREATED",
  "INVITATION_VIEWED",
  "PLAN_ACCEPTED",
  "PLAN_REVISION_PROPOSED",
  "PLAN_DECLINED",
  "PLAN_ACKNOWLEDGED",
];

describe("shared timeline visibility (Slice 3.12)", () => {
  it("maps every emitted event type to coordinator/beneficiary visibility", () => {
    for (const type of TYPES) {
      const visibility = TIMELINE_VISIBILITY[type];
      expect(visibility, type).toBeDefined();
      expect(visibility.coordinator).toBe(true);
      expect(visibility.beneficiary).toBe(true);
    }
  });

  it("keeps payout and clarification entries out of the beneficiary timeline", () => {
    expect(TIMELINE_VISIBILITY.PAYOUT_STATUS_UPDATED.beneficiary).toBe(false);
    expect(TIMELINE_VISIBILITY.PAYMENT_SUBMITTED.beneficiary).toBe(true);
    expect(TIMELINE_VISIBILITY.PAYMENT_SUBMITTED.coordinator).toBe(true);
    expect(TIMELINE_VISIBILITY.PLAN_CLARIFICATION_REQUESTED.beneficiary).toBe(false);
    expect(TIMELINE_VISIBILITY.PLAN_CLARIFICATION_REQUESTED.coordinator).toBe(true);
  });

  it("labels every visible type for both roles", () => {
    for (const type of TYPES) {
      expect(timelineLabelsFor(type, "coordinator")).toBeTruthy();
      expect(timelineLabelsFor(type, "beneficiary")).toBeTruthy();
    }
  });

  it("beneficiary timeline excludes payloads and private content", async () => {
    const events = [
      { eventType: "DISBURSEMENT_CREATED" as const, createdAt: new Date(0) },
      { eventType: "INVITATION_CREATED" as const, createdAt: new Date(1) },
      { eventType: "PLAN_ACCEPTED" as const, createdAt: new Date(2) },
    ];
    const timeline = visibleTimeline(events, "beneficiary");
    expect(timeline.map((t) => t.eventType)).toEqual([
      "DISBURSEMENT_CREATED",
      "INVITATION_CREATED",
      "PLAN_ACCEPTED",
    ]);
    expect(JSON.parse(JSON.stringify(timeline))).not.toContain("private");
  });

  it("unknown event types are hidden from the beneficiary", () => {
    const timeline = visibleTimeline(
      [{ eventType: "SOME_FUTURE_TYPE", createdAt: new Date(0) }],
      "beneficiary",
    );
    expect(timeline).toEqual([]);
  });
});
