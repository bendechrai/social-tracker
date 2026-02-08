/**
 * Unit tests for the dashboard welcome wizard (Step 1).
 *
 * Verifies acceptance criteria from welcome-wizard.md:
 * - Overlay shown when user has zero subreddits
 * - Overlay hidden when user has subreddits
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock server actions for users
const mockGetEmailVerified = vi.fn();
const mockGetShowNsfw = vi.fn();

vi.mock("@/app/actions/users", () => ({
  getEmailVerified: () => mockGetEmailVerified(),
  getShowNsfw: () => mockGetShowNsfw(),
}));

// Mock hooks
const mockUsePosts = vi.fn();
const mockUsePostCounts = vi.fn();
const mockUseChangePostStatus = vi.fn();
const mockUseUpdateResponseText = vi.fn();
const mockUseSubreddits = vi.fn();
const mockUseTags = vi.fn();

vi.mock("@/lib/hooks", () => ({
  usePosts: () => mockUsePosts(),
  usePostCounts: () => mockUsePostCounts(),
  useChangePostStatus: () => mockUseChangePostStatus(),
  useUpdateResponseText: () => mockUseUpdateResponseText(),
  useSubreddits: () => mockUseSubreddits(),
  useTags: () => mockUseTags(),
}));

const mockToast = vi.fn();

vi.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock child components
vi.mock("@/components/header", () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock("@/components/status-tabs", () => ({
  StatusTabs: () => <div data-testid="status-tabs">StatusTabs</div>,
}));

vi.mock("@/components/tag-filter", () => ({
  TagFilter: () => <div data-testid="tag-filter">TagFilter</div>,
}));

vi.mock("@/components/post-list", () => ({
  PostList: () => <div data-testid="post-list">PostList</div>,
}));

vi.mock("@/components/ui/pagination", () => ({
  Pagination: () => <div data-testid="pagination">Pagination</div>,
}));

import DashboardPage from "@/app/dashboard/page";

describe("Dashboard onboarding wizard (Step 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmailVerified.mockResolvedValue(true);
    mockGetShowNsfw.mockResolvedValue(false);
    mockUsePosts.mockReturnValue({
      data: { posts: [], total: 0, totalPages: 0 },
      isLoading: false,
    });
    mockUsePostCounts.mockReturnValue({ data: { new: 0, ignored: 0, done: 0 } });
    mockUseChangePostStatus.mockReturnValue({ mutateAsync: vi.fn() });
    mockUseUpdateResponseText.mockReturnValue({ mutateAsync: vi.fn() });
    mockUseTags.mockReturnValue({ data: [] });
  });

  it("shows welcome overlay when user has zero subreddits", async () => {
    mockUseSubreddits.mockReturnValue({ data: [] });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    });
    expect(screen.getByText("Welcome to Social Tracker")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Track Reddit posts across subreddits and organize them with tags. Let's get you set up."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("hides welcome overlay when user has subreddits", async () => {
    mockUseSubreddits.mockReturnValue({
      data: [{ id: "1", name: "reactjs" }],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("onboarding-overlay")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome to Social Tracker")).not.toBeInTheDocument();
  });

  it("navigates to subreddit settings with onboarding param on Get Started click", async () => {
    const user = userEvent.setup();
    mockUseSubreddits.mockReturnValue({ data: [] });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Get Started" }));

    expect(mockRouterPush).toHaveBeenCalledWith("/settings/subreddits?onboarding=2");
  });
});
