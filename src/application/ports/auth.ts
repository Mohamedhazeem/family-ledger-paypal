/**
 * Auth port (ADR-0016, ADR-0017, spec Part C §13).
 * Defined in the application layer; adapters implement it from the
 * environment. No vendor SDK imports here.
 */

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  expiresAt: Date;
}

export interface AuthPort {
  /**
   * Resolves the current session from request headers, or null when
   * the request is unauthenticated. Never throws for a missing session.
   */
  getSession(): Promise<AuthSession | null>;
}
