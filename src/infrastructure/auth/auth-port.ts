import "server-only";
import { headers } from "next/headers";
import type { AuthPort, AuthSession } from "@/application/ports/auth";
import { auth } from "./better-auth";

/**
 * Better Auth adapter implementing AuthPort (spec §13, ADR-0016).
 * Session resolution is delegated to Better Auth; this class is the
 * single seam so route guards never import the vendor SDK directly.
 */
export class BetterAuthAdapter implements AuthPort {
  async getSession(): Promise<AuthSession | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      expiresAt: session.session.expiresAt,
    };
  }
}

/** Shared adapter instance for route handlers and server components. */
export const authPort = new BetterAuthAdapter();
