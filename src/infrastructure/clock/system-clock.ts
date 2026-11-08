import "server-only";
import type { Clock } from "@/application/ports/clock";

/** Wall-clock adapter for production. */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  date(): Date {
    return new Date();
  }
}
