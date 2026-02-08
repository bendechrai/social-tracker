/**
 * Unit tests for POST /api/resend-verification route.
 *
 * Tests verify that:
 * - Authenticated user gets verification email sent
 * - Already-verified user gets success with alreadyVerified flag
 * - Unauthenticated request returns 401
 * - User not found returns 404
 * - Arcjet rate limit returns 429
 * - Arcjet non-rate-limit denial returns 403
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock db.query.users.findFirst
const mockFindFirst = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock sendEmail
const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock buildVerificationEmail
const mockBuildVerificationEmail = vi.fn();
vi.mock("@/lib/email-templates", () => ({
  buildVerificationEmail: (...args: unknown[]) =>
    mockBuildVerificationEmail(...args),
}));

// Mock Arcjet
const mockProtect = vi.fn();
vi.mock("@/lib/arcjet", () => ({
  default: {
    withRule: () => ({ protect: (...args: unknown[]) => mockProtect(...args) }),
  },
  ajMode: "DRY_RUN",
}));

vi.mock("@arcjet/next", () => ({
  slidingWindow: vi.fn().mockReturnValue([]),
}));

// Import AFTER mocks
import { POST } from "@/app/api/resend-verification/route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/resend-verification", {
    method: "POST",
  });
}

describe("POST /api/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true });
    mockBuildVerificationEmail.mockReturnValue({
      subject: "Verify your email",
      html: "<p>Verify</p>",
      text: "Verify",
    });
    // Default: Arcjet allows request
    mockProtect.mockResolvedValue({
      isDenied: () => false,
    });
  });

  it("sends verification email for authenticated unverified user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    });
    mockFindFirst.mockResolvedValue({
      email: "test@example.com",
      emailVerified: null,
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(mockBuildVerificationEmail).toHaveBeenCalledWith({
      userId: "user-123",
      appUrl: expect.any(String),
    });
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      subject: "Verify your email",
      html: "<p>Verify</p>",
      text: "Verify",
    });
  });

  it("returns success with alreadyVerified for verified user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    });
    mockFindFirst.mockResolvedValue({
      email: "test@example.com",
      emailVerified: new Date(),
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, alreadyVerified: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-missing", email: "test@example.com" },
    });
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ error: "User not found" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should return 429 when Arcjet rate limit is exceeded", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    });
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => true },
    });

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Too many requests");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should return 403 when Arcjet denies for non-rate-limit reason", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    });
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => false },
    });

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
