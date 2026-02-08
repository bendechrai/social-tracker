/**
 * Unit tests for /api/unsubscribe route (POST and GET).
 *
 * POST tests:
 * - Valid token unsubscribes user (sets email_notifications = false)
 * - Expired token returns 400
 * - Invalid token returns 400
 * - Missing token returns 400
 *
 * GET tests:
 * - Valid token returns HTML confirmation page (does not modify DB)
 * - Invalid token returns HTML error page
 * - Missing token returns HTML error page
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
import { POST, GET } from "@/app/api/unsubscribe/route";

function makeRequest(token?: string, method = "POST"): NextRequest {
  const url = token
    ? `http://localhost:3000/api/unsubscribe?token=${encodeURIComponent(token)}`
    : "http://localhost:3000/api/unsubscribe";
  return new NextRequest(url, { method });
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

describe("GET /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTML confirmation page with valid token and does not modify DB", async () => {
    mockVerifySignedToken.mockReturnValue({
      userId: "user-123",
      expires: Date.now() + 86400000,
    });

    const res = await GET(makeRequest("valid-token", "GET"));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Unsubscribe from Email Notifications");
    expect(html).toContain("form");
    expect(html).toContain('method="POST"');
    expect(html).toContain("/settings/account");
    // Must NOT change the database on GET
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("returns HTML error page for invalid token", async () => {
    mockVerifySignedToken.mockReturnValue(null);

    const res = await GET(makeRequest("bad-token", "GET"));
    const html = await res.text();

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Invalid Link");
    expect(html).toContain("invalid or has expired");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns HTML error page when token is missing", async () => {
    const res = await GET(makeRequest(undefined, "GET"));
    const html = await res.text();

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Invalid Link");
    expect(html).toContain("missing a token");
    expect(mockVerifySignedToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
