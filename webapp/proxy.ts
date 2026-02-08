/**
 * Authentication proxy for route protection.
 *
 * Protects all routes except:
 * - / - Marketing landing page (public, handles own auth redirect)
 * - /login - Login page (public)
 * - /signup - Signup page (public)
 * - /forgot-password - Forgot password page (public)
 * - /reset-password - Reset password page (public)
 * - /api/auth/* - Auth.js API routes (public)
 * - /api/cron/* - Cron job routes (public, idempotent)
 * - /api/unsubscribe - Email unsubscribe (public, uses signed token)
 * - /api/verify-email - Email verification (public, uses signed token)
 *
 * Behavior:
 * - Page requests: Redirect unauthenticated users to /login
 * - API requests: Return 401 JSON response for unauthenticated users
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Check if this is an API route (excluding /api/auth/*, /api/cron/*, /api/unsubscribe, and /api/verify-email)
  const isApiRoute = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/cron/") && !pathname.startsWith("/api/unsubscribe") && !pathname.startsWith("/api/verify-email");

  // Landing page handles its own auth redirect
  if (pathname === "/") {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    // For API routes, return 401 JSON response
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", req.url);
    // Preserve the original URL for redirect after login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated, continue
  return NextResponse.next();
});

// Matcher configuration for Next.js
// Protects all routes except public paths.
// The proxy logic handles the actual auth checking.
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login and /signup (auth pages)
     * - /forgot-password and /reset-password (password reset pages)
     * - /api/auth (NextAuth.js routes)
     * - /api/cron (cron job routes)
     * - /api/unsubscribe (email unsubscribe, uses signed token)
     * - /api/verify-email (email verification, uses signed token)
     * - /_next (Next.js internals)
     * - /static (static files)
     * - Files with extensions (e.g., favicon.ico, robots.txt)
     *
     * Note: This uses Next.js path-to-regexp syntax, not standard JavaScript regex.
     * The pattern matches paths that DON'T start with the excluded prefixes.
     */
    "/((?!login|signup|forgot-password|reset-password|api/auth|api/cron|api/unsubscribe|api/verify-email|_next|static|.*\\..*$).*)",
  ],
};
