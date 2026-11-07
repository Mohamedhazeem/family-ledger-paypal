"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * SendPaymentButton (Slice 3.7 placeholder): the coordinator's
 * explicit payout action. It stays enabled regardless of
 * acknowledgement (spec §4.4); the PayPal payout wiring lands in
 * the 4.x payout slice.
 */
export function SendPaymentButton() {
  const [attempted, setAttempted] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setAttempted(true)}
        className="w-full"
      >
        Send full payment via PayPal Sandbox
      </Button>
      {attempted ? (
        <p className="text-xs text-slate-500">
          PayPal payouts are wired in the payout milestone — nothing is charged yet.
        </p>
      ) : null}
    </div>
  );
}
