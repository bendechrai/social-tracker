/**
 * Unit tests for POST /api/webhooks/stripe route.
 *
 * Tests cover:
 * - Valid webhook processes checkout.session.completed correctly
 * - Invalid signature returns 400
 * - Idempotent: duplicate session_id does not double-credit
 * - Balance incremented via upsert
 * - Purchase record created with correct fields
 * - Non-checkout event is ignored (returns 200)
 * - Arcjet rate limit denial returns 429
 * - Arcjet non-rate-limit denial returns 403
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- DB mock ---
const mockTransaction = vi.fn();
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    transaction: (fn: (tx: unknown) => Promise<void>) => mockTransaction(fn),
  },
}));

// --- Stripe mock ---
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
}));

// --- drizzle-orm mock (need sql template tag) ---
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    sql: actual.sql,
  };
});

// --- Arcjet mock ---
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

// Import after mocks
import { POST } from "@/app/api/webhooks/stripe/route";
import { NextRequest } from "next/server";

function createRequest(
  body: string,
  signature: string | null = "sig_test_123"
): NextRequest {
  const headers = new Headers();
  if (signature !== null) {
    headers.set("stripe-signature", signature);
  }
  headers.set("content-type", "application/json");

  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

function makeCheckoutEvent(
  sessionId = "cs_test_abc",
  metadata = { userId: "user-123", creditsCents: "500" },
  amountTotal = 500
) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        metadata,
        amount_total: amountTotal,
      },
    },
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    // Default: Arcjet allows request
    mockProtect.mockResolvedValue({ isDenied: () => false });

    // Default: transaction executes its callback
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: (...args: unknown[]) => {
          mockInsert(...args);
          return {
            values: (...vArgs: unknown[]) => {
              mockInsertValues(...vArgs);
              return {
                onConflictDoNothing: (...cArgs: unknown[]) => {
                  mockOnConflictDoNothing(...cArgs);
                  return Promise.resolve();
                },
                onConflictDoUpdate: (...cArgs: unknown[]) => {
                  mockOnConflictDoUpdate(...cArgs);
                  return Promise.resolve();
                },
              };
            },
          };
        },
      };
      await fn(tx);
    });
  });

  it("processes a valid checkout.session.completed event correctly", async () => {
    const event = makeCheckoutEvent("cs_test_123", {
      userId: "user-456",
      creditsCents: "1000",
    }, 1000);
    mockConstructEvent.mockReturnValue(event);

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // Verify transaction was called
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Verify purchase record inserted
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-456",
        stripeSessionId: "cs_test_123",
        amountCents: 1000,
        creditsCents: 1000,
        status: "completed",
      })
    );

    // Verify onConflictDoNothing for idempotency on purchases
    expect(mockOnConflictDoNothing).toHaveBeenCalled();

    // Verify balance upsert
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("returns 400 for invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid signature");

    // Transaction should not have been called
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("is idempotent — duplicate session_id does not double-credit via ON CONFLICT DO NOTHING", async () => {
    const event = makeCheckoutEvent("cs_test_duplicate");
    mockConstructEvent.mockReturnValue(event);

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);

    expect(response.status).toBe(200);

    // The onConflictDoNothing on credit_purchases ensures idempotency
    expect(mockOnConflictDoNothing).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.anything(),
      })
    );
  });

  it("increments balance via upsert when balance row exists", async () => {
    const event = makeCheckoutEvent("cs_test_balance", {
      userId: "user-789",
      creditsCents: "2000",
    }, 2000);
    mockConstructEvent.mockReturnValue(event);

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify two inserts: one for purchases, one for balances
    expect(mockInsert).toHaveBeenCalledTimes(2);

    // The second insert (balance) uses onConflictDoUpdate to increment
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);

    // Verify balance insert values
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-789",
        balanceCents: 2000,
      })
    );
  });

  it("creates purchase record with correct fields", async () => {
    const event = makeCheckoutEvent("cs_test_purchase", {
      userId: "user-abc",
      creditsCents: "500",
    }, 500);
    mockConstructEvent.mockReturnValue(event);

    const request = createRequest('{"test":"body"}');
    await POST(request);

    // First insertValues call is the purchase record
    const firstCall = mockInsertValues.mock.calls[0]?.[0];
    expect(firstCall).toEqual({
      userId: "user-abc",
      stripeSessionId: "cs_test_purchase",
      amountCents: 500,
      creditsCents: 500,
      status: "completed",
    });
  });

  it("ignores non-checkout events and returns 200", async () => {
    const event = {
      type: "payment_intent.created",
      data: { object: {} },
    };
    mockConstructEvent.mockReturnValue(event);

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // No transaction should have been executed
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const request = createRequest('{"test":"body"}', null);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Missing stripe-signature header");
  });

  it("returns 429 when Arcjet rate limit is denied", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => true },
    });

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many requests");
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 403 when Arcjet denies for non-rate-limit reason", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => false },
    });

    const request = createRequest('{"test":"body"}');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
