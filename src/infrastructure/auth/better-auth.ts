import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * Slice 1.5 — coordinator auth (Better Auth + Prisma adapter).
 * Email+password only; no registration/OAuth/password reset here.
 * Session cookie is HttpOnly + SameSite (lax) per spec §13.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.APP_URL,
  trustedOrigins: [process.env.APP_URL ?? "http://localhost:3000"],
  advanced: { cookiePrefix: "familyledger" },
});

export type AuthSession = typeof auth.$Infer.Session;
