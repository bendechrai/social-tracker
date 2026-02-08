import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Auth mock ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// --- DB mock functions ---
const mockFindFirst = vi.fn();

// Each db.select() call pops the next result from this queue.
// Each result in the queue is what the entire chain resolves to.
let selectResults: unknown[] = [];

/**
 * Creates a thenable chain object: every method call (from, where, orderBy,
 * groupBy, limit, offset) returns the same thenable that eventually resolves
 * to `result`. This matches Drizzle's builder pattern where the builder is
 * both chainable and awaitable.
 */
function createThenable(result: unknown): Record<string, unknown> {
  const resolved = Promise.resolve(result);
  const handler: ProxyHandler<object> = {
    get(target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const p = target as unknown as Promise<unknown>;
        if (prop === "then") return p.then.bind(p);
        if (prop === "catch") return p.catch.bind(p);
        return p.finally.bind(p);
      }
      // Any method call (from, where, orderBy, etc.) returns the same thenable
      return () => new Proxy(Promise.resolve(result), handler);
    },
  };
  return new Proxy(resolved as object, handler) as unknown as Record<string, unknown>;
}

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      creditBalances: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: () => {
      const result = selectResults.shift();
      return createThenable(result);
    },
  },
}));

// --- Encryption mock ---
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((val: string) => val),
}));

// --- Stripe mock ---
const mockCheckoutSessionsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
  }),
}));

// --- Credit packs mock ---
vi.mock("@/lib/credit-packs", () => ({
  CREDIT_PACKS: [
    { amountCents: 500, creditsCents: 500, label: "$5" },
    { amountCents: 1000, creditsCents: 1000, label: "$10" },
    { amountCents: 2000, creditsCents: 2000, label: "$20" },
  ],
  isValidPackAmount: (amount: number) => [500, 1000, 2000].includes(amount),
}));

// --- Import actions AFTER mocks ---
import {
  getCreditBalance,
  getAiAccessInfo,
  createCheckoutSession,
  getUsageHistory,
  getUsageSummary,
  getPurchaseHistory,
} from "@/app/actions/credits";

const MOCK_USER_ID = "user-123";

beforeEach(() => {
  vi.resetAllMocks();
  selectResults = [];
  mockAuth.mockResolvedValue({
    user: { id: MOCK_USER_ID },
  });
});

// ============================================================
// getCreditBalance
// ============================================================
describe("getCreditBalance", () => {
  it("returns balance when row exists", async () => {
    mockFindFirst.mockResolvedValue({ balanceCents: 1500 });

    const result = await getCreditBalance();

    expect(result).toBe(1500);
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it("returns 0 when no credit_balances row exists", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await getCreditBalance();

    expect(result).toBe(0);
  });

  it("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getCreditBalance()).rejects.toThrow("Unauthorized");
  });
});

// ============================================================
// getAiAccessInfo
// ============================================================
describe("getAiAccessInfo", () => {
  it("returns byok mode when user has Groq API key", async () => {
    // First call: users.findFirst (groqApiKey), second call: creditBalances.findFirst
    mockFindFirst
      .mockResolvedValueOnce({ groqApiKey: "encrypted-key" })
      .mockResolvedValueOnce({ balanceCents: 0 });

    const result = await getAiAccessInfo();

    expect(result).toEqual({
      hasGroqKey: true,
      creditBalanceCents: 0,
      mode: "byok",
    });
  });

  it("returns credits mode when user has balance but no Groq key", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ groqApiKey: null })
      .mockResolvedValueOnce({ balanceCents: 500 });

    const result = await getAiAccessInfo();

    expect(result).toEqual({
      hasGroqKey: false,
      creditBalanceCents: 500,
      mode: "credits",
    });
  });

  it("returns none mode when user has neither Groq key nor credits", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ groqApiKey: null })
      .mockResolvedValueOnce(undefined);

    const result = await getAiAccessInfo();

    expect(result).toEqual({
      hasGroqKey: false,
      creditBalanceCents: 0,
      mode: "none",
    });
  });

  it("prefers byok over credits when both exist", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ groqApiKey: "encrypted-key" })
      .mockResolvedValueOnce({ balanceCents: 1000 });

    const result = await getAiAccessInfo();

    expect(result).toEqual({
      hasGroqKey: true,
      creditBalanceCents: 1000,
      mode: "byok",
    });
  });
});

