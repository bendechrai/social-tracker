import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Auth mock ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// --- DB mock functions ---
const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockGroupBy = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

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
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                orderBy: (...oArgs: unknown[]) => {
                  mockOrderBy(...oArgs);
                  return {
                    limit: (...lArgs: unknown[]) => {
                      mockLimit(...lArgs);
                      return {
                        offset: (...offArgs: unknown[]) => {
                          mockOffset(...offArgs);
                          return mockOffset();
                        },
                      };
                    },
                  };
                },
                groupBy: (...gArgs: unknown[]) => {
                  mockGroupBy(...gArgs);
                  return {
                    orderBy: (...oArgs: unknown[]) => {
                      mockOrderBy(...oArgs);
                      return mockOrderBy();
                    },
                  };
                },
              };
            },
          };
        },
      };
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
