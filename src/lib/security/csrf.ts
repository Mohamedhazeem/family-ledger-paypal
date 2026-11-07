import "server-only";

/**
 * CSRF origin check (Slice 5.0d, spec §13). Browser cross-site POSTs
 * carry an Origin header that must match this app's origin; requests
 * without one are treated as non-browser clients and proceed (the
 * session cookie + SameSite remain the primary CSRF defense).
 *
 * The expected origin is derived from the request Host, with the
 * configured APP_URL origin also accepted for proxied deployments.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  const allowed = new Set<string>();
  if (host) allowed.add(host);
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).host);
    } catch {
      /* ignore */
    }
  }
  try {
    return allowed.has(new URL(origin).host);
  } catch {
    return false;
  }
}
