/**
 * Unit tests for the subreddit settings onboarding wizard (Step 2).
 *
 * Verifies acceptance criteria from welcome-wizard.md:
 * - Overlay shown when ?onboarding=2 query param is present
 * - Overlay hidden when ?onboarding=2 is not present
 * - "Next" button appears after user has subreddits
 * - "Next" button navigates to /settings/api-keys?onboarding=3
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockSearchParams: Record<string, string> = {};
const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] ?? null,
  }),
}));

// Mock hooks
const mockUseSubreddits = vi.fn();
const mockUseAddSubreddit = vi.fn();
const mockUseRemoveSubreddit = vi.fn();

vi.mock("@/lib/hooks", () => ({
  useSubreddits: () => mockUseSubreddits(),
  useAddSubreddit: () => mockUseAddSubreddit(),
  useRemoveSubreddit: () => mockUseRemoveSubreddit(),
}));

import SubredditsSettingsPage from "@/app/settings/subreddits/page";

describe("Subreddit settings onboarding (Step 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
    mockUseAddSubreddit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    });
    mockUseRemoveSubreddit.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  it("shows onboarding overlay when ?onboarding=2 and no subreddits", () => {
    mockSearchParams = { onboarding: "2" };
    mockUseSubreddits.mockReturnValue({ data: [], isLoading: false });

    render(<SubredditsSettingsPage />);

    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(screen.getByText("Add a Subreddit")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Subreddits are the source of your posts. Add at least one subreddit to start tracking. Posts from the last 7 days will be fetched automatically."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
  });

  it("does not show onboarding overlay without ?onboarding=2", () => {
    mockSearchParams = {};
    mockUseSubreddits.mockReturnValue({ data: [], isLoading: false });

    render(<SubredditsSettingsPage />);

    expect(screen.queryByTestId("onboarding-overlay")).not.toBeInTheDocument();
  });

  it("shows Next button when user has subreddits during onboarding", () => {
    mockSearchParams = { onboarding: "2" };
    mockUseSubreddits.mockReturnValue({
      data: [{ id: "1", name: "reactjs" }],
      isLoading: false,
    });

    render(<SubredditsSettingsPage />);

    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("does not show Next button when user has no subreddits during onboarding", () => {
    mockSearchParams = { onboarding: "2" };
    mockUseSubreddits.mockReturnValue({ data: [], isLoading: false });

    render(<SubredditsSettingsPage />);

    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("Next button navigates to /settings/api-keys?onboarding=3", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "2" };
    mockUseSubreddits.mockReturnValue({
      data: [{ id: "1", name: "reactjs" }],
      isLoading: false,
    });

    render(<SubredditsSettingsPage />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/settings/api-keys?onboarding=3"
    );
  });
});
