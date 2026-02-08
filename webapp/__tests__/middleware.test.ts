/**
 * Unit tests for authentication middleware.
 *
 * Tests verify that:
 * - Landing page (/) passes through for all users (handles own auth)
 * - Unauthenticated page requests redirect to /login
 * - Unauthenticated API requests return 401 JSON
 * - Authenticated requests pass through
 * - Matcher configuration excludes public routes
 * - Callback URL is preserved for post-login redirect
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

// Create a mock session type
type MockSession = Session | null;

// Store the auth callback - use a global object to avoid hoisting issues
const mockStore: {
  authCallback:
    | ((req: NextRequest & { auth: MockSession }) => Response | void)
    | null;
} = {
  authCallback: null,
};

// Mock auth function - captures the callback and returns it wrapped
vi.mock("@/lib/auth", () => ({
  auth: (
    callback: (req: NextRequest & { auth: MockSession }) => Response | void
  ) => {
    // Store the callback so we can call it in tests
    mockStore.authCallback = callback;
    // Return the callback
    return callback;
  },
}));

// Helper to create mock NextRequest
function createMockRequest(pathname: string): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  return new NextRequest(url);
}

// Helper to call the middleware with mocked auth
function callMiddleware(
  pathname: string,
  session: MockSession
): Response | void {
  const request = createMockRequest(pathname);
  const augmentedRequest = request as NextRequest & { auth: MockSession };
  augmentedRequest.auth = session;

  if (!mockStore.authCallback) {
    throw new Error("Auth callback not initialized");
  }
  return mockStore.authCallback(augmentedRequest);
}

describe("authentication middleware", () => {
  // Import middleware to trigger mock setup
  beforeAll(async () => {
    await import("../proxy");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated requests", () => {
    const nullSession: MockSession = null;

    describe("page routes", () => {
      it("allows / through (landing page handles its own auth)", () => {
        const response = callMiddleware("/", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(200);
      });

      it("redirects /settings to /login", () => {
        const response = callMiddleware("/settings", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(307);
        expect(nextResponse.headers.get("location")).toContain("/login");
      });

      it("redirects /settings/account to /login", () => {
        const response = callMiddleware("/settings/account", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(307);
        expect(nextResponse.headers.get("location")).toContain("/login");
      });

      it("redirects /dashboard to /login", () => {
        const response = callMiddleware("/dashboard", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(307);
        expect(nextResponse.headers.get("location")).toContain("/login");
      });

      it("preserves callbackUrl in redirect", () => {
        const response = callMiddleware("/dashboard/posts", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        const location = nextResponse.headers.get("location");
        expect(location).toContain("callbackUrl=%2Fdashboard%2Fposts");
      });

      it("preserves callbackUrl for nested settings route", () => {
        const response = callMiddleware("/settings/api-keys", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        const location = nextResponse.headers.get("location");
        expect(location).toContain("callbackUrl=%2Fsettings%2Fapi-keys");
      });
    });

    describe("API routes", () => {
      it("returns 401 for /api/posts", async () => {
        const response = callMiddleware("/api/posts", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(401);
        const body = await nextResponse.json();
        expect(body.error).toBe("Unauthorized");
        expect(body.message).toBe("Authentication required");
      });

      it("returns 401 for /api/tags", () => {
        const response = callMiddleware("/api/tags", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(401);
      });

      it("returns 401 for /api/subreddits", () => {
        const response = callMiddleware("/api/subreddits", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(401);
      });

      it("returns 401 for /api/suggest-terms", () => {
        const response = callMiddleware("/api/suggest-terms", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(401);
      });

      it("does not return 401 for /api/unsubscribe (excluded from API auth)", () => {
        const response = callMiddleware("/api/unsubscribe", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        // /api/unsubscribe is excluded from isApiRoute, so it should not get 401
        expect(nextResponse.status).not.toBe(401);
      });

      it("does not return 401 for /api/verify-email (excluded from API auth)", () => {
        const response = callMiddleware("/api/verify-email", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        // /api/verify-email is excluded from isApiRoute, so it should not get 401
        expect(nextResponse.status).not.toBe(401);
      });

      it("returns JSON content type for 401 response", () => {
        const response = callMiddleware("/api/posts", nullSession);

        expect(response).toBeInstanceOf(NextResponse);
        const nextResponse = response as NextResponse;
        expect(nextResponse.headers.get("content-type")).toContain(
          "application/json"
        );
      });
    });
  });

  describe("authenticated requests", () => {
    const validSession: MockSession = {
      user: { id: "user-123", email: "test@example.com" },
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it("allows access to /", () => {
      const response = callMiddleware("/", validSession);

      expect(response).toBeInstanceOf(NextResponse);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(200);
    });

    it("allows access to /dashboard", () => {
      const response = callMiddleware("/dashboard", validSession);

      expect(response).toBeInstanceOf(NextResponse);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(200);
    });

    it("allows access to /settings", () => {
      const response = callMiddleware("/settings", validSession);

      expect(response).toBeInstanceOf(NextResponse);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(200);
    });

    it("allows access to /settings/account", () => {
      const response = callMiddleware("/settings/account", validSession);

      expect(response).toBeInstanceOf(NextResponse);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(200);
    });

    it("allows access to /api/posts", () => {
      const response = callMiddleware("/api/posts", validSession);

      expect(response).toBeInstanceOf(NextResponse);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(200);
    });

    it("allows access to /api/tags", () => {
      const response = callMiddleware("/api/tags", validSession);

      expect(response).toBeInstanceOf(NextResponse);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(200);
    });
  });

  describe("matcher configuration", () => {
    // Note: Next.js path matchers use a different matching algorithm than JavaScript RegExp.
    // These tests verify the config structure, not exact regex behavior.
    // The actual route protection is tested via the middleware behavior tests above.
    // Integration/E2E tests provide full verification of route protection.

    it("has a matcher array defined", async () => {
      const { config } = await import("../proxy");
      expect(config.matcher).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.length).toBeGreaterThan(0);
    });

    it("matcher pattern contains exclusions for public routes", async () => {
      const { config } = await import("../proxy");
      const matcher = config.matcher[0];
      if (!matcher) throw new Error("Matcher not defined");

      // Verify the pattern includes negative lookahead for public routes
      expect(matcher).toContain("login");
      expect(matcher).toContain("signup");
      expect(matcher).toContain("api/auth");
      expect(matcher).toContain("_next");
    });

    it("matcher pattern excludes forgot-password", async () => {
      const { config } = await import("../proxy");
      const matcher = config.matcher[0];
      if (!matcher) throw new Error("Matcher not defined");

      expect(matcher).toContain("forgot-password");
    });

    it("matcher pattern excludes reset-password", async () => {
      const { config } = await import("../proxy");
      const matcher = config.matcher[0];
      if (!matcher) throw new Error("Matcher not defined");

      expect(matcher).toContain("reset-password");
    });

    it("matcher pattern excludes api/unsubscribe", async () => {
      const { config } = await import("../proxy");
      const matcher = config.matcher[0];
      if (!matcher) throw new Error("Matcher not defined");

      expect(matcher).toContain("api/unsubscribe");
    });

    it("matcher pattern excludes api/verify-email", async () => {
      const { config } = await import("../proxy");
      const matcher = config.matcher[0];
      if (!matcher) throw new Error("Matcher not defined");

      expect(matcher).toContain("api/verify-email");
    });

    it("matcher pattern excludes files with extensions", async () => {
      const { config } = await import("../proxy");
      const matcher = config.matcher[0];
      if (!matcher) throw new Error("Matcher not defined");

      // Pattern should handle files with extensions (like favicon.ico)
      expect(matcher).toContain("\\.");
    });
  });
});
