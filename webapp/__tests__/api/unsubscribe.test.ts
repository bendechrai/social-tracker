/**
 * Unit tests for POST /api/unsubscribe route.
 *
 * Tests cover:
 * - Valid token unsubscribes user (sets email_notifications = false)
 * - Expired token returns 400
 * - Invalid token returns 400
 * - Missing token returns 400
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

// Import AFTER mocks
import { POST } from "@/app/api/unsubscribe/route";

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/api/unsubscribe?token=${encodeURIComponent(token)}`
    : "http://localhost:3000/api/unsubscribe";
  return new NextRequest(url, { method: "POST" });
}

describe("POST /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unsubscribes user with valid token", async () => {
    mockVerifySignedToken.mockReturnValue({
      userId: "user-123",
      expires: Date.now() + 86400000,
    });

    const res = await POST(makeRequest("valid-token"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockVerifySignedToken).toHaveBeenCalledWith("valid-token");
    expect(mockUpdateSet).toHaveBeenCalledWith({ emailNotifications: false });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("returns 400 for expired token", async () => {
    mockVerifySignedToken.mockReturnValue(null);

    const res = await POST(makeRequest("expired-token"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid or expired token");
  });

  it("returns 400 for invalid token", async () => {
    mockVerifySignedToken.mockReturnValue(null);

    const res = await POST(makeRequest("tampered.token"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid or expired token");
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Missing token");
    expect(mockVerifySignedToken).not.toHaveBeenCalled();
  });
});
