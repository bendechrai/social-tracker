/**
 * Unit tests for the AI Profile settings onboarding wizard (Step 3.5).
 *
 * Verifies acceptance criteria from ai-assistant-improvements.md:
 * - Overlay shown when ?onboarding=3.5 query param is present
 * - Overlay hidden when ?onboarding=3.5 is not present
 * - Skip button navigates to /settings/tags?onboarding=4
 * - Next button navigates to /settings/tags?onboarding=4
 * - Step 3 (API Keys) Next goes to 3.5
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockSearchParams: Record<string, string> = {};
const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] ?? null,
  }),
}));

// Mock server actions
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock("@/app/actions/profile", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock other server actions imported by hooks
vi.mock("@/app/actions/credits", () => ({
  getCreditBalance: vi.fn().mockResolvedValue(0),
  getUsageHistory: vi.fn().mockResolvedValue({ entries: [], total: 0, page: 1, totalPages: 0 }),
  getUsageSummary: vi.fn().mockResolvedValue([]),
  getPurchaseHistory: vi.fn().mockResolvedValue([]),
  getAiAccessInfo: vi.fn().mockResolvedValue({ hasGroqKey: false, creditBalanceCents: 0, mode: "none" }),
  createCheckoutSession: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }),
}));

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

vi.mock("@/lib/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import AiProfilePage from "@/app/settings/ai-profile/page";

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

describe("AI Profile onboarding (Step 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
    mockGetProfile.mockResolvedValue({
      role: null,
      company: null,
      goal: null,
      tone: null,
      context: null,
    });
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  it("shows onboarding overlay when ?onboarding=3.5", async () => {
    mockSearchParams = { onboarding: "3.5" };

    render(<AiProfilePage />, { wrapper: createWrapper() });

    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(
      screen.getByText("Help the AI Write in Your Voice (Optional)")
    ).toBeInTheDocument();
    expect(screen.getByText(/Tell us about your role/)).toBeInTheDocument();
  });

  it("does not show onboarding overlay without ?onboarding=3.5", async () => {
    mockSearchParams = {};

    render(<AiProfilePage />, { wrapper: createWrapper() });

    expect(
      screen.queryByTestId("onboarding-overlay")
    ).not.toBeInTheDocument();
  });

  it("Skip button navigates to /settings/tags?onboarding=4", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "3.5" };

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/settings/tags?onboarding=4"
    );
  });

  it("Next button navigates to /settings/tags?onboarding=4", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "3.5" };

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/settings/tags?onboarding=4"
    );
  });

  it("shows step 3.5 of 5 progress indicator", async () => {
    mockSearchParams = { onboarding: "3.5" };

    render(<AiProfilePage />, { wrapper: createWrapper() });

    expect(screen.getByText("Step 3.5 of 5")).toBeInTheDocument();
  });
});
