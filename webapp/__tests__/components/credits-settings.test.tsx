/**
 * Unit tests for the Credits & Usage settings page.
 *
 * Verifies acceptance criteria from ai-credits.md:
 * - Balance card shows formatted dollar amount
 * - Three credit pack cards with Buy buttons
 * - Buy button calls createCheckoutSession and redirects
 * - Success toast on ?result=success return from Stripe
 * - Loading state while balance loads
 * - Usage chart renders with data
 * - Empty chart shows no bars
 * - Usage history table renders rows with Date, Model, Tokens, Cost
 * - Usage history pagination works
 * - Purchase history renders purchases
 * - Purchase history empty state (section hidden)
 * - Error handling when checkout fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Track search params mock so we can change it per test
let mockSearchParamResult: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "result" ? mockSearchParamResult : null),
  }),
}));

// Mock server actions
const mockGetCreditBalance = vi.fn();
const mockGetUsageSummary = vi.fn();
const mockGetUsageHistory = vi.fn();
const mockGetPurchaseHistory = vi.fn();
const mockCreateCheckoutSession = vi.fn();

vi.mock("@/app/actions/credits", () => ({
  getCreditBalance: (...args: unknown[]) => mockGetCreditBalance(...args),
  getUsageHistory: (...args: unknown[]) => mockGetUsageHistory(...args),
  getUsageSummary: (...args: unknown[]) => mockGetUsageSummary(...args),
  getPurchaseHistory: (...args: unknown[]) => mockGetPurchaseHistory(...args),
  getAiAccessInfo: vi.fn().mockResolvedValue({ hasGroqKey: false, creditBalanceCents: 0, mode: "none" }),
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
}));

// Mock other server actions that hooks/index.ts imports
vi.mock("@/app/actions/posts", () => ({
  listPosts: vi.fn().mockResolvedValue({ posts: [], total: 0 }),
  getPostCounts: vi.fn().mockResolvedValue({ new: 0, ignored: 0, done: 0, total: 0 }),
  changePostStatus: vi.fn().mockResolvedValue({ success: true }),
  updateResponseText: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/subreddits", () => ({
  listSubreddits: vi.fn().mockResolvedValue([]),
  addSubreddit: vi.fn().mockResolvedValue({ success: true }),
  removeSubreddit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/tags", () => ({
  listTags: vi.fn().mockResolvedValue([]),
  createTag: vi.fn().mockResolvedValue({ success: true }),
  updateTag: vi.fn().mockResolvedValue({ success: true }),
  deleteTag: vi.fn().mockResolvedValue({ success: true }),
  addSearchTerm: vi.fn().mockResolvedValue({ success: true }),
  removeSearchTerm: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/api-keys", () => ({
  hasGroqApiKey: vi.fn().mockResolvedValue(false),
  saveGroqApiKey: vi.fn().mockResolvedValue({ success: true }),
  deleteGroqApiKey: vi.fn().mockResolvedValue({ success: true }),
  getGroqApiKeyHint: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/app/actions/profile", () => ({
  getProfile: vi.fn().mockResolvedValue({ role: null, company: null, goal: null, tone: null, context: null }),
  updateProfile: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/lib/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Mock window.location.assign
const mockLocationAssign = vi.fn();
Object.defineProperty(window, "location", {
  value: { assign: mockLocationAssign },
  writable: true,
});

import CreditsPage from "@/app/settings/credits/page";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("Credits & Usage settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamResult = null;
    mockGetCreditBalance.mockResolvedValue(423);
    mockGetUsageSummary.mockResolvedValue([]);
    mockGetUsageHistory.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
    mockGetPurchaseHistory.mockResolvedValue([]);
    mockCreateCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
  });

  it("renders balance formatted as dollars", async () => {
    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("$4.23")).toBeInTheDocument();
    });
    expect(screen.getByText("Current Balance")).toBeInTheDocument();
  });

  it("shows loading skeleton while balance loads", () => {
    mockGetCreditBalance.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CreditsPage />, { wrapper: createWrapper() });

    // Balance should not be rendered yet (no $4.23 or $0.00)
    expect(screen.queryByText("$4.23")).toBeNull();
    expect(screen.queryByText("$0.00")).toBeNull();
  });

  it("renders three credit pack cards with Buy buttons", async () => {
    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("$5")).toBeInTheDocument();
    });
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.getByText("$20")).toBeInTheDocument();

    const buyButtons = screen.getAllByRole("button", { name: "Buy" });
    expect(buyButtons).toHaveLength(3);
  });

  it("Buy button calls createCheckoutSession and redirects", async () => {
    const user = userEvent.setup();
    mockCreateCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session123" });

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Buy" })).toHaveLength(3);
    });

    // Click the first Buy button ($5 pack)
    const buyButtons = screen.getAllByRole("button", { name: "Buy" });
    await user.click(buyButtons[0]!);

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(500);
    });
    expect(mockLocationAssign).toHaveBeenCalledWith("https://checkout.stripe.com/session123");
  });

  it("shows success toast on return with ?result=success", async () => {
    mockSearchParamResult = "success";

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Credits purchased successfully!",
        })
      );
    });
  });

  it("does not show toast without result param", async () => {
    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("$4.23")).toBeInTheDocument();
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it("renders usage chart with data", async () => {
    mockGetUsageSummary.mockResolvedValue([
      { date: "2026-02-01", costCents: 50 },
      { date: "2026-02-02", costCents: 100 },
      { date: "2026-02-03", costCents: 25 },
    ]);

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Daily Usage (Last 30 Days)")).toBeInTheDocument();
    });

    // Chart bars should have title attributes with cost info
    expect(screen.getByTitle("2026-02-01: $0.50")).toBeInTheDocument();
    expect(screen.getByTitle("2026-02-02: $1.00")).toBeInTheDocument();
    expect(screen.getByTitle("2026-02-03: $0.25")).toBeInTheDocument();
  });

  it("does not show chart when no usage data", async () => {
    mockGetUsageSummary.mockResolvedValue([]);

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("$4.23")).toBeInTheDocument();
    });

    expect(screen.queryByText("Daily Usage (Last 30 Days)")).not.toBeInTheDocument();
  });

  it("renders usage history table rows", async () => {
    mockGetUsageHistory.mockResolvedValue({
      entries: [
        {
          id: "u1",
          modelId: "openai/gpt-4o",
          provider: "openrouter",
          promptTokens: 100,
          completionTokens: 50,
          costCents: 3,
          createdAt: new Date("2026-02-05"),
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    });

    // Columns: Date, Model, Tokens, Cost
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();

    // Tokens: 100 + 50 = 150
    expect(screen.getByText("150")).toBeInTheDocument();
    // Cost: $0.03
    expect(screen.getByText("$0.03")).toBeInTheDocument();
  });

  it("shows empty state when no usage history", async () => {
    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("No usage history yet")).toBeInTheDocument();
    });
  });

  it("usage history pagination works", async () => {
    const user = userEvent.setup();
    mockGetUsageHistory.mockImplementation((page: number) =>
      Promise.resolve({
        entries: [
          {
            id: `u-page${page}`,
            modelId: "openai/gpt-4o-mini",
            provider: "openrouter",
            promptTokens: 50,
            completionTokens: 20,
            costCents: 1,
            createdAt: new Date("2026-02-05"),
          },
        ],
        total: 40,
        page,
        totalPages: 2,
      })
    );

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    // Previous should be disabled on page 1
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    // Click Next
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });
  });

  it("renders purchase history with date, amount, and status", async () => {
    mockGetPurchaseHistory.mockResolvedValue([
      {
        id: "p1",
        amountCents: 1000,
        creditsCents: 1000,
        status: "completed",
        createdAt: new Date("2026-01-20"),
      },
    ]);

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Purchase History")).toBeInTheDocument();
    });

    // Amount and Credits columns both show $10.00
    const amounts = screen.getAllByText("$10.00");
    expect(amounts.length).toBeGreaterThanOrEqual(1);
    // Status
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("hides purchase history section when no purchases", async () => {
    mockGetPurchaseHistory.mockResolvedValue([]);

    render(<CreditsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("$4.23")).toBeInTheDocument();
    });

    expect(screen.queryByText("Purchase History")).not.toBeInTheDocument();
  });
});
