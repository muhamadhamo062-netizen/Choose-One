import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth-cookie-constants";
import { jsonUnauthorized } from "./lib/api-response";

/**
 * JWT validation lives only in Route Handlers (`getSession` / `/api/user/session`).
 * Here: optional `pe_session` presence for protected API + dashboard page — no jwtVerify (avoids Edge/Node drift and false 401s).
 */
function isPublicApiPath(pathname: string): boolean {
  if (pathname === "/api/user/session") {
    return true;
  }
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }
  if (pathname === "/api/user/create") {
    return true;
  }
  if (pathname === "/api/user/session-from-transaction" || pathname === "/api/user/complete-purchase") {
    return true;
  }
  if (pathname === "/api/events") {
    return true;
  }
  if (pathname.startsWith("/api/health")) {
    return true;
  }
  if (pathname === "/api/contact") {
    return true;
  }
  if (pathname.startsWith("/api/affiliate/")) {
    return true;
  }
  if (pathname.startsWith("/api/admin/affiliates/")) {
    return true;
  }
  if (pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/cron/") || pathname.startsWith("/api/internal/")) {
    return true;
  }
  if (pathname.startsWith("/api/scan/") || pathname.startsWith("/api/realtime/") || pathname.startsWith("/api/state/")) {
    return true;
  }
  /** Free-scan leak + identity enrichment — must work without `pe_session` (homepage scanner). */
  if (pathname === "/api/v1/deep-scan") {
    return true;
  }
  if (pathname.startsWith("/api/debug/")) {
    return true;
  }
  return false;
}

function isDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isAffiliateOrAdminPath(pathname: string): boolean {
  return (
    pathname === "/affiliate/dashboard" ||
    pathname.startsWith("/affiliate/dashboard/") ||
    pathname === "/admin/affiliates" ||
    pathname.startsWith("/admin/affiliates/")
  );
}

export function middleware(request: NextRequest) {
  /** Set PE_MIDDLEWARE_PASSTHROUGH=1 to verify auth without this layer (Step 5 isolation). */
  if (process.env.PE_MIDDLEWARE_PASSTHROUGH === "1") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (process.env.AUTH_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log("SESSION COOKIE:", Boolean(cookie));
  }

  if (isAffiliateOrAdminPath(pathname) && !cookie) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  if (isDashboardPath(pathname)) {
    if (!cookie) {
      return NextResponse.redirect(new URL("/signup", request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/") || isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  if (!cookie) {
    return jsonUnauthorized();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard", "/dashboard/:path*", "/affiliate/:path*", "/admin/:path*"]
};
