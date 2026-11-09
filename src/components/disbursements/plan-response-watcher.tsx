"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * PlanResponseWatcher (Slice 5.x): the beneficiary has no account and no
 * push channel, so the coordinator's detail page polls for a new plan
 * status / timeline entries instead of requiring a manual refresh.
 * Polling pauses while the tab is hidden and never blocks interaction.
 */
export function PlanResponseWatcher({
  disbursementId,
  intervalMs = 20_000,
}: {
  disbursementId: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void disbursementId;
    function tick() {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastChecked(new Date());
    }
    timer.current = setInterval(tick, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [disbursementId, intervalMs, router]);

  return (
    <p className="text-xs text-slate-400">
      Checking for beneficiary responses automatically
      {lastChecked ? ` · last check ${lastChecked.toLocaleTimeString()}` : ""}.
    </p>
  );
}
