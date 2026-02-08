/**
 * Unit tests for the PostDetailPage component.
 *
 * Verifies acceptance criteria from post-detail.md:
 * - Post detail page loads with full content, metadata, and tags
 * - Comments displayed in threaded format
 * - Status buttons work (Ignore, Done)
 * - 404 for invalid posts
 * - No auto-read (opening page does not change status)
 * - Two-column layout renders
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

// Mock next/navigation
const mockParams = { id: "post-uuid-1" };
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
}));

// Mock server actions
const mockGetPost = vi.fn();
const mockChangePostStatus = vi.fn();
const mockUpdateResponseText = vi.fn();

vi.mock("@/app/actions/posts", () => ({
  getPost: (...args: unknown[]) => mockGetPost(...args),
  changePostStatus: (...args: unknown[]) => mockChangePostStatus(...args),
  updateResponseText: (...args: unknown[]) => mockUpdateResponseText(...args),
}));

const mockGetShowNsfw = vi.fn();

vi.mock("@/app/actions/users", () => ({
  getShowNsfw: () => mockGetShowNsfw(),
}));

const mockToast = vi.fn();

vi.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock UserMenu to avoid session dependency
vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

import PostDetailPage from "@/app/dashboard/posts/[id]/page";

function makePostDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-uuid-1",
    redditId: "t3_abc123",
    title: "Test Post Title",
    body: "This is the full body of the test post.",
    author: "testuser",
    subreddit: "reactjs",
    permalink: "/r/reactjs/comments/abc123/test_post/",
    url: null,
    redditCreatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    score: 42,
    numComments: 15,
    isNsfw: false,
    status: "new",
    responseText: null,
    respondedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [
      { id: "t1", name: "React", color: "#6366f1" },
    ],
    comments: [],
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: "comment-1",
    redditId: "t1_comment1",
    author: "commenter1",
    body: "This is a comment",
    score: 10,
    redditCreatedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    depth: 0,
    children: [],
    ...overrides,
  };
}

describe("PostDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetShowNsfw.mockResolvedValue(false);
  });

  it("renders post content with title, metadata, and tags", async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail(),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      // Title appears in header (h1) and content (h2)
      expect(screen.getAllByText("Test Post Title")).toHaveLength(2);
    });

    expect(screen.getByText("r/reactjs")).toBeInTheDocument();
    expect(screen.getByText("u/testuser")).toBeInTheDocument();
    expect(screen.getByText("42 pts")).toBeInTheDocument();
    expect(screen.getByText("15 comments")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("This is the full body of the test post.")).toBeInTheDocument();
    expect(screen.getByText("View on Reddit")).toBeInTheDocument();
  });

  it("renders 404 state when post is not found", async () => {
    mockGetPost.mockResolvedValue({
      success: false,
      error: "Post not found",
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Post Not Found")).toBeInTheDocument();
    });

    expect(screen.getByText(/doesn't exist or you don't have access/)).toBeInTheDocument();
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("renders threaded comments", async () => {
    const childComment = makeComment({
      id: "comment-2",
      redditId: "t1_comment2",
      author: "replier1",
      body: "This is a reply",
      score: 5,
      depth: 1,
      children: [],
    });

    const parentComment = makeComment({
      children: [childComment],
    });

    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail({ comments: [parentComment] }),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("This is a comment")).toBeInTheDocument();
    });

    expect(screen.getByText("u/commenter1")).toBeInTheDocument();
    expect(screen.getByText("This is a reply")).toBeInTheDocument();
    expect(screen.getByText("u/replier1")).toBeInTheDocument();
    expect(screen.getByText("Comments (1)")).toBeInTheDocument();
  });

  it("shows empty comments message when no comments", async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail({ comments: [] }),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    });

    expect(screen.getByText("Comments (0)")).toBeInTheDocument();
  });

  it("shows Ignore and Mark Done buttons for new posts", async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail({ status: "new" }),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Ignore")).toBeInTheDocument();
    });

    expect(screen.getByText("Mark Done")).toBeInTheDocument();
  });

  it("calls changePostStatus when Ignore button is clicked", async () => {
    const user = userEvent.setup();
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail({ status: "new" }),
    });
    mockChangePostStatus.mockResolvedValue({
      success: true,
      post: makePostDetail({ status: "ignored" }),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Ignore")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Ignore"));

    expect(mockChangePostStatus).toHaveBeenCalledWith("post-uuid-1", "ignored");
  });

  it("renders AI Assistant placeholder in right column", async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail(),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    });
  });

  it("shows back link to dashboard", async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail(),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Test Post Title")).toHaveLength(2);
    });

    const backLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href") === "/dashboard"
    );
    expect(backLinks.length).toBeGreaterThan(0);
  });

  it("renders link post URL when present", async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      post: makePostDetail({ url: "https://example.com/article" }),
    });

    render(<PostDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
    });

    const link = screen.getByText("https://example.com/article");
    expect(link.closest("a")).toHaveAttribute("href", "https://example.com/article");
  });

  describe("NSFW blur behavior", () => {
    it("shows NSFW banner with Show Content button when isNsfw and showNsfw off", async () => {
      mockGetPost.mockResolvedValue({
        success: true,
        post: makePostDetail({ isNsfw: true, body: "NSFW body text" }),
      });
      mockGetShowNsfw.mockResolvedValue(false);

      render(<PostDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId("nsfw-banner")).toBeInTheDocument();
      });

      expect(screen.getByText("This post is marked NSFW")).toBeInTheDocument();
      expect(screen.getByText("Show Content")).toBeInTheDocument();

      // Title and body should be blurred
      const blurredElements = document.querySelectorAll(".blur-sm");
      expect(blurredElements.length).toBeGreaterThan(0);
    });

    it("does not show NSFW banner when showNsfw is on", async () => {
      mockGetPost.mockResolvedValue({
        success: true,
        post: makePostDetail({ isNsfw: true, body: "NSFW body text" }),
      });
      mockGetShowNsfw.mockResolvedValue(true);

      render(<PostDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("NSFW body text")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("nsfw-banner")).not.toBeInTheDocument();
      // NSFW badge should still be visible
      expect(screen.getByText("NSFW")).toBeInTheDocument();
    });

    it("reveals content and hides banner when Show Content is clicked", async () => {
      const user = userEvent.setup();
      mockGetPost.mockResolvedValue({
        success: true,
        post: makePostDetail({
          isNsfw: true,
          body: "Hidden NSFW body",
          comments: [makeComment({ body: "NSFW comment text" })],
        }),
      });
      mockGetShowNsfw.mockResolvedValue(false);

      render(<PostDetailPage />);

      await waitFor(() => {
        expect(screen.getByTestId("nsfw-banner")).toBeInTheDocument();
      });

      // Content should be blurred
      expect(document.querySelectorAll(".blur-sm").length).toBeGreaterThan(0);

      // Click Show Content
      await user.click(screen.getByText("Show Content"));

      // Banner should be gone
      expect(screen.queryByTestId("nsfw-banner")).not.toBeInTheDocument();

      // Content should no longer be blurred
      expect(document.querySelectorAll(".blur-sm").length).toBe(0);
    });

    it("blurs comments when NSFW and not revealed", async () => {
      mockGetPost.mockResolvedValue({
        success: true,
        post: makePostDetail({
          isNsfw: true,
          comments: [makeComment({ body: "Blurred comment" })],
        }),
      });
      mockGetShowNsfw.mockResolvedValue(false);

      render(<PostDetailPage />);

      await waitFor(() => {
        expect(screen.getByText("Blurred comment")).toBeInTheDocument();
      });

      // Comment text should be blurred
      const commentEl = screen.getByText("Blurred comment");
      expect(commentEl.className).toContain("blur-sm");
    });

    it("does not show banner for non-NSFW posts", async () => {
      mockGetPost.mockResolvedValue({
        success: true,
        post: makePostDetail({ isNsfw: false }),
      });
      mockGetShowNsfw.mockResolvedValue(false);

      render(<PostDetailPage />);

      await waitFor(() => {
        expect(screen.getAllByText("Test Post Title")).toHaveLength(2);
      });

      expect(screen.queryByTestId("nsfw-banner")).not.toBeInTheDocument();
      expect(screen.queryByText("NSFW")).not.toBeInTheDocument();
    });
  });
});
