/**
 * Unit tests for the PostCard component.
 *
 * Verifies that post cards correctly:
 * - Display post title, author, subreddit, score, and comments
 * - Link to the post detail page
 * - Show status-appropriate action buttons
 * - Render tags using TagBadge
 * - Truncate long body text
 * - Show response notes for "done" posts
 * - Handle status changes via callback
 * - Blur NSFW content when show_nsfw is off
 * - Show NSFW badge on NSFW posts
 * - Reveal NSFW content on click
 * - Navigate to detail page on card click
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostCard } from "@/components/post-card";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makePost(overrides: Partial<Parameters<typeof PostCard>[0]["post"]> = {}) {
  return {
    id: "post-1",
    title: "Test Post Title",
    body: "This is the body of the test post.",
    author: "testuser",
    subreddit: "reactjs",
    permalink: "/r/reactjs/comments/abc123/test_post/",
    redditCreatedAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
    score: 42,
    numComments: 15,
    isNsfw: false,
    status: "new" as const,
    responseText: null,
    respondedAt: null,
    tags: [],
    ...overrides,
  };
}

describe("PostCard component", () => {
  const defaultProps = {
    post: makePost(),
    showNsfw: false,
    onStatusChange: vi.fn(),
    onResponseUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
  });

  describe("rendering", () => {
    it("renders the post title", () => {
      render(<PostCard {...defaultProps} />);
      expect(screen.getByText("Test Post Title")).toBeInTheDocument();
    });

    it("renders the post title as a link to the detail page", () => {
      render(<PostCard {...defaultProps} />);
      const link = screen.getByText("Test Post Title").closest("a");
      expect(link).toHaveAttribute("href", "/dashboard/posts/post-1");
    });

    it("renders subreddit name with r/ prefix", () => {
      render(<PostCard {...defaultProps} />);
      expect(screen.getByText("r/reactjs")).toBeInTheDocument();
    });

    it("renders author with u/ prefix", () => {
      render(<PostCard {...defaultProps} />);
      expect(screen.getByText("u/testuser")).toBeInTheDocument();
    });

    it("renders score", () => {
      render(<PostCard {...defaultProps} />);
      expect(screen.getByText("42 pts")).toBeInTheDocument();
    });

    it("renders comment count", () => {
      render(<PostCard {...defaultProps} />);
      expect(screen.getByText("15 comments")).toBeInTheDocument();
    });

    it("renders the post body", () => {
      render(<PostCard {...defaultProps} />);
      expect(
        screen.getByText("This is the body of the test post.")
      ).toBeInTheDocument();
    });

    it("does not render body section when body is null", () => {
      render(
        <PostCard {...defaultProps} post={makePost({ body: null })} />
      );
      expect(
        screen.queryByText("This is the body of the test post.")
      ).not.toBeInTheDocument();
    });

    it("truncates body text longer than 300 characters", () => {
      const longBody = "x".repeat(350);
      render(
        <PostCard {...defaultProps} post={makePost({ body: longBody })} />
      );
      const bodyText = screen.getByText(/^x+\.\.\.$/);
      // The displayed text should be 300 chars + "..."
      expect(bodyText.textContent).toHaveLength(303);
    });

    it("renders 'View on Reddit' link", () => {
      render(<PostCard {...defaultProps} />);
      const viewLink = screen.getByText("View on Reddit");
      expect(viewLink.closest("a")).toHaveAttribute(
        "href",
        "https://reddit.com/r/reactjs/comments/abc123/test_post/"
      );
    });
  });

  describe("relative time formatting", () => {
    it("shows 'just now' for very recent posts", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ redditCreatedAt: new Date() })}
        />
      );
      expect(screen.getByText("just now")).toBeInTheDocument();
    });

    it("shows minutes ago for recent posts", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({
            redditCreatedAt: new Date(Date.now() - 5 * 60 * 1000),
          })}
        />
      );
      expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    });

    it("shows singular minute", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({
            redditCreatedAt: new Date(Date.now() - 1 * 60 * 1000),
          })}
        />
      );
      expect(screen.getByText("1 minute ago")).toBeInTheDocument();
    });

    it("shows hours ago", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({
            redditCreatedAt: new Date(Date.now() - 3 * 3600 * 1000),
          })}
        />
      );
      expect(screen.getByText("3 hours ago")).toBeInTheDocument();
    });

    it("shows singular hour", () => {
      render(<PostCard {...defaultProps} />);
      // Default post is 1 hour ago
      expect(screen.getByText("1 hour ago")).toBeInTheDocument();
    });

    it("shows days ago", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({
            redditCreatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          })}
        />
      );
      expect(screen.getByText("2 days ago")).toBeInTheDocument();
    });
  });

  describe("tags", () => {
    it("renders tags when present", () => {
      const tags = [
        { id: "t1", name: "React", color: "#6366f1" },
        { id: "t2", name: "Frontend", color: "#f43f5e" },
      ];
      render(
        <PostCard {...defaultProps} post={makePost({ tags })} />
      );
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("Frontend")).toBeInTheDocument();
    });

    it("does not render tags section when no tags", () => {
      render(
        <PostCard {...defaultProps} post={makePost({ tags: [] })} />
      );
      expect(screen.queryByText("React")).not.toBeInTheDocument();
    });
  });

  describe("status actions for 'new' posts", () => {
    it("shows Ignore and Mark Done buttons", () => {
      render(
        <PostCard {...defaultProps} post={makePost({ status: "new" })} />
      );
      expect(screen.getByText("Ignore")).toBeInTheDocument();
      expect(screen.getByText("Mark Done")).toBeInTheDocument();
    });

    it("does not show Mark as New button", () => {
      render(
        <PostCard {...defaultProps} post={makePost({ status: "new" })} />
      );
      expect(screen.queryByText("Mark as New")).not.toBeInTheDocument();
    });

    it("calls onStatusChange with 'ignored' when Ignore is clicked", async () => {
      const user = userEvent.setup();
      render(<PostCard {...defaultProps} />);

      await user.click(screen.getByText("Ignore"));

      expect(defaultProps.onStatusChange).toHaveBeenCalledWith("ignored");
    });

    it("calls onStatusChange with 'done' when Mark Done is clicked", async () => {
      const user = userEvent.setup();
      render(<PostCard {...defaultProps} />);

      await user.click(screen.getByText("Mark Done"));

      expect(defaultProps.onStatusChange).toHaveBeenCalledWith("done");
    });
  });

  describe("status actions for 'ignored' posts", () => {
    it("shows Mark as New button", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "ignored" })}
        />
      );
      expect(screen.getByText("Mark as New")).toBeInTheDocument();
    });

    it("does not show Ignore or Mark Done buttons", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "ignored" })}
        />
      );
      expect(screen.queryByText("Ignore")).not.toBeInTheDocument();
      expect(screen.queryByText("Mark Done")).not.toBeInTheDocument();
    });

    it("calls onStatusChange with 'new' when Mark as New is clicked", async () => {
      const user = userEvent.setup();
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "ignored" })}
        />
      );

      await user.click(screen.getByText("Mark as New"));

      expect(defaultProps.onStatusChange).toHaveBeenCalledWith("new");
    });
  });

  describe("status actions for 'done' posts", () => {
    it("shows Mark as New button", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "done" })}
        />
      );
      expect(screen.getByText("Mark as New")).toBeInTheDocument();
    });

    it("shows response notes textarea", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "done" })}
        />
      );
      expect(screen.getByText("Response Notes")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Record your response or notes here...")
      ).toBeInTheDocument();
    });

    it("pre-fills response textarea with existing response text", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({
            status: "done",
            responseText: "Already responded",
          })}
        />
      );
      const textarea = screen.getByPlaceholderText(
        "Record your response or notes here..."
      );
      expect(textarea).toHaveValue("Already responded");
    });

    it("shows responded at timestamp when available", () => {
      const respondedAt = new Date("2026-01-15T10:30:00");
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "done", respondedAt })}
        />
      );
      expect(
        screen.getByText(/Responded at:/)
      ).toBeInTheDocument();
    });

    it("does not show responded at when null", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "done", respondedAt: null })}
        />
      );
      expect(screen.queryByText(/Responded at:/)).not.toBeInTheDocument();
    });

    it("does not show response notes for non-done posts", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "new" })}
        />
      );
      expect(screen.queryByText("Response Notes")).not.toBeInTheDocument();
    });
  });

  describe("response text auto-save", () => {
    it("calls onResponseUpdate on blur with changed text", async () => {
      const user = userEvent.setup();
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ status: "done" })}
        />
      );

      const textarea = screen.getByPlaceholderText(
        "Record your response or notes here..."
      );
      await user.type(textarea, "New response");
      fireEvent.blur(textarea);

      expect(defaultProps.onResponseUpdate).toHaveBeenCalledWith("New response");
    });
  });

  describe("NSFW content handling", () => {
    it("blurs title and body when NSFW and showNsfw is off", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: true, body: "NSFW body content" })}
          showNsfw={false}
        />
      );

      // Title should be in a span with blur class, not a link
      const title = screen.getByText("Test Post Title");
      expect(title.tagName).toBe("SPAN");
      expect(title.className).toContain("blur-sm");

      // Body should be blurred
      const body = screen.getByText("NSFW body content");
      expect(body.className).toContain("blur-sm");

      // Click to reveal should be shown
      expect(screen.getByText("Click to reveal")).toBeInTheDocument();
    });

    it("does not blur when showNsfw preference is on", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: true, body: "NSFW body content" })}
          showNsfw={true}
        />
      );

      // Title should be a link (not blurred)
      const title = screen.getByText("Test Post Title");
      expect(title.closest("a")).not.toBeNull();

      // Body should not be blurred
      const body = screen.getByText("NSFW body content");
      expect(body.className).not.toContain("blur-sm");

      // No click to reveal
      expect(screen.queryByText("Click to reveal")).not.toBeInTheDocument();
    });

    it("always shows NSFW badge on NSFW posts", () => {
      // When showNsfw is off
      const { unmount } = render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: true })}
          showNsfw={false}
        />
      );
      expect(screen.getByText("NSFW")).toBeInTheDocument();
      unmount();

      // When showNsfw is on
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: true })}
          showNsfw={true}
        />
      );
      expect(screen.getByText("NSFW")).toBeInTheDocument();
    });

    it("does not show NSFW badge on non-NSFW posts", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: false })}
        />
      );
      expect(screen.queryByText("NSFW")).not.toBeInTheDocument();
    });

    it("reveals content on click when blurred", async () => {
      const user = userEvent.setup();
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: true, body: "NSFW body content" })}
          showNsfw={false}
        />
      );

      // Initially blurred
      expect(screen.getByText("Click to reveal")).toBeInTheDocument();

      // Click to reveal
      await user.click(screen.getByRole("button", { name: /click to reveal nsfw content/i }));

      // After clicking, title should be a link
      const title = screen.getByText("Test Post Title");
      expect(title.closest("a")).not.toBeNull();

      // Body should not be blurred
      const body = screen.getByText("NSFW body content");
      expect(body.className).not.toContain("blur-sm");

      // Click to reveal should be gone
      expect(screen.queryByText("Click to reveal")).not.toBeInTheDocument();

      // Badge should still show
      expect(screen.getByText("NSFW")).toBeInTheDocument();
    });

    it("keeps metadata visible when blurred", () => {
      render(
        <PostCard
          {...defaultProps}
          post={makePost({ isNsfw: true })}
          showNsfw={false}
        />
      );

      // Metadata should be visible
      expect(screen.getByText("r/reactjs")).toBeInTheDocument();
      expect(screen.getByText("u/testuser")).toBeInTheDocument();
      expect(screen.getByText("42 pts")).toBeInTheDocument();
      expect(screen.getByText("15 comments")).toBeInTheDocument();

      // Action buttons should be visible
      expect(screen.getByText("Ignore")).toBeInTheDocument();
      expect(screen.getByText("Mark Done")).toBeInTheDocument();

      // View on Reddit should be visible
      expect(screen.getByText("View on Reddit")).toBeInTheDocument();
    });
  });

  describe("navigation to detail page", () => {
    it("navigates to detail page when card body area is clicked", async () => {
      const user = userEvent.setup();
      render(<PostCard {...defaultProps} />);

      // Click on the card's metadata area (not a button or link)
      await user.click(screen.getByText("r/reactjs"));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/posts/post-1");
    });

    it("does not navigate when clicking action buttons", async () => {
      const user = userEvent.setup();
      render(<PostCard {...defaultProps} />);

      await user.click(screen.getByText("Ignore"));

      expect(mockPush).not.toHaveBeenCalled();
      expect(defaultProps.onStatusChange).toHaveBeenCalledWith("ignored");
    });

    it("does not navigate when clicking View on Reddit link", async () => {
      const user = userEvent.setup();
      render(<PostCard {...defaultProps} />);

      await user.click(screen.getByText("View on Reddit"));

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("navigates when clicking post title link", async () => {
      const user = userEvent.setup();
      render(<PostCard {...defaultProps} />);

      await user.click(screen.getByText("Test Post Title"));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/posts/post-1");
    });
  });
});
