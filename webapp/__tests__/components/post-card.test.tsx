/**
 * Unit tests for the PostCard component.
 *
 * Verifies that post cards correctly:
 * - Display post title, author, subreddit, score, and comments
 * - Link to the Reddit post
 * - Show status-appropriate action buttons
 * - Render tags using TagBadge
 * - Truncate long body text
 * - Show response notes for "done" posts
 * - Handle status changes via callback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostCard } from "@/components/post-card";

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
    onStatusChange: vi.fn(),
    onResponseUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the post title", () => {
      render(<PostCard {...defaultProps} />);
      expect(screen.getByText("Test Post Title")).toBeInTheDocument();
    });

    it("renders the post title as a link to Reddit", () => {
      render(<PostCard {...defaultProps} />);
      const link = screen.getByText("Test Post Title").closest("a");
      expect(link).toHaveAttribute(
        "href",
        "https://reddit.com/r/reactjs/comments/abc123/test_post/"
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
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
});
