/**
 * Unit tests for GET /api/verify-email route.
 *
 * Tests verify that:
 * - Valid token sets emailVerified and redirects to /dashboard?verified=true
 * - Expired/invalid token redirects to /dashboard?verify_error=true
 * - Missing token redirects to /dashboard?verify_error=true
 * - Already-verified user is updated again (idempotent)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db.update chain
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({
  where: mockUpdateWhere,
}));
const mockUpdate = vi.fn(() => ({
  set: mockUpdateSet,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: () => mockUpdate(),
  },
}));

// Mock verifySignedToken
const mockVerifySignedToken = vi.fn();
vi.mock("@/lib/tokens", () => ({
  verifySignedToken: (token: unknown) => mockVerifySignedToken(token),
}));

// Mock Arcjet
const mockProtect = vi.fn();
vi.mock("@/lib/arcjet", () => ({
  default: {
    withRule: () => ({ protect: (...args: unknown[]) => mockProtect(...args) }),
  },
}));

vi.mock("@arcjet/next", () => ({
  slidingWindow: vi.fn().mockReturnValue([]),
}));

// Import AFTER mocks
import { GET } from "@/app/api/verify-email/route";

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/api/verify-email?token=${encodeURIComponent(token)}`
    : "http://localhost:3000/api/verify-email";
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Arcjet allows request
    mockProtect.mockResolvedValue({ isDenied: () => false });
  });

  it("verifies email with valid token and redirects to dashboard", async () => {
    mockVerifySignedToken.mockReturnValue({
      userId: "user-123",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const res = await GET(makeRequest("valid-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verified=true");
    expect(mockVerifySignedToken).toHaveBeenCalledWith("valid-token");
    expect(mockUpdateSet).toHaveBeenCalledWith({
      emailVerified: expect.any(Date),
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("redirects to dashboard with error for expired token", async () => {
    mockVerifySignedToken.mockReturnValue(null);

    const res = await GET(makeRequest("expired-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verify_error=true");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("redirects to dashboard with error for invalid token", async () => {
    mockVerifySignedToken.mockReturnValue(null);

    const res = await GET(makeRequest("tampered.token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verify_error=true");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("redirects to dashboard with error when token is missing", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verify_error=true");
    expect(mockVerifySignedToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles already-verified user (idempotent update)", async () => {
    mockVerifySignedToken.mockReturnValue({
      userId: "user-already-verified",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const res = await GET(makeRequest("valid-token-2"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verified=true");
    expect(mockUpdateSet).toHaveBeenCalledWith({
      emailVerified: expect.any(Date),
    });
  });

  it("redirects to error when Arcjet rate limit is denied", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => true },
    });

    const res = await GET(makeRequest("valid-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verify_error=true");
    expect(mockVerifySignedToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("redirects to error when Arcjet denies for non-rate-limit reason", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => false },
    });

    const res = await GET(makeRequest("valid-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard?verify_error=true");
    expect(mockVerifySignedToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
