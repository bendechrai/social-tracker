/**
 * Unit tests for POST /api/auth/reset-password (request reset).
 *
 * Tests:
 * - Valid request sends email and returns 200
 * - Non-existent email returns 200 (no email enumeration)
 * - Rate limit: token exists within 15min returns 200 without creating new token
 * - Token stored as SHA-256 hash (not raw)
 * - Existing tokens deleted before new one created
 * - Invalid email format returns 400
 * - Missing email returns 400
 * - Arcjet rate limit denial returns 429
 * - Arcjet bot detection denial returns 403
 * - Arcjet email validation denial returns 400
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";

// Mock Arcjet
const { mockProtect, mockProtectSignup } = vi.hoisted(() => {
  const mockProtect = vi.fn();
  const mockProtectSignup = vi.fn().mockReturnValue([]);
  return { mockProtect, mockProtectSignup };
});

vi.mock("@/lib/arcjet", () => ({
  default: {
    withRule: () => ({ protect: (...args: unknown[]) => mockProtect(...args) }),
  },
  ajMode: "DRY_RUN",
}));

vi.mock("@arcjet/next", () => ({
  protectSignup: (...args: unknown[]) => mockProtectSignup(...args),
}));

// Mock db chains
const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    delete: () => mockDelete(),
    insert: () => mockInsert(),
  },
}));

// Mock sendEmail
const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/email", () => ({
  sendEmail: (opts: unknown) => mockSendEmail(opts),
}));

// Mock buildPasswordResetEmail
const mockBuildPasswordResetEmail = vi.fn().mockReturnValue({
  subject: "Social Tracker — Reset Your Password",
  html: "<p>Reset</p>",
  text: "Reset",
});
vi.mock("@/lib/email-templates", () => ({
  buildPasswordResetEmail: (input: unknown) =>
    mockBuildPasswordResetEmail(input),
}));

// Import AFTER mocks
import { POST } from "@/app/api/auth/reset-password/route";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Arcjet allows the request
    mockProtect.mockResolvedValue({
      isDenied: () => false,
    });
  });

  it("sends reset email for valid request and returns 200", async () => {
    // First select: user lookup — found
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: "user-123", email: "test@example.com" },
      ])
      // Second select: rate limit check — no recent tokens
      .mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Should have deleted existing tokens
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();

    // Should have inserted a new token
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "test@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      })
    );

    // Verify the stored token is a SHA-256 hash (64 hex chars)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as {
      token: string;
    };
    expect(insertedValues.token).toMatch(/^[a-f0-9]{64}$/);

    // Should have sent the email
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "Social Tracker — Reset Your Password",
      })
    );

    // Build email was called with raw token (not hashed)
    expect(mockBuildPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        appUrl: expect.any(String),
      })
    );
    const buildArgs = mockBuildPasswordResetEmail.mock.calls[0]![0] as {
      token: string;
    };
    // Raw token should be 64 hex chars (32 bytes)
    expect(buildArgs.token).toMatch(/^[a-f0-9]{64}$/);
    // Raw token should NOT be the same as the stored hash
    expect(buildArgs.token).not.toBe(insertedValues.token);
  });

  it("returns 200 for non-existent email (no email enumeration)", async () => {
    // User lookup: not found
    mockSelectLimit.mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ email: "nobody@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Should NOT have attempted to create a token or send email
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("rate limits when token exists within 15 minutes", async () => {
    // User lookup: found
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: "user-123", email: "test@example.com" },
      ])
      // Rate limit check: recent token exists
      .mockResolvedValueOnce([{ token: "existing-hashed-token" }]);

    const res = await POST(makeRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });

    // Should NOT have deleted tokens or created new ones
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("stores token as SHA-256 hash, not raw token", async () => {
    // User found, no recent tokens
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: "user-123", email: "test@example.com" },
      ])
      .mockResolvedValueOnce([]);

    // Spy on crypto.randomBytes to capture the raw token
    const fakeRawBytes = Buffer.from("a".repeat(32));
    const randomBytesSpy = vi
      .spyOn(crypto, "randomBytes")
      .mockReturnValueOnce(fakeRawBytes as unknown as ReturnType<typeof crypto.randomBytes>);

    const expectedRawToken = fakeRawBytes.toString("hex");
    const expectedHash = crypto
      .createHash("sha256")
      .update(expectedRawToken)
      .digest("hex");

    await POST(makeRequest({ email: "test@example.com" }));

    const insertedValues = mockInsertValues.mock.calls[0]![0] as {
      token: string;
    };
    expect(insertedValues.token).toBe(expectedHash);

    // Email should receive the RAW token, not the hash
    const buildArgs = mockBuildPasswordResetEmail.mock.calls[0]![0] as {
      token: string;
    };
    expect(buildArgs.token).toBe(expectedRawToken);

    randomBytesSpy.mockRestore();
  });

  it("deletes existing tokens before creating new one", async () => {
    // User found, no recent tokens (rate limit passed)
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: "user-123", email: "test@example.com" },
      ])
      .mockResolvedValueOnce([]);

    await POST(makeRequest({ email: "test@example.com" }));

    // Delete should be called before insert
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();

    const deleteCallOrder = mockDelete.mock.invocationCallOrder[0]!;
    const insertCallOrder = mockInsert.mock.invocationCallOrder[0]!;
    expect(deleteCallOrder).toBeLessThan(insertCallOrder);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid email address");
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid email address");
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns 429 when Arcjet rate limits the request", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: {
        isRateLimit: () => true,
        isBot: () => false,
        isEmail: () => false,
      },
    });

    const res = await POST(makeRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Too many requests");
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when Arcjet detects a bot", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: {
        isRateLimit: () => false,
        isBot: () => true,
        isEmail: () => false,
      },
    });

    const res = await POST(makeRequest({ email: "test@example.com" }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Forbidden");
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when Arcjet email validation fails", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: {
        isRateLimit: () => false,
        isBot: () => false,
        isEmail: () => true,
      },
    });

    const res = await POST(
      makeRequest({ email: "user@disposable.com" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid email address");
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
