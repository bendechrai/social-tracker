/**
 * Authentication proxy for route protection.
 *
 * Protects all routes except:
 * - /login - Login page (public)
 * - /signup - Signup page (public)
 * - /api/auth/* - Auth.js API routes (public)
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

  // Check if this is an API route (excluding /api/auth/*)
  const isApiRoute = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/");

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
     * - /api/auth (NextAuth.js routes)
     * - /_next (Next.js internals)
     * - /static (static files)
     * - Files with extensions (e.g., favicon.ico, robots.txt)
     *
     * Note: This uses Next.js path-to-regexp syntax, not standard JavaScript regex.
     * The pattern matches paths that DON'T start with the excluded prefixes.
     */
    "/((?!login|signup|api/auth|_next|static|.*\\..*$).*)",
  ],
};
