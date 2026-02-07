/**
 * Unit tests for the Header component.
 *
 * Verifies acceptance criteria from ui-components.md:
 * - Fetch shows feedback: Loading state during fetch, count of new posts after
 * - Header shows title "Social Tracker"
 * - Fetch New button with loading state
 * - Settings button linking to /settings
 * - Error message display on fetch failure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/header";

// Mock UserMenu to avoid session dependency
vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Header component", () => {
  const defaultProps = {
    onFetch: vi.fn(),
    isFetching: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders 'Social Tracker' title", () => {
      render(<Header {...defaultProps} />);
      expect(screen.getByText("Social Tracker")).toBeInTheDocument();
    });

    it("renders Fetch New button", () => {
      render(<Header {...defaultProps} />);
      expect(screen.getByText("Fetch New")).toBeInTheDocument();
    });

    it("renders Settings link to /settings", () => {
      render(<Header {...defaultProps} />);
      const settingsLink = screen.getByText("Settings").closest("a");
      expect(settingsLink).toHaveAttribute("href", "/settings");
    });

    it("renders UserMenu", () => {
      render(<Header {...defaultProps} />);
      expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    });

  });

  describe("fetch loading state", () => {
    it("shows 'Fetching...' during API call", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let resolvePromise: (value: unknown) => void;
      defaultProps.onFetch.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      expect(screen.getByText("Fetching...")).toBeInTheDocument();

      // Clean up: resolve promise and flush the 5-second message-clear timeout
      await act(async () => {
        resolvePromise!({ success: true, count: 0 });
      });
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });

    it("disables fetch button during loading", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let resolvePromise: (value: unknown) => void;
      defaultProps.onFetch.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      const button = screen.getByRole("button", { name: /fetching/i });
      expect(button).toBeDisabled();

      // Clean up: resolve promise and flush the 5-second message-clear timeout
      await act(async () => {
        resolvePromise!({ success: true, count: 0 });
      });
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });

    it("shows loading state when isFetching prop is true", () => {
      render(<Header {...defaultProps} isFetching={true} />);
      expect(screen.getByText("Fetching...")).toBeInTheDocument();
      const button = screen.getByRole("button", { name: /fetching/i });
      expect(button).toBeDisabled();
    });
  });

  describe("fetch success feedback", () => {
    it("shows count of new posts after successful fetch", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: true,
        count: 5,
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        expect(screen.getByText("Found 5 new posts")).toBeInTheDocument();
      });

      // Flush the 5-second message-clear timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });

    it("shows custom message when provided", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: true,
        message: "Fetched 3 new posts from 2 subreddits",
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        expect(
          screen.getByText("Fetched 3 new posts from 2 subreddits")
        ).toBeInTheDocument();
      });

      // Flush the 5-second message-clear timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });

    it("shows 0 count when no new posts found", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: true,
        count: 0,
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        expect(screen.getByText("Found 0 new posts")).toBeInTheDocument();
      });

      // Flush the 5-second message-clear timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });

    it("clears message after 5 seconds", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: true,
        count: 3,
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        expect(screen.getByText("Found 3 new posts")).toBeInTheDocument();
      });

      // Advance past the 5-second timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });

      await waitFor(() => {
        expect(screen.queryByText("Found 3 new posts")).not.toBeInTheDocument();
      });
    });
  });

  describe("fetch error feedback", () => {
    it("shows error message on fetch failure", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: false,
        error: "No subreddits configured",
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        expect(
          screen.getByText("No subreddits configured")
        ).toBeInTheDocument();
      });

      // Flush the 5-second message-clear timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });

    it("shows generic error when no error message provided", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: false,
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        expect(screen.getByText("Failed to fetch posts")).toBeInTheDocument();
      });

      // Flush the 5-second message-clear timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });
  });

  describe("fetch button re-enabled after call", () => {
    it("re-enables button after successful fetch", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      defaultProps.onFetch.mockResolvedValue({
        success: true,
        count: 2,
      });

      render(<Header {...defaultProps} />);
      await user.click(screen.getByText("Fetch New"));

      await waitFor(() => {
        const button = screen.getByText("Fetch New").closest("button");
        expect(button).not.toBeDisabled();
      });

      // Flush the 5-second message-clear timeout
      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
    });
  });
});
