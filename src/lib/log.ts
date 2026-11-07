import "server-only";
import pino from "pino";
import type { DestinationStream } from "pino";

/**
 * Application logger (Slice 5.0c, spec §13).
 * Recipient emails, invitation tokens, API keys, support notes,
 * cookies, and authorization headers are redacted at the logger
 * level and can never reach a log line. Server-only.
 */
const SENSITIVE_KEYS = [
  "authHeader",
  "invitationToken",
  "token",
  "tokenHash",
  "supportNote",
  "notes",
  "apiKey",
  "clientSecret",
  "authSecret",
  "password",
  "recipientEmail",
  "payPalRecipientEmail",
  "invitationEmail",
  "encryptedPayPalRecipient",
  "vaultToken",
  "headers",
];

// Pino matches exact top-level paths and "*.<key>" at any single depth.
const REDACT_PATHS = [
  "authorization",
  "cookie",
  "req.headers.cookie",
  "res.headers",
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
  ...SENSITIVE_KEYS.map((key) => `*.*.${key}`),
];

export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    destination,
  );
}

export const logger = createLogger();
