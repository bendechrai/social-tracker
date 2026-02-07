/**
 * Unit tests for post server actions.
 *
 * These tests verify that post actions correctly:
 * - List posts with status and tag filtering, pagination, and ordering
 * - Get single post with tags
 * - Change post status with response text handling
 * - Update response text without changing status
 * - Fetch new posts from Reddit with deduplication and tag matching
 *
 * Uses mocked database and Reddit client to isolate unit tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database before importing actions
const mockPostsFindMany = vi.fn();
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

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      posts: {
        findMany: (...args: unknown[]) => mockPostsFindMany(...args),
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
          // This allows both `await query` and `await query.groupBy(...)`
          const promise = mockCountResult();
          // Attach groupBy method to the promise
          (promise as Promise<unknown[]> & { groupBy: () => Promise<unknown[]> }).groupBy = () => mockGroupByResult();
          return promise;
        },
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
  fetchNewPosts,
} from "@/app/actions/posts";

// Helper to create mock post data
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
  status: string;
  responseText: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  postTags: Array<{ postId: string; tagId: string; tag: { id: string; name: string; color: string } }>;
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
  status: "new",
  responseText: null,
  respondedAt: null,
  createdAt: new Date("2024-01-15T10:05:00Z"),
  updatedAt: new Date("2024-01-15T10:05:00Z"),
  userId: MOCK_USER_ID,
  postTags: [],
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
      mockPostsFindMany.mockResolvedValue([]);
      // Mock count query
      mockCountResult.mockResolvedValue([{ count: 0 }]);

      const result = await listPosts("new");

      expect(result).toEqual({
        posts: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it("returns posts filtered by status", async () => {
      const mockPosts = [
        createMockPost({ id: "post-1", status: "new" }),
        createMockPost({ id: "post-2", status: "new" }),
      ];
      mockPostsFindMany.mockResolvedValue(mockPosts);
      mockCountResult.mockResolvedValue([{ count: 2 }]);

      const result = await listPosts("new");

      expect(result.posts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPostsFindMany).toHaveBeenCalledOnce();
    });

    it("returns posts with tag data", async () => {
      const mockPosts = [
        createMockPost({
          id: "post-1",
          postTags: [
            {
              postId: "post-1",
              tagId: "tag-1",
              tag: { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
            },
            {
              postId: "post-1",
              tagId: "tag-2",
              tag: { id: "tag-2", name: "PostgreSQL", color: "#10b981" },
            },
          ],
        }),
      ];
      mockPostsFindMany.mockResolvedValue(mockPosts);
      mockCountResult.mockResolvedValue([{ count: 1 }]);

      const result = await listPosts("new");

      expect(result.posts[0]?.tags).toHaveLength(2);
      expect(result.posts[0]?.tags).toEqual([
        { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
        { id: "tag-2", name: "PostgreSQL", color: "#10b981" },
      ]);
    });

    it("handles pagination correctly", async () => {
      mockPostsFindMany.mockResolvedValue([createMockPost()]);
      mockCountResult.mockResolvedValue([{ count: 50 }]);

      const result = await listPosts("new", undefined, 2, 10);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(5);
    });

    it("returns empty when tag filter matches no posts", async () => {
      mockSelectDistinctResult.mockResolvedValue([]); // No posts match tag filter

      const result = await listPosts("new", ["nonexistent-tag-id"]);

      expect(result).toEqual({
        posts: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });
  });

  describe("getPost", () => {
    it("returns error when post not found", async () => {
      mockPostsFindFirst.mockResolvedValue(null);

      const result = await getPost("nonexistent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Post not found");
      }
    });

    it("returns post with tags", async () => {
      mockPostsFindFirst.mockResolvedValue(
        createMockPost({
          id: "post-1",
          postTags: [
            {
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
      mockPostsFindFirst.mockResolvedValue(null);

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

    it("changes status from new to ignored", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        createMockPost({ status: "ignored", respondedAt: null }),
      ]);

      const result = await changePostStatus("post-1", "ignored");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("ignored");
      }
      expect(mockUpdate).toHaveBeenCalledOnce();
    });

    it("changes status from new to done", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        createMockPost({
          status: "done",
          respondedAt: new Date(),
        }),
      ]);

      const result = await changePostStatus("post-1", "done");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("done");
      }
    });

    it("sets respondedAt when changing to done", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        createMockPost({
          status: "done",
          respondedAt: new Date(),
        }),
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
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "new" }));
      mockReturning.mockResolvedValue([
        createMockPost({
          status: "done",
          responseText: "My response",
          respondedAt: new Date(),
        }),
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
      mockPostsFindFirst.mockResolvedValue(
        createMockPost({
          status: "done",
          responseText: "Previous response",
          respondedAt: new Date(),
        })
      );
      mockReturning.mockResolvedValue([
        createMockPost({
          status: "new",
          responseText: "Previous response", // Kept
          respondedAt: null, // Cleared
        }),
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
      mockPostsFindFirst.mockResolvedValue(
        createMockPost({
          status: "done",
          responseText: existingResponse,
          respondedAt: new Date("2024-01-15"),
        })
      );
      mockReturning.mockResolvedValue([
        createMockPost({
          status: "new",
          responseText: existingResponse,
          respondedAt: null,
        }),
      ]);

      const result = await changePostStatus("post-1", "new");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.responseText).toBe(existingResponse);
        expect(result.post.respondedAt).toBeNull();
      }
    });

    it("changes status from ignored to new", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "ignored" }));
      mockReturning.mockResolvedValue([createMockPost({ status: "new" })]);

      const result = await changePostStatus("post-1", "new");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("new");
      }
    });

    it("changes status from done to new", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "done" }));
      mockReturning.mockResolvedValue([createMockPost({ status: "new" })]);

      const result = await changePostStatus("post-1", "new");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.post.status).toBe("new");
      }
    });
  });

  describe("updateResponseText", () => {
    it("returns error when post not found", async () => {
      mockPostsFindFirst.mockResolvedValue(null);

      const result = await updateResponseText("nonexistent-id", "response");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Post not found");
      }
    });

    it("updates response text without changing status", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "done" }));

      const result = await updateResponseText("post-1", "Updated response");

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          responseText: "Updated response",
        })
      );
    });

    it("sets respondedAt when updating response on done post", async () => {
      mockPostsFindFirst.mockResolvedValue(createMockPost({ status: "done" }));

      await updateResponseText("post-1", "Updated response");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          responseText: "Updated response",
          respondedAt: expect.any(Date),
        })
      );
    });

    it("preserves respondedAt when updating response on non-done post", async () => {
      const existingRespondedAt = new Date("2024-01-15");
      mockPostsFindFirst.mockResolvedValue(
        createMockPost({
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
    it("returns counts for all statuses", async () => {
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
        // ignored and done have no posts
      ]);

      const result = await getPostCounts();

      expect(result).toEqual({
        new: 10,
        ignored: 0,
        done: 0,
      });
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

    it("returns message when no search terms configured", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
      mockTagsFindMany.mockResolvedValue([]); // No tags with terms

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(0);
        expect(result.message).toContain("No search terms configured");
      }
    });

    it("fetches posts and stores them", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
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
      mockReturning.mockResolvedValue([
        {
          id: "new-db-post-id",
          redditId: "new-post-123",
          title: "YugabyteDB is great for distributed SQL",
          userId: MOCK_USER_ID,
        },
      ]);

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(1);
        expect(result.message).toBe("Found 1 new post.");
      }
      expect(mockFetchRedditPosts).toHaveBeenCalledWith(["postgresql"]);
    });

    it("skips duplicate posts (same reddit_id) via upsert", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
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
      // Upsert returns empty array when post already exists (onConflictDoNothing)
      mockReturning.mockResolvedValue([]);

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(0);
        expect(result.message).toBe("Found 0 new posts.");
      }
      // Insert IS called (upsert) but the conflict is handled by the DB
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("assigns tags based on matching search terms", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
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
      mockReturning.mockResolvedValue([
        { id: "new-db-post-id", redditId: "multi-tag-post", userId: MOCK_USER_ID },
      ]);

      await fetchNewPosts();

      // Should insert post_tags for both matching tags
      // mockInsert is called for: posts table, then post_tags for each tag
      expect(mockInsert).toHaveBeenCalledTimes(3); // 1 post + 2 post_tags
    });

    it("creates posts with status 'new'", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
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
      mockReturning.mockResolvedValue([
        { id: "new-db-id", redditId: "new-post", userId: MOCK_USER_ID },
      ]);

      await fetchNewPosts();

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "new",
        })
      );
    });

    it("returns singular message for 1 new post", async () => {
      mockSubredditsFindMany.mockResolvedValue([
        { id: "sub-1", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ]);
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
      mockReturning.mockResolvedValue([
        { id: "db-id", redditId: "one-post", userId: MOCK_USER_ID },
      ]);

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
        return Promise.resolve([
          { id: `db-id-${callCount}`, redditId: `post-${callCount}`, userId: MOCK_USER_ID },
        ]);
      });

      const result = await fetchNewPosts();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(2);
        expect(result.message).toBe("Found 2 new posts.");
      }
    });
  });
});
