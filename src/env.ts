import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_URL: z.string().url(),
    AUTH_SECRET: z.string().min(16),
    DATABASE_URL: z.string().url(),
    APP_ENCRYPTION_KEY: z.string().min(32),
    AI_PROVIDER: z.string().default("openai"),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
    PAYPAL_CLIENT_ID: z.string().optional(),
    PAYPAL_CLIENT_SECRET: z.string().optional(),
    PAYPAL_WEBHOOK_ID: z.string().optional(),
    AG_STUDIO_LICENSE_KEY: z.string().optional(),
    DEMO_MODE: z.string().default("true"),
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
    PAYPAL_ENV: process.env.PAYPAL_ENV,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    AG_STUDIO_LICENSE_KEY: process.env.AG_STUDIO_LICENSE_KEY,
    DEMO_MODE: process.env.DEMO_MODE,
  },
});
