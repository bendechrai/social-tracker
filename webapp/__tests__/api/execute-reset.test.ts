/**
 * Unit tests for POST /api/auth/execute-reset.
 *
 * Tests:
 * - Valid reset: updates password, sets passwordChangedAt, deletes token, returns 200
 * - Expired token returns 400
 * - Invalid token (not found) returns 400
 * - Password validation failure returns 400
 * - Passwords don't match returns 400
 * - Token deleted after successful use
 * - Missing token returns 400
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db chains
const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateSetReturn = { where: mockUpdateWhere };
const mockUpdate = vi.fn(() => ({ set: (...args: unknown[]) => { mockUpdateSet(...args); return mockUpdateSetReturn; } }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    delete: () => mockDelete(),
    update: () => mockUpdate(),
  },
}));

// Mock hashPassword
const mockHashPassword = vi.fn().mockResolvedValue("$2b$12$hashedpassword");
vi.mock("@/lib/password", () => ({
  hashPassword: (pw: string) => mockHashPassword(pw),
}));

// Import AFTER mocks
import { POST } from "@/app/api/auth/execute-reset/route";

const VALID_PASSWORD = "MyStr0ng!Pass";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/execute-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/execute-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets password for valid token and returns 200", async () => {
    const rawToken = "abc123rawtoken";
    const futureExpiry = new Date(Date.now() + 3600000);

    // First select: token lookup — found with valid expiry
    mockSelectLimit
      .mockResolvedValueOnce([
        { identifier: "user@example.com", expires: futureExpiry },
      ])
      // Second select: user lookup — found
      .mockResolvedValueOnce([{ id: "user-456" }]);

    const res = await POST(
      makeRequest({
        token: rawToken,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Should have hashed the new password
    expect(mockHashPassword).toHaveBeenCalledWith(VALID_PASSWORD);

    // Should have updated the user
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: "$2b$12$hashedpassword",
        passwordChangedAt: expect.any(Date),
      })
    );
    expect(mockUpdateWhere).toHaveBeenCalled();

    // Should have deleted the used token
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("returns 400 for expired token", async () => {
    const rawToken = "expiredtoken";
    const pastExpiry = new Date(Date.now() - 1000);

    // Token lookup — found but expired
    mockSelectLimit.mockResolvedValueOnce([
      { identifier: "user@example.com", expires: pastExpiry },
    ]);

    const res = await POST(
      makeRequest({
        token: rawToken,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid or expired reset link");

    // Should not update password or delete token
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid token (not found)", async () => {
    // Token lookup — not found
    mockSelectLimit.mockResolvedValueOnce([]);

    const res = await POST(
      makeRequest({
        token: "nonexistenttoken",
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid or expired reset link");

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 400 for password validation failure", async () => {
    const res = await POST(
      makeRequest({
        token: "sometoken",
        password: "short",
        confirmPassword: "short",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Password must be at least 12 characters");

    // Should not touch the database
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when passwords do not match", async () => {
    const res = await POST(
      makeRequest({
        token: "sometoken",
        password: VALID_PASSWORD,
        confirmPassword: "DifferentPass1!",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Passwords do not match");

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("deletes the used token after successful reset", async () => {
    const rawToken = "tokenToDelete";
    const futureExpiry = new Date(Date.now() + 3600000);

    // Token lookup — found
    mockSelectLimit
      .mockResolvedValueOnce([
        { identifier: "user@example.com", expires: futureExpiry },
      ])
      // User lookup — found
      .mockResolvedValueOnce([{ id: "user-789" }]);

    await POST(
      makeRequest({
        token: rawToken,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      })
    );

    // Token deletion should happen after password update
    expect(mockDelete).toHaveBeenCalled();
    const updateCallOrder = mockUpdate.mock.invocationCallOrder[0]!;
    const deleteCallOrder = mockDelete.mock.invocationCallOrder[0]!;
    expect(updateCallOrder).toBeLessThan(deleteCallOrder);
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(
      makeRequest({
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Token is required");

    expect(mockSelect).not.toHaveBeenCalled();
  });
});
