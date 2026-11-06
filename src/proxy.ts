import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 proxy (replaces middleware.ts). Protects /dashboard and
 * operator routes: redirect unauthenticated requests to /login.
 */
export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("familyledger.session_token") ??
    request.cookies.get("better-auth.session_token");
  const isProtected = request.nextUrl.pathname.startsWith("/dashboard");
  if (isProtected && !sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/disbursements/:path*", "/analytics/:path*"],
};
