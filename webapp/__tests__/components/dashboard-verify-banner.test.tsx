/**
 * Unit tests for the dashboard verification banner.
 *
 * Verifies acceptance criteria from welcome-email.md:
 * - Banner visible when email not verified
 * - Banner hidden when email verified
 * - Banner dismissible (client-side state)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

vi.mock("@/app/actions/users", () => ({
  getEmailVerified: () => mockGetEmailVerified(),
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

// Mock child components that would cause issues
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

describe("Dashboard verification banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePosts.mockReturnValue({
      data: { posts: [], total: 0, totalPages: 0 },
      isLoading: false,
    });
    mockUsePostCounts.mockReturnValue({ data: { new: 0, ignored: 0, done: 0 } });
    mockUseChangePostStatus.mockReturnValue({ mutateAsync: vi.fn() });
    mockUseUpdateResponseText.mockReturnValue({ mutateAsync: vi.fn() });
    mockUseSubreddits.mockReturnValue({ data: [{ id: "1", name: "test" }] });
    mockUseTags.mockReturnValue({ data: [{ id: "1", name: "tag1", color: "#000" }] });
  });

  it("shows verification banner when email is not verified", async () => {
    mockGetEmailVerified.mockResolvedValue(false);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/please verify your email to receive notifications/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/resend verification email/i)
    ).toBeInTheDocument();
  });

  it("hides verification banner when email is verified", async () => {
    mockGetEmailVerified.mockResolvedValue(true);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    // Wait a tick for the state to settle
    await waitFor(() => {
      expect(
        screen.queryByText(/please verify your email to receive notifications/i)
      ).not.toBeInTheDocument();
    });
  });

  it("dismisses banner when close button is clicked", async () => {
    const user = userEvent.setup();
    mockGetEmailVerified.mockResolvedValue(false);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/please verify your email to receive notifications/i)
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /dismiss verification banner/i })
    );

    expect(
      screen.queryByText(/please verify your email to receive notifications/i)
    ).not.toBeInTheDocument();
  });
});
