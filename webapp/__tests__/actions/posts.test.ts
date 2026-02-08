/**
 * Unit tests for post server actions.
 *
 * These tests verify that post actions correctly work with the three-table model:
 * - posts (global, shared across users, deduplicated by reddit_id)
 * - user_posts (per-user state: status, response_text, responded_at)
 * - user_post_tags (per-user tag associations)
 *
 * Tests cover:
 * - List posts with status and tag filtering, pagination, and ordering
 * - Get single post with tags
 * - Change post status with response text handling
 * - Update response text without changing status
 * - Fetch new posts from Reddit with global deduplication and per-user state
 *
 * Uses mocked database and Reddit client to isolate unit tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database before importing actions
const mockUserPostsFindMany = vi.fn();
const mockUserPostsFindFirst = vi.fn();
const mockPostsFindFirst = vi.fn();
const mockSubredditsFindMany = vi.fn();
const mockTagsFindMany = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();

// These need to be callable functions that return Promises
// so tests can configure them with mockResolvedValue
const mockCountResult = vi.fn();
const mockGroupByResult = vi.fn();
const mockSelectDistinctResult = vi.fn();
const mockPaginatedSelectResult = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      userPosts: {
        findMany: (...args: unknown[]) => mockUserPostsFindMany(...args),
        findFirst: (...args: unknown[]) => mockUserPostsFindFirst(...args),
      },
      posts: {
        findFirst: (...args: unknown[]) => mockPostsFindFirst(...args),
      },
      subreddits: {
        findMany: (...args: unknown[]) => mockSubredditsFindMany(...args),
      },
      tags: {
        findMany: (...args: unknown[]) => mockTagsFindMany(...args),
      },
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...valArgs: unknown[]) => {
          mockValues(...valArgs);
          return {
            returning: () => mockReturning(),
            onConflictDoNothing: () => ({
              returning: () => mockReturning(),
            }),
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...setArgs: unknown[]) => {
          mockSet(...setArgs);
          return {
            where: () => ({
              returning: () => mockReturning(),
            }),
          };
        },
      };
    },
    select: () => ({
      from: () => ({
        where: () => {
          // Return a thenable that also has .groupBy()
          const promise = mockCountResult();
          (promise as Promise<unknown[]> & { groupBy: () => Promise<unknown[]> }).groupBy = () => mockGroupByResult();
          return promise;
        },
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => mockPaginatedSelectResult(),
              }),
            }),
          }),
        }),
      }),
    }),
    selectDistinct: () => ({
      from: () => ({
        where: () => mockSelectDistinctResult(),
      }),
    }),
  },
}));

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock users action to return consistent user ID
vi.mock("@/app/actions/users", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("test-user-uuid-1234"),
}));

// User ID constant for use in tests
const MOCK_USER_ID = "test-user-uuid-1234";

// Mock Reddit client (Arctic Shift — no configuration/auth required)
const mockFetchRedditPosts = vi.fn();
vi.mock("@/lib/reddit", () => ({
  fetchRedditPosts: (...args: unknown[]) => mockFetchRedditPosts(...args),
}));

// Import after mocks are set up
import {
  listPosts,
  getPost,
  changePostStatus,
  updateResponseText,
  getPostCounts,
  getLastPostTimestampPerSubreddit,
  fetchNewPosts,
  fetchPostsForAllUsers,
  upsertComments,
} from "@/app/actions/posts";

// Helper to create a mock post (global, shared)
const createMockPost = (overrides: Partial<{
  id: string;
  redditId: string;
  title: string;
  body: string | null;
  author: string;
  subreddit: string;
  permalink: string;
  url: string | null;
  redditCreatedAt: Date;
  score: number;
  numComments: number;
  isNsfw: boolean;
  createdAt: Date;
}> = {}) => ({
  id: "post-1",
  redditId: "abc123",
  title: "Test Post",
  body: "Test body content",
  author: "test_author",
  subreddit: "postgresql",
  permalink: "/r/postgresql/comments/abc123/test_post/",
  url: null,
  redditCreatedAt: new Date("2024-01-15T10:00:00Z"),
  score: 42,
  numComments: 10,
  isNsfw: false,
  createdAt: new Date("2024-01-15T10:05:00Z"),
  ...overrides,
});

// Helper to create a mock user_post (per-user state joined with post)
const createMockUserPost = (overrides: Partial<{
  userId: string;
  postId: string;
  status: string;
  responseText: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  post: ReturnType<typeof createMockPost>;
  userPostTags: Array<{ userId: string; postId: string; tagId: string; tag: { id: string; name: string; color: string } }>;
}> = {}) => ({
  userId: MOCK_USER_ID,
  postId: "post-1",
  status: "new",
  responseText: null,
  respondedAt: null,
  createdAt: new Date("2024-01-15T10:05:00Z"),
  updatedAt: new Date("2024-01-15T10:05:00Z"),
  post: createMockPost(),
  userPostTags: [],
  ...overrides,
});

describe("post server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listPosts", () => {
    it("returns empty result when no posts match", async () => {
      mockCountResult.mockResolvedValue([{ count: 0 }]);
      mockPaginatedSelectResult.mockResolvedValue([]);
      mockUserPostsFindMany.mockResolvedValue([]);

      const result = await listPosts("new");

      expect(result).toEqual({
        posts: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it("returns posts filtered by status from user_posts", async () => {
      const mockResults = [
        createMockUserPost({ postId: "post-1", status: "new" }),
        createMockUserPost({ postId: "post-2", status: "new", post: createMockPost({ id: "post-2" }) }),
      ];
      mockCountResult.mockResolvedValue([{ count: 2 }]);
      mockPaginatedSelectResult.mockResolvedValue([
        { postId: "post-1", redditCreatedAt: new Date("2024-01-15T10:00:00Z") },
        { postId: "post-2", redditCreatedAt: new Date("2024-01-15T09:00:00Z") },
      ]);
      mockUserPostsFindMany.mockResolvedValue(mockResults);

      const result = await listPosts("new");

      expect(result.posts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockUserPostsFindMany).toHaveBeenCalledOnce();
    });

    it("returns posts with tag data from user_post_tags", async () => {
      const mockResults = [
        createMockUserPost({
          postId: "post-1",
          userPostTags: [
            {
              userId: MOCK_USER_ID,
              postId: "post-1",
              tagId: "tag-1",
              tag: { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
            },
            {
              userId: MOCK_USER_ID,
              postId: "post-1",
              tagId: "tag-2",
              tag: { id: "tag-2", name: "PostgreSQL", color: "#10b981" },
            },
          ],
        }),
      ];
      mockCountResult.mockResolvedValue([{ count: 1 }]);
      mockPaginatedSelectResult.mockResolvedValue([
        { postId: "post-1", redditCreatedAt: new Date("2024-01-15T10:00:00Z") },
      ]);
      mockUserPostsFindMany.mockResolvedValue(mockResults);

      const result = await listPosts("new");

      expect(result.posts[0]?.tags).toHaveLength(2);
      expect(result.posts[0]?.tags).toEqual([
        { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
        { id: "tag-2", name: "PostgreSQL", color: "#10b981" },
      ]);
    });

    it("handles pagination correctly", async () => {
      mockCountResult.mockResolvedValue([{ count: 50 }]);
      mockPaginatedSelectResult.mockResolvedValue([
        { postId: "post-1", redditCreatedAt: new Date("2024-01-15T10:00:00Z") },
      ]);
      mockUserPostsFindMany.mockResolvedValue([createMockUserPost()]);

      const result = await listPosts("new", undefined, 2, 10);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(5);
    });

    it("orders posts by Reddit creation time descending (newest first)", async () => {
      // Posts have different redditCreatedAt and createdAt to verify correct ordering
      const olderRedditPost = createMockPost({
        id: "post-old",
        redditCreatedAt: new Date("2024-01-10T10:00:00Z"),
        createdAt: new Date("2024-01-15T10:00:00Z"), // added to DB later
      });
      const newerRedditPost = createMockPost({
        id: "post-new",
        redditCreatedAt: new Date("2024-01-14T10:00:00Z"),
        createdAt: new Date("2024-01-14T10:00:00Z"), // added to DB earlier
      });

      mockCountResult.mockResolvedValue([{ count: 2 }]);
      // Paginated select returns posts ordered by redditCreatedAt desc
      mockPaginatedSelectResult.mockResolvedValue([
        { postId: "post-new", redditCreatedAt: newerRedditPost.redditCreatedAt },
        { postId: "post-old", redditCreatedAt: olderRedditPost.redditCreatedAt },
      ]);
      // findMany returns in arbitrary order; implementation re-sorts by paginated order
      mockUserPostsFindMany.mockResolvedValue([
        createMockUserPost({ postId: "post-old", post: olderRedditPost }),
        createMockUserPost({ postId: "post-new", post: newerRedditPost }),
      ]);

      const result = await listPosts("new");

      expect(result.posts).toHaveLength(2);
      // Newest Reddit post should appear first
      expect(result.posts[0]?.id).toBe("post-new");
      expect(result.posts[1]?.id).toBe("post-old");
    });

    it("returns empty when tag filter matches no posts", async () => {
      mockSelectDistinctResult.mockResolvedValue([]);

      const result = await listPosts("new", ["nonexistent-tag-id"]);

      expect(result).toEqual({
        posts: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it("accepts 'untagged' sentinel to filter untagged posts", async () => {
      // First call: get posts with any tag (returns post-1)
      // Second call: get untagged user_posts (returns post-2 which has no tags)
      mockSelectDistinctResult
        .mockResolvedValueOnce([{ postId: "post-1" }]) // posts with any tag
        .mockResolvedValueOnce([{ postId: "post-2" }]); // untagged user_posts

      mockCountResult.mockResolvedValue([{ count: 1 }]);
      mockPaginatedSelectResult.mockResolvedValue([
        { postId: "post-2", redditCreatedAt: new Date("2024-01-15T10:00:00Z") },
      ]);
      mockUserPostsFindMany.mockResolvedValue([
        createMockUserPost({
          postId: "post-2",
          post: createMockPost({ id: "post-2" }),
        }),
      ]);

      const result = await listPosts("new", ["untagged"]);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]?.id).toBe("post-2");
    });

    it("combines 'untagged' with specific tags (union)", async () => {
      // First call for realTagIds: get posts with tag-1 (returns post-1)
      // Second call: get posts with any tag (returns post-1)
      // Third call: get untagged user_posts (returns post-2)
      mockSelectDistinctResult
        .mockResolvedValueOnce([{ postId: "post-1" }]) // posts with tag-1
        .mockResolvedValueOnce([{ postId: "post-1" }]) // all tagged posts
        .mockResolvedValueOnce([{ postId: "post-2" }]); // untagged user_posts

      mockCountResult.mockResolvedValue([{ count: 2 }]);
      mockPaginatedSelectResult.mockResolvedValue([
        { postId: "post-1", redditCreatedAt: new Date("2024-01-15T10:00:00Z") },
        { postId: "post-2", redditCreatedAt: new Date("2024-01-15T09:00:00Z") },
      ]);
      mockUserPostsFindMany.mockResolvedValue([
        createMockUserPost({
          postId: "post-1",
          post: createMockPost({ id: "post-1" }),
          userPostTags: [
            { userId: MOCK_USER_ID, postId: "post-1", tagId: "tag-1", tag: { id: "tag-1", name: "Test", color: "#6366f1" } },
          ],
        }),
        createMockUserPost({
          postId: "post-2",
          post: createMockPost({ id: "post-2" }),
        }),
      ]);

      const result = await listPosts("new", ["tag-1", "untagged"]);

      expect(result.posts).toHaveLength(2);
    });
  });

  describe("getPost", () => {
    it("returns error when post not found", async () => {
      mockUserPostsFindFirst.mockResolvedValue(null);

      const result = await getPost("nonexistent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Post not found");
      }
    });

    it("returns post with tags from user_post_tags", async () => {
      mockUserPostsFindFirst.mockResolvedValue(
        createMockUserPost({
          postId: "post-1",
          userPostTags: [
            {
              userId: MOCK_USER_ID,
              postId: "post-1",
              tagId: "tag-1",
              tag: { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
            },
          ],
        })
      );

      const result = await getPost("post-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.id).toBe("post-1");
        expect(result.post.tags).toEqual([
          { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
        ]);
      }
    });
  });

  describe("changePostStatus", () => {
    it("returns error when post not found", async () => {
      mockUserPostsFindFirst.mockResolvedValue(null);

      const result = await changePostStatus("nonexistent-id", "done");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Post not found");
      }
    });

    it("rejects invalid status", async () => {
      // @ts-expect-error - Testing with invalid status value
      const result = await changePostStatus("post-1", "invalid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid status");
      }
    });

    it("changes status from new to ignored on user_posts", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "ignored", responseText: null, respondedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await changePostStatus("post-1", "ignored");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("ignored");
      }
      expect(mockUpdate).toHaveBeenCalledOnce();
    });

    it("changes status from new to done on user_posts", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "done", responseText: null, respondedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await changePostStatus("post-1", "done");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("done");
      }
    });

    it("sets respondedAt when changing to done", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "done", responseText: null, respondedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);

      await changePostStatus("post-1", "done");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "done",
          respondedAt: expect.any(Date),
        })
      );
    });

    it("saves response text when provided with done status", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "done", responseText: "My response", respondedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);

      await changePostStatus("post-1", "done", "My response");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "done",
          responseText: "My response",
          respondedAt: expect.any(Date),
        })
      );
    });

    it("clears respondedAt when changing from done to new", async () => {
      mockUserPostsFindFirst.mockResolvedValue(
        createMockUserPost({
          status: "done",
          responseText: "Previous response",
          respondedAt: new Date(),
        })
      );
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "new", responseText: "Previous response", respondedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      await changePostStatus("post-1", "new");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "new",
          respondedAt: null,
        })
      );
    });

    it("keeps responseText when changing from done to new", async () => {
      const existingResponse = "This is my response text";
      mockUserPostsFindFirst.mockResolvedValue(
        createMockUserPost({
          status: "done",
          responseText: existingResponse,
          respondedAt: new Date("2024-01-15"),
        })
      );
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "new", responseText: existingResponse, respondedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await changePostStatus("post-1", "new");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.responseText).toBe(existingResponse);
        expect(result.post.respondedAt).toBeNull();
      }
    });

    it("changes status from ignored to new", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "ignored" }));
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "new", responseText: null, respondedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await changePostStatus("post-1", "new");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("new");
      }
    });

    it("changes status from done to new", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "done" }));
      mockReturning.mockResolvedValue([
        { userId: MOCK_USER_ID, postId: "post-1", status: "new", responseText: null, respondedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await changePostStatus("post-1", "new");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("new");
      }
    });
  });

  describe("updateResponseText", () => {
    it("returns error when post not found", async () => {
      mockUserPostsFindFirst.mockResolvedValue(null);

      const result = await updateResponseText("nonexistent-id", "response");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Post not found");
      }
    });

    it("updates response text on user_posts without changing status", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "done" }));

      const result = await updateResponseText("post-1", "Updated response");

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          responseText: "Updated response",
        })
      );
    });

    it("sets respondedAt when updating response on done user_post", async () => {
      mockUserPostsFindFirst.mockResolvedValue(createMockUserPost({ status: "done" }));

      await updateResponseText("post-1", "Updated response");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          responseText: "Updated response",
          respondedAt: expect.any(Date),
        })
      );
    });

    it("preserves respondedAt when updating response on non-done user_post", async () => {
      const existingRespondedAt = new Date("2024-01-15");
      mockUserPostsFindFirst.mockResolvedValue(
        createMockUserPost({
          status: "new",
          respondedAt: existingRespondedAt,
        })
      );

      await updateResponseText("post-1", "Draft response");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          responseText: "Draft response",
          respondedAt: existingRespondedAt,
        })
      );
    });
  });

  describe("getPostCounts", () => {
    it("returns counts from user_posts for all statuses", async () => {
      mockGroupByResult.mockResolvedValue([
        { status: "new", count: 10 },
        { status: "ignored", count: 5 },
        { status: "done", count: 3 },
      ]);

      const result = await getPostCounts();

      expect(result).toEqual({
        new: 10,
        ignored: 5,
        done: 3,
      });
    });

    it("returns zero for missing statuses", async () => {
      mockGroupByResult.mockResolvedValue([
        { status: "new", count: 10 },
      ]);

      const result = await getPostCounts();

      expect(result).toEqual({
        new: 10,
        ignored: 0,
        done: 0,
      });
    });
  });

  describe("getLastPostTimestampPerSubreddit", () => {
    it("returns max reddit_created_at per subreddit for given names", async () => {
      const date1 = new Date("2024-06-15T12:00:00Z");
      const date2 = new Date("2024-06-10T08:00:00Z");

      mockGroupByResult.mockResolvedValue([
        { subreddit: "postgresql", maxRedditCreatedAt: date1 },
        { subreddit: "node", maxRedditCreatedAt: date2 },
      ]);

      const result = await getLastPostTimestampPerSubreddit(["postgresql", "node"]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get("postgresql")).toEqual(date1);
      expect(result.get("node")).toEqual(date2);
    });

    it("returns empty Map when no posts exist for given subreddits", async () => {
      mockGroupByResult.mockResolvedValue([]);

      const result = await getLastPostTimestampPerSubreddit(["postgresql", "node"]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("returns empty Map when given empty subreddit list", async () => {
      const result = await getLastPostTimestampPerSubreddit([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      // Should not query DB at all
      expect(mockGroupByResult).not.toHaveBeenCalled();
    });

    it("excludes subreddits with null maxRedditCreatedAt", async () => {
      mockGroupByResult.mockResolvedValue([
        { subreddit: "postgresql", maxRedditCreatedAt: new Date("2024-06-15T12:00:00Z") },
        { subreddit: "node", maxRedditCreatedAt: null },
      ]);

      const result = await getLastPostTimestampPerSubreddit(["postgresql", "node"]);

      expect(result.size).toBe(1);
      expect(result.has("postgresql")).toBe(true);
      expect(result.has("node")).toBe(false);
    });
  });

  describe("fetchNewPosts", () => {
    it("returns message when no subreddits configured", async () => {
      mockSubredditsFindMany.mockResolvedValue([]);

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(0);
        expect(result.message).toContain("No subreddits configured");
      }
    });

    it("returns zero new posts when no search terms configured", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockTagsFindMany.mockResolvedValue([]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockFetchRedditPosts.mockResolvedValue([]);

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(0);
        expect(result.message).toContain("0 new posts");
      }
    });

    it("stores posts globally and creates user_posts for matches", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "new-post-123",
          title: "YugabyteDB is great for distributed SQL",
          body: "I've been using yugabyte for a while...",
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/new-post-123/",
          url: null,
          redditCreatedAt: new Date(),
          score: 10,
          numComments: 5,
        },
      ]);
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "new-db-post-id", redditId: "new-post-123" }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "new-db-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(1);
        expect(result.message).toBe("Found 1 new post.");
      }
      // fetchRedditPosts now receives a Map<string, number> (subreddit → after-timestamp)
      const calledWith = mockFetchRedditPosts.mock.calls[0]![0] as Map<string, number>;
      expect(calledWith).toBeInstanceOf(Map);
      expect([...calledWith.keys()]).toEqual(["postgresql"]);
      // No existing posts — timestamp should be roughly 7 days ago (initial backfill)
      const ts = calledWith.get("postgresql")!;
      const expectedTs = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      expect(Math.abs(ts - expectedTs)).toBeLessThan(5);
    });

    it("handles global deduplication — looks up existing post on conflict", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "existing-post-id",
          title: "Existing yugabyte post",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/existing/",
          url: null,
          redditCreatedAt: new Date(),
          score: 10,
          numComments: 5,
        },
      ]);
      mockReturning.mockImplementation(() => {
        return Promise.resolve([]);
      });
      mockPostsFindFirst.mockResolvedValue({ id: "existing-db-post-id", redditId: "existing-post-id" });

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(0);
        expect(result.message).toBe("Found 0 new posts.");
      }
    });

    it("creates user_post_tags for each matched tag", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          ],
        },
        {
          id: "tag-2",
          name: "PostgreSQL",
          color: "#10b981",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-2", term: "postgres", tagId: "tag-2", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "multi-tag-post",
          title: "Using Yugabyte with Postgres compatibility",
          body: "Great distributed postgres solution",
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/multi/",
          url: null,
          redditCreatedAt: new Date(),
          score: 100,
          numComments: 50,
        },
      ]);
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "new-db-post-id", redditId: "multi-tag-post" }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "new-db-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      await fetchNewPosts();

      // mockInsert called for: posts table, user_posts, user_post_tags x2
      expect(mockInsert).toHaveBeenCalledTimes(4);
    });

    it("creates user_posts with status 'new'", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "test", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "new-post",
          title: "Test post",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/new/",
          url: null,
          redditCreatedAt: new Date(),
          score: 1,
          numComments: 0,
        },
      ]);
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "new-db-id", redditId: "new-post" }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "new-db-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      await fetchNewPosts();

      // Second values() call is for user_posts with status "new"
      const valuesCallArgs = mockValues.mock.calls;
      expect(valuesCallArgs[1]?.[0]).toEqual(
        expect.objectContaining({
          status: "new",
          userId: MOCK_USER_ID,
        })
      );
    });

    it("returns singular message for 1 new post", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "test", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "one-post",
          title: "One test post",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/one/",
          url: null,
          redditCreatedAt: new Date(),
          score: 1,
          numComments: 0,
        },
      ]);
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "db-id", redditId: "one-post" }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "db-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(1);
        expect(result.message).toBe("Found 1 new post.");
      }
    });

    it("returns plural message for multiple new posts", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "test", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "post-1",
          title: "First test post",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/1/",
          url: null,
          redditCreatedAt: new Date(),
          score: 1,
          numComments: 0,
        },
        {
          redditId: "post-2",
          title: "Second test post",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/2/",
          url: null,
          redditCreatedAt: new Date(),
          score: 1,
          numComments: 0,
        },
      ]);
      let callCount = 0;
      mockReturning.mockImplementation(() => {
        callCount++;
        // For each fetched post: insert posts, insert user_posts, insert user_post_tags
        if (callCount === 1) {
          return Promise.resolve([{ id: "db-id-1", redditId: "post-1" }]);
        }
        if (callCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "db-id-1", status: "new" }]);
        }
        if (callCount === 4) {
          return Promise.resolve([{ id: "db-id-2", redditId: "post-2" }]);
        }
        if (callCount === 5) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "db-id-2", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
        expect(result.message).toBe("Found 2 new posts.");
      }
    });

    it("stores ALL fetched posts in global posts table regardless of match", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "matching-post",
          title: "Yugabyte discussion",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/matching/",
          url: null,
          redditCreatedAt: new Date(),
          score: 10,
          numComments: 5,
        },
        {
          redditId: "non-matching-post",
          title: "Unrelated topic",
          body: "Nothing about our terms",
          author: "other",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/other/",
          url: null,
          redditCreatedAt: new Date(),
          score: 3,
          numComments: 1,
        },
      ]);
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "db-id-1", redditId: "matching-post" }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "db-id-1", status: "new" }]);
        }
        if (insertCallCount === 4) {
          return Promise.resolve([{ id: "db-id-2", redditId: "non-matching-post" }]);
        }
        return Promise.resolve([{}]);
      });

      const result = await fetchNewPosts();

      // All posts create user_posts (count reflects new user_post records), both go into global posts table
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
      }
      // Both posts inserted into global posts table
      // Order: matching post insert [0], user_posts insert [1], user_post_tags insert [2], non-matching post insert [3], user_posts insert [4]
      const valuesCallArgs = mockValues.mock.calls;
      expect(valuesCallArgs[0]?.[0]).toEqual(
        expect.objectContaining({ redditId: "matching-post" })
      );
      expect(valuesCallArgs[3]?.[0]).toEqual(
        expect.objectContaining({ redditId: "non-matching-post" })
      );
    });

    it("two users can share the same global post with different statuses", async () => {
      // This test verifies the architectural property that global posts
      // are deduplicated while user_posts contain per-user state.
      // The deduplication happens at the DB level (onConflictDoNothing on reddit_id).
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts — 7-day backfill
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "test", tagId: "tag-1", createdAt: new Date() },
          ],
        },
      ]);
      mockFetchRedditPosts.mockResolvedValue([
        {
          redditId: "shared-post",
          title: "Test shared post",
          body: null,
          author: "poster",
          subreddit: "postgresql",
          permalink: "/r/postgresql/comments/shared/",
          url: null,
          redditCreatedAt: new Date(),
          score: 10,
          numComments: 5,
        },
      ]);
      // Post already exists globally (conflict), but user_post is new
      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // posts table: conflict, returns empty
          return Promise.resolve([]);
        }
        if (insertCallCount === 2) {
          // user_posts: new for this user
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "existing-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });
      // Lookup existing post
      mockPostsFindFirst.mockResolvedValue({ id: "existing-post-id", redditId: "shared-post" });

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(1);
      }
    });

    it("uses DB timestamp for subreddits with existing posts and 7-day backfill for new subreddits", async () => {
      const existingTimestamp = new Date("2026-02-05T12:00:00Z");
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
        { id: "sub-2", name: "node", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      // postgresql has existing posts, node does not
      mockGroupByResult.mockResolvedValue([
        { subreddit: "postgresql", maxRedditCreatedAt: existingTimestamp },
      ]);
      mockTagsFindMany.mockResolvedValue([]);
      mockFetchRedditPosts.mockResolvedValue([]);

      await fetchNewPosts();

      const calledWith = mockFetchRedditPosts.mock.calls[0]![0] as Map<string, number>;
      expect(calledWith).toBeInstanceOf(Map);
      expect(calledWith.size).toBe(2);

      // postgresql should use DB timestamp (converted to Unix seconds)
      const pgTs = calledWith.get("postgresql")!;
      expect(pgTs).toBe(Math.floor(existingTimestamp.getTime() / 1000));

      // node has no existing posts — should use 7-day backfill
      const nodeTs = calledWith.get("node")!;
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      expect(Math.abs(nodeTs - sevenDaysAgo)).toBeLessThan(5);
    });

    it("uses 7-day backfill for all subreddits when DB has no posts", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
        { id: "sub-2", name: "node", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockGroupByResult.mockResolvedValue([]); // no existing posts
      mockTagsFindMany.mockResolvedValue([]);
      mockFetchRedditPosts.mockResolvedValue([]);

      await fetchNewPosts();

      const calledWith = mockFetchRedditPosts.mock.calls[0]![0] as Map<string, number>;
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

      for (const [, ts] of calledWith) {
        expect(Math.abs(ts - sevenDaysAgo)).toBeLessThan(5);
      }
    });
  });

  describe("fetchPostsForAllUsers", () => {
    const MOCK_USER_ID_2 = "test-user-uuid-5678";

    // Helper to create a mock FetchedPost (as returned by Arctic Shift)
    const createFetchedPost = (overrides: Partial<{
      redditId: string;
      title: string;
      body: string | null;
      author: string;
      subreddit: string;
      permalink: string;
      url: string | null;
      redditCreatedAt: Date;
      score: number;
      numComments: number;
      isNsfw: boolean;
    }> = {}) => ({
      redditId: "t3_abc123",
      title: "Test Post",
      body: "Test body content",
      author: "test_author",
      subreddit: "postgresql",
      permalink: "/r/postgresql/comments/abc123/test_post/",
      url: null,
      redditCreatedAt: new Date("2024-01-15T10:00:00Z"),
      score: 42,
      numComments: 10,
      isSelf: true,
      isNsfw: false,
      ...overrides,
    });

    it("returns zero when given empty posts array", async () => {
      const result = await fetchPostsForAllUsers("postgresql", []);
      expect(result).toEqual({ newUserPostCount: 0 });
    });

    it("returns zero when subreddit has no subscribers", async () => {
      // db.select().from(subreddits).where() — returns no subscribers
      mockCountResult.mockResolvedValue([]);

      const result = await fetchPostsForAllUsers("postgresql", [createFetchedPost()]);
      expect(result).toEqual({ newUserPostCount: 0 });
    });

    it("creates user_posts for both subscribers of the same subreddit", async () => {
      // Two users subscribe to "postgresql"
      mockCountResult.mockResolvedValue([
        { userId: MOCK_USER_ID },
        { userId: MOCK_USER_ID_2 },
      ]);

      // Both users have tags with search terms
      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          ],
        },
        {
          id: "tag-2",
          name: "DB",
          color: "#10b981",
          userId: MOCK_USER_ID_2,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-2", term: "database", tagId: "tag-2", createdAt: new Date() },
          ],
        },
      ]);

      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // Global post insert
          return Promise.resolve([{ id: "new-db-post-id", redditId: "t3_abc123" }]);
        }
        if (insertCallCount === 2) {
          // user_posts for user 1
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "new-db-post-id", status: "new" }]);
        }
        if (insertCallCount === 3) {
          // user_post_tags for user 1 (yugabyte matched)
          return Promise.resolve([{}]);
        }
        if (insertCallCount === 4) {
          // user_posts for user 2
          return Promise.resolve([{ userId: MOCK_USER_ID_2, postId: "new-db-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      const result = await fetchPostsForAllUsers("postgresql", [
        createFetchedPost({
          title: "Yugabyte database discussion",
          body: "Great distributed database",
        }),
      ]);

      expect(result.newUserPostCount).toBe(2);
      // Global post insert + user_posts for user1 + user_post_tags for user1 (yugabyte match)
      // + user_posts for user2 + user_post_tags for user2 (database match)
      expect(mockInsert).toHaveBeenCalledTimes(5);
    });

    it("creates user_post_tags only for matching search terms per user", async () => {
      // One subscriber with a tag that matches, one with a tag that doesn't
      mockCountResult.mockResolvedValue([
        { userId: MOCK_USER_ID },
        { userId: MOCK_USER_ID_2 },
      ]);

      mockTagsFindMany.mockResolvedValue([
        {
          id: "tag-1",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          ],
        },
        {
          id: "tag-2",
          name: "Redis",
          color: "#10b981",
          userId: MOCK_USER_ID_2,
          createdAt: new Date(),
          searchTerms: [
            { id: "term-2", term: "redis", tagId: "tag-2", createdAt: new Date() },
          ],
        },
      ]);

      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "new-db-post-id", redditId: "t3_abc123" }]);
        }
        if (insertCallCount === 2) {
          // user_posts for user 1
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "new-db-post-id", status: "new" }]);
        }
        if (insertCallCount === 3) {
          // user_post_tags for user 1 (yugabyte match) — this is an onConflictDoNothing chain
          return Promise.resolve([{}]);
        }
        if (insertCallCount === 4) {
          // user_posts for user 2
          return Promise.resolve([{ userId: MOCK_USER_ID_2, postId: "new-db-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      await fetchPostsForAllUsers("postgresql", [
        createFetchedPost({
          title: "Yugabyte is great",
          body: "No mention of the other thing",
        }),
      ]);

      // Insert calls: global post + user_posts(user1) + user_post_tags(user1, yugabyte match)
      //             + user_posts(user2) = 4 total
      // User 2's "redis" tag should NOT match "Yugabyte is great"
      expect(mockInsert).toHaveBeenCalledTimes(4);
    });

    it("handles global deduplication — looks up existing post on conflict", async () => {
      mockCountResult.mockResolvedValue([
        { userId: MOCK_USER_ID },
      ]);

      mockTagsFindMany.mockResolvedValue([]);

      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // Global post conflict — returns empty (post already exists)
          return Promise.resolve([]);
        }
        if (insertCallCount === 2) {
          // user_posts for user 1
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "existing-db-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      mockPostsFindFirst.mockResolvedValue({ id: "existing-db-post-id", redditId: "t3_abc123" });

      const result = await fetchPostsForAllUsers("postgresql", [createFetchedPost()]);

      expect(result.newUserPostCount).toBe(1);
      expect(mockPostsFindFirst).toHaveBeenCalled();
    });

    it("stores isNsfw from fetched post into global posts table", async () => {
      mockCountResult.mockResolvedValue([
        { userId: MOCK_USER_ID },
      ]);

      mockTagsFindMany.mockResolvedValue([]);

      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "new-db-post-id", redditId: "t3_nsfw123" }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{ userId: MOCK_USER_ID, postId: "new-db-post-id", status: "new" }]);
        }
        return Promise.resolve([{}]);
      });

      await fetchPostsForAllUsers("postgresql", [
        createFetchedPost({ redditId: "t3_nsfw123", isNsfw: true }),
      ]);

      // First mockValues call is the global post insert — verify isNsfw is included
      const firstInsertValues = mockValues.mock.calls[0]![0];
      expect(firstInsertValues.isNsfw).toBe(true);
    });

    it("does not create duplicate user_posts if already linked", async () => {
      mockCountResult.mockResolvedValue([
        { userId: MOCK_USER_ID },
      ]);

      mockTagsFindMany.mockResolvedValue([]);

      let insertCallCount = 0;
      mockReturning.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{ id: "new-db-post-id", redditId: "t3_abc123" }]);
        }
        if (insertCallCount === 2) {
          // user_posts conflict — already exists, returns empty
          return Promise.resolve([]);
        }
        return Promise.resolve([{}]);
      });

      const result = await fetchPostsForAllUsers("postgresql", [createFetchedPost()]);

      // No new user_posts created (conflict)
      expect(result.newUserPostCount).toBe(0);
    });
  });
});

describe("upsertComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero count for empty comments array", async () => {
    const result = await upsertComments([]);
    expect(result.upsertedCount).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts comments into the database", async () => {
    mockReturning.mockResolvedValue([{ id: "db-comment-1" }]);

    const result = await upsertComments([
      {
        redditId: "t1_abc",
        postRedditId: "t3_post1",
        parentRedditId: null,
        author: "user1",
        body: "Great post!",
        score: 10,
        redditCreatedAt: new Date(),
      },
    ]);

    expect(result.upsertedCount).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        redditId: "t1_abc",
        postRedditId: "t3_post1",
        author: "user1",
        body: "Great post!",
      })
    );
  });

  it("handles deduplication via onConflictDoNothing", async () => {
    // First insert succeeds, second conflicts (returns empty)
    mockReturning
      .mockResolvedValueOnce([{ id: "db-comment-1" }])
      .mockResolvedValueOnce([]);

    const comments = [
      {
        redditId: "t1_abc",
        postRedditId: "t3_post1",
        parentRedditId: null,
        author: "user1",
        body: "First comment",
        score: 10,
        redditCreatedAt: new Date(),
      },
      {
        redditId: "t1_def",
        postRedditId: "t3_post1",
        parentRedditId: "t1_abc",
        author: "user2",
        body: "Second comment (duplicate)",
        score: 5,
        redditCreatedAt: new Date(),
      },
    ];

    const result = await upsertComments(comments);

    expect(result.upsertedCount).toBe(1); // Only 1 actually inserted
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
