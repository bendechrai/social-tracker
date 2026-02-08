/**
 * Unit tests for the PostList component.
 *
 * Verifies that the post list correctly:
 * - Renders skeleton loading state (3 skeletons)
 * - Shows empty state with customizable message
 * - Renders PostCard for each post
 * - Passes status change and response callbacks through to PostCard
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostList } from "@/components/post-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makePost(id: string, title: string) {
  return {
    id,
    title,
    body: "Post body",
    author: "testuser",
    subreddit: "reactjs",
    permalink: `/r/reactjs/comments/${id}/`,
    redditCreatedAt: new Date(Date.now() - 3600 * 1000),
    score: 10,
    numComments: 5,
    isNsfw: false,
    status: "new" as const,
    responseText: null,
    respondedAt: null,
    tags: [],
  };
}

describe("PostList component", () => {
  const defaultProps = {
    posts: [] as ReturnType<typeof makePost>[],
    showNsfw: false,
    onStatusChange: vi.fn(),
    onResponseUpdate: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders skeleton placeholders when loading", () => {
      const { container } = render(
        <PostList {...defaultProps} isLoading={true} />
      );
      // PostSkeleton renders Card elements with Skeleton children
      const skeletons = container.querySelectorAll("[data-slot='card']");
      expect(skeletons.length).toBe(3);
    });

    it("does not render posts when loading", () => {
      render(
        <PostList
          {...defaultProps}
          isLoading={true}
          posts={[makePost("1", "Should not appear")]}
        />
      );
      expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows default empty message when no posts", () => {
      render(<PostList {...defaultProps} posts={[]} />);
      expect(screen.getByText("No posts found")).toBeInTheDocument();
    });

    it("shows custom empty message", () => {
      render(
        <PostList
          {...defaultProps}
          posts={[]}
          emptyMessage="No new posts to review"
        />
      );
      expect(screen.getByText("No new posts to review")).toBeInTheDocument();
    });
  });

  describe("rendering posts", () => {
    it("renders a PostCard for each post", () => {
      const posts = [
        makePost("1", "First Post"),
        makePost("2", "Second Post"),
        makePost("3", "Third Post"),
      ];
      render(<PostList {...defaultProps} posts={posts} />);

      expect(screen.getByText("First Post")).toBeInTheDocument();
      expect(screen.getByText("Second Post")).toBeInTheDocument();
      expect(screen.getByText("Third Post")).toBeInTheDocument();
    });
  });

  describe("callbacks", () => {
    it("calls onStatusChange with post id when status changes", async () => {
      const user = userEvent.setup();
      const posts = [makePost("post-42", "Test Post")];
      render(<PostList {...defaultProps} posts={posts} />);

      // Click Ignore button on the post card
      await user.click(screen.getByText("Ignore"));

      expect(defaultProps.onStatusChange).toHaveBeenCalledWith(
        "post-42",
        "ignored",
        undefined
      );
    });
  });
});
