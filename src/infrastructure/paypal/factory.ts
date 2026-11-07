import "server-only";
import type { PayoutsPort } from "@/application/ports/paypal";
import { PayPalSandboxAuth } from "./oauth";
import { PayPalSandboxAdapter } from "./payouts";

/**
 * Builds the PayPal payouts adapter from the environment
 * (AGENTS §4). Sandbox-only in the MVP — live sending throws.
 */
export function createPayoutsAdapter(): PayoutsPort {
  const env = process.env.PAYPAL_ENV;
  if (env !== "sandbox") {
    throw new Error("Live PayPal payouts are out of scope for this MVP (sandbox only).");
  }
  const baseUrl = "https://api-m.sandbox.paypal.com";
  return new PayPalSandboxAdapter({
    auth: new PayPalSandboxAuth({
      clientId: process.env.PAYPAL_CLIENT_ID ?? "",
      clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
      baseUrl,
    }),
    baseUrl,
  });
}
