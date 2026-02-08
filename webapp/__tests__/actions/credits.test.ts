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
