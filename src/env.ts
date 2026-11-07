import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Boot-time environment schema (ADR-0015, spec §24).
 *
 * Validates every required variable with Zod at import time (imported by
 * `instrumentation.ts`). A missing/invalid value throws a readable error so
 * the process fails fast instead of running with undefined secrets.
 *
 * Required set is exactly spec §24; `PORT` is optional (Render injects it).
 * No SDK imports; this module lives in the frameworks layer (src/).
 */

function pathToString(
  path: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined,
): string {
  if (!path) return "";
  return path
    .map((segment) =>
      typeof segment === "object" && segment !== null && "key" in segment
        ? String(segment.key)
        : String(segment),
    )
    .join(".");
}

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_URL: z.string().url(),
    AUTH_SECRET: z.string().min(16),
    DATABASE_URL: z.string().url(),
    APP_ENCRYPTION_KEY: z.string().min(32),
    AI_PROVIDER: z.string().min(1),
    AI_API_KEY: z.string().min(1),
    AI_MODEL: z.string().min(1),
    AI_BASE_URL: z.string().url().optional(),
    PAYPAL_ENV: z.enum(["sandbox", "live"]),
    PAYPAL_CLIENT_ID: z.string().min(1),
    PAYPAL_CLIENT_SECRET: z.string().min(1),
    PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
    AG_STUDIO_LICENSE_KEY: z.string().min(1).optional(),
    DEMO_MODE: z.string().min(1),
    PORT: z.coerce.number().int().positive().optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    AI_BASE_URL: process.env.AI_BASE_URL,
    PAYPAL_ENV: process.env.PAYPAL_ENV,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    AG_STUDIO_LICENSE_KEY: process.env.AG_STUDIO_LICENSE_KEY,
    DEMO_MODE: process.env.DEMO_MODE,
    PORT: process.env.PORT,
  },
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    const fields = issues.map((issue) => pathToString(issue.path)).filter(Boolean);
    const message = `Invalid environment variables: ${fields.length > 0 ? fields.join(", ") : "validation failed"}`;
    console.error(`❌ ${message}`);
    for (const issue of issues) {
      console.error(`  - ${pathToString(issue.path) || "(root)"}: ${issue.message}`);
    }
    throw new Error(message);
  },
});