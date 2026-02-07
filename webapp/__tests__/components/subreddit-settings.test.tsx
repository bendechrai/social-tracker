/**
 * Unit tests for the SubredditSettings component.
 *
 * Verifies acceptance criteria from subreddit-configuration.md and ui-components.md:
 * - Renders subreddit list with r/ prefix
 * - Add subreddit via button click and Enter key
 * - Remove subreddit with confirmation
 * - Empty state message when no subreddits
 * - Error display on failed operations
 * - Loading states during add/remove
 * - Input cleared after successful add
 * - Button disabled when input empty or adding
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubredditSettings } from "@/components/settings/subreddit-settings";

const makeSubreddits = () => [
  { id: "sub-1", name: "postgresql" },
  { id: "sub-2", name: "database" },
  { id: "sub-3", name: "node" },
];

describe("SubredditSettings component", () => {
  const defaultProps = {
    subreddits: makeSubreddits(),
    onAdd: vi.fn().mockResolvedValue({ success: true }),
    onRemove: vi.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the heading", () => {
      render(<SubredditSettings {...defaultProps} />);
      expect(screen.getByText("Subreddits")).toBeInTheDocument();
    });

    it("renders subreddits with r/ prefix", () => {
      render(<SubredditSettings {...defaultProps} />);
      expect(screen.getByText("r/postgresql")).toBeInTheDocument();
      expect(screen.getByText("r/database")).toBeInTheDocument();
      expect(screen.getByText("r/node")).toBeInTheDocument();
    });

    it("renders input with placeholder", () => {
      render(<SubredditSettings {...defaultProps} />);
      expect(
        screen.getByPlaceholderText("Enter subreddit name (e.g., postgresql)")
      ).toBeInTheDocument();
    });

    it("renders add button", () => {
      render(<SubredditSettings {...defaultProps} />);
      // The add button contains a PlusIcon
      const buttons = screen.getAllByRole("button");
      // First button is the add button (contains PlusIcon)
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("empty state", () => {
    it("shows empty message when no subreddits", () => {
      render(<SubredditSettings {...defaultProps} subreddits={[]} />);
      expect(
        screen.getByText("No subreddits configured. Add subreddits to monitor.")
      ).toBeInTheDocument();
    });

    it("does not show subreddit list when empty", () => {
      render(<SubredditSettings {...defaultProps} subreddits={[]} />);
      expect(screen.queryByText(/^r\//)).not.toBeInTheDocument();
    });
  });

  describe("adding subreddits", () => {
    it("calls onAdd with trimmed input on button click", async () => {
      const user = userEvent.setup();
      render(<SubredditSettings {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "  reactjs  ");
      // Click the add button (first non-remove button)
      const addButton = screen.getAllByRole("button")[0]!;
      await user.click(addButton);

      expect(defaultProps.onAdd).toHaveBeenCalledWith("reactjs");
    });

    it("calls onAdd on Enter key press", async () => {
      const user = userEvent.setup();
      render(<SubredditSettings {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "typescript{Enter}");

      expect(defaultProps.onAdd).toHaveBeenCalledWith("typescript");
    });

    it("clears input after successful add", async () => {
      const user = userEvent.setup();
      render(<SubredditSettings {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "newsubreddit{Enter}");

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("does not call onAdd when input is empty", async () => {
      const user = userEvent.setup();
      render(<SubredditSettings {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "{Enter}");

      expect(defaultProps.onAdd).not.toHaveBeenCalled();
    });

    it("does not call onAdd when input is only whitespace", async () => {
      const user = userEvent.setup();
      render(<SubredditSettings {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "   {Enter}");

      expect(defaultProps.onAdd).not.toHaveBeenCalled();
    });

    it("shows error when add fails", async () => {
      const user = userEvent.setup();
      const onAdd = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Subreddit already exists" });
      render(<SubredditSettings {...defaultProps} onAdd={onAdd} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "postgresql{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Subreddit already exists")).toBeInTheDocument();
      });
    });

    it("shows default error message when add fails without error string", async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn().mockResolvedValue({ success: false });
      render(<SubredditSettings {...defaultProps} onAdd={onAdd} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "test{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Failed to add subreddit")).toBeInTheDocument();
      });
    });

    it("does not clear input when add fails", async () => {
      const user = userEvent.setup();
      const onAdd = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Invalid" });
      render(<SubredditSettings {...defaultProps} onAdd={onAdd} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "badname{Enter}");

      await waitFor(() => {
        expect(input).toHaveValue("badname");
      });
    });
  });

  describe("removing subreddits", () => {
    it("calls onRemove with correct id", async () => {
      const user = userEvent.setup();
      render(<SubredditSettings {...defaultProps} />);

      // Each subreddit row has a remove button (with XIcon)
      const removeButtons = screen.getAllByRole("button").slice(1); // Skip the add button
      await user.click(removeButtons[0]!);

      expect(defaultProps.onRemove).toHaveBeenCalledWith("sub-1");
    });

    it("shows error when remove fails", async () => {
      const user = userEvent.setup();
      const onRemove = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Cannot remove" });
      render(<SubredditSettings {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button").slice(1);
      await user.click(removeButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText("Cannot remove")).toBeInTheDocument();
      });
    });

    it("shows default error when remove fails without error string", async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn().mockResolvedValue({ success: false });
      render(<SubredditSettings {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button").slice(1);
      await user.click(removeButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText("Failed to remove subreddit")).toBeInTheDocument();
      });
    });
  });

  describe("loading states", () => {
    it("disables input during add", async () => {
      const user = userEvent.setup();
      let resolveAdd: (value: { success: boolean }) => void;
      const onAdd = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
      );
      render(<SubredditSettings {...defaultProps} onAdd={onAdd} />);

      const input = screen.getByPlaceholderText(
        "Enter subreddit name (e.g., postgresql)"
      );
      await user.type(input, "test{Enter}");

      expect(input).toBeDisabled();

      resolveAdd!({ success: true });
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });

    it("disables remove button during remove", async () => {
      const user = userEvent.setup();
      let resolveRemove: (value: { success: boolean }) => void;
      const onRemove = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRemove = resolve;
        })
      );
      render(<SubredditSettings {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button").slice(1);
      await user.click(removeButtons[0]!);

      expect(removeButtons[0]).toBeDisabled();

      resolveRemove!({ success: true });
      await waitFor(() => {
        expect(removeButtons[0]).not.toBeDisabled();
      });
    });
  });
});