// ============================================================
// createCheckoutSession
// ============================================================
describe("createCheckoutSession", () => {
  it("creates a valid Stripe Checkout session and returns URL", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });

    const result = await createCheckoutSession(500);

    expect(result).toEqual({ url: "https://checkout.stripe.com/pay/cs_test_123" });
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: {
          userId: MOCK_USER_ID,
          creditsCents: "500",
        },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 500,
            }),
          }),
        ],
      })
    );
  });

  it("rejects invalid pack amount", async () => {
    const result = await createCheckoutSession(999);

    expect(result).toEqual({ error: "Invalid credit pack amount" });
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(createCheckoutSession(500)).rejects.toThrow("Unauthorized");
  });

  it("returns error message when Stripe fails", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ url: null });

    const result = await createCheckoutSession(1000);

    expect(result).toEqual({ error: "Failed to create checkout session" });
  });
});

// ============================================================
// getUsageHistory
// ============================================================
describe("getUsageHistory", () => {
  it("returns paginated usage log entries", async () => {
    const mockEntries = [
      {
        id: "entry-1",
        modelId: "openai/gpt-4o",
        provider: "openrouter",
        promptTokens: 100,
        completionTokens: 50,
        costCents: 3,
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
      {
        id: "entry-2",
        modelId: "anthropic/claude-3.5-sonnet",
        provider: "openrouter",
        promptTokens: 200,
        completionTokens: 100,
        costCents: 5,
        createdAt: new Date("2026-01-14T10:00:00Z"),
      },
    ];

    // First db.select() → entries, second db.select() → count
    selectResults = [mockEntries, [{ count: 15 }]];

    const result = await getUsageHistory(1, 20);

    expect(result.entries).toEqual(mockEntries);
    expect(result.total).toBe(15);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1); // ceil(15/20) = 1
  });

  it("returns empty array when no usage history exists", async () => {
    selectResults = [[], [{ count: 0 }]];

    const result = await getUsageHistory(1, 20);

    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(0);
  });

  it("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getUsageHistory()).rejects.toThrow("Unauthorized");
  });
});

// ============================================================
// getUsageSummary
// ============================================================
describe("getUsageSummary", () => {
  it("returns daily cost aggregates", async () => {
    const mockRows = [
      { date: "2026-01-13", costCents: "10" },
      { date: "2026-01-14", costCents: "25" },
      { date: "2026-01-15", costCents: "5" },
    ];

    selectResults = [mockRows];

    const result = await getUsageSummary();

    expect(result).toEqual([
      { date: "2026-01-13", costCents: 10 },
      { date: "2026-01-14", costCents: 25 },
      { date: "2026-01-15", costCents: 5 },
    ]);
  });

  it("returns empty array when no usage in last 30 days", async () => {
    selectResults = [[]];

    const result = await getUsageSummary();

    expect(result).toEqual([]);
  });

  it("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getUsageSummary()).rejects.toThrow("Unauthorized");
  });
});

// ============================================================
// getPurchaseHistory
// ============================================================
describe("getPurchaseHistory", () => {
  it("returns list of purchases ordered by date desc", async () => {
    const mockPurchases = [
      {
        id: "purchase-1",
        amountCents: 1000,
        creditsCents: 1000,
        status: "completed",
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
      {
        id: "purchase-2",
        amountCents: 500,
        creditsCents: 500,
        status: "completed",
        createdAt: new Date("2026-01-10T10:00:00Z"),
      },
    ];

    selectResults = [mockPurchases];

    const result = await getPurchaseHistory();

    expect(result).toEqual(mockPurchases);
  });

  it("returns empty array when no purchases exist", async () => {
    selectResults = [[]];

    const result = await getPurchaseHistory();

    expect(result).toEqual([]);
  });

  it("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getPurchaseHistory()).rejects.toThrow("Unauthorized");
  });
});
