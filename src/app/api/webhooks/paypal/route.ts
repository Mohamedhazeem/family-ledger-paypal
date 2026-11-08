import "server-only";
import { NextResponse } from "next/server";
import { PayPalWebhookVerifier, payoutBatchIdFromEvent } from "@/infrastructure/paypal/webhook";
import { PayPalSandboxAuth } from "@/infrastructure/paypal/oauth";
import {
  HandlePayPalWebhook,
  WebhookDisbursementNotFoundError,
} from "@/application/use-cases/handle-paypal-webhook";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
} from "@/infrastructure/db/repositories";
import { createPayoutsAdapter } from "@/infrastructure/paypal/factory";
import { withSecurityHeaders } from "@/lib/security/headers";
import { logger } from "@/lib/log";

/**
 * POST /api/webhooks/paypal (spec §11 stretch, the only unauthenticated
 * route — verified by PayPal signature, not session).
 * Verifies the signature via PayPal, resolves the payout batch id,
 * then refetches the batch resource before persisting statuses.
 * Unsigned requests get no information beyond a generic rejection.
 */
export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    logger.warn({ event: "webhook_not_configured" }, "PayPal webhook received but PAYPAL_WEBHOOK_ID is unset");
    return withSecurityHeaders(NextResponse.json({ error: "Webhook not configured" }, { status: 503 }));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSecurityHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }
  const event = body as { event_type?: string; resource?: { payout_batch_id?: string } };
  const batchId = payoutBatchIdFromEvent(event);
  if (!batchId) {
    return withSecurityHeaders(NextResponse.json({ error: "Event missing payout batch" }, { status: 400 }));
  }
  const baseUrl = process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const verifier = new PayPalWebhookVerifier({
    auth: new PayPalSandboxAuth({
      clientId: process.env.PAYPAL_CLIENT_ID ?? "",
      clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
      baseUrl,
    }),
    baseUrl,
    webhookId,
  });
  const verified = await verifier.verify(event, PayPalWebhookVerifier.fromHeaders(request.headers));
  if (!verified) {
    logger.warn({ event: "webhook_signature_rejected" }, "PayPal webhook signature verification failed");
    return withSecurityHeaders(NextResponse.json({ error: "Invalid signature" }, { status: 401 }));
  }
  try {
    const result = await new HandlePayPalWebhook(
      new PrismaDisbursementRepository(),
      new PrismaLedgerEventRepository(),
      createPayoutsAdapter(),
    ).execute(batchId);
    logger.info(
      { disbursementId: result.disbursementId, changed: result.changed },
      "PayPal webhook applied",
    );
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    if (error instanceof WebhookDisbursementNotFoundError) {
      // No leaked detail: unknown batches are indistinguishable.
      return withSecurityHeaders(NextResponse.json({ error: "Unknown payout batch" }, { status: 404 }));
    }
    return withSecurityHeaders(
      NextResponse.json({ error: error instanceof Error ? error.message : "Webhook failed" }, { status: 502 }),
    );
  }
}
