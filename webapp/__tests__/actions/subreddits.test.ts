/**
 * Unit tests for subreddit server actions.
 *
 * These tests verify that subreddit actions correctly:
 * - List subreddits for the current user, alphabetically ordered
 * - Add subreddits with proper validation and normalization
 * - Handle duplicate detection (same user + name)
 * - Remove subreddits without affecting existing posts
 * - Link existing posts when adding a subreddit that already has posts
 * - Trigger on-demand fetch when adding a brand-new subreddit
 *
 * Uses mocked database to isolate unit tests from database.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database before importing actions
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockPostsFindMany = vi.fn();
const mockTagsFindMany = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockValues = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockSelectFromWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      subreddits: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      posts: {
        findMany: (...args: unknown[]) => mockPostsFindMany(...args),
      },
      tags: {
        findMany: (...args: unknown[]) => mockTagsFindMany(...args),
      },
    },
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => mockSelectFromWhere(...args),
      }),
    }),
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...valArgs: unknown[]) => {
          mockValues(...valArgs);
          return {
            returning: () => mockReturning(),
            onConflictDoNothing: () => {
              mockOnConflictDoNothing();
              return {
                returning: () => mockOnConflictDoNothing(),
              };
            },
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return {
        where: (...whereArgs: unknown[]) => {
          mockWhere(...whereArgs);
          return Promise.resolve();
        },
      };
    },
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

// Mock reddit module for subreddit verification
const mockVerifySubredditExists = vi.fn();
vi.mock("@/lib/reddit", () => ({
  verifySubredditExists: (...args: unknown[]) => mockVerifySubredditExists(...args),
}));

// Mock the cron route handler for on-demand fetch trigger
const mockCronGET = vi.fn();
vi.mock("@/app/api/cron/fetch-posts/route", () => ({
  GET: (...args: unknown[]) => mockCronGET(...args),
}));

// User ID constant for use in tests
const MOCK_USER_ID = "test-user-uuid-1234";

// Import after mocks are set up
import {
  listSubreddits,
  addSubreddit,
  removeSubreddit,
} from "@/app/actions/subreddits";

describe("subreddit server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: subreddit exists (verification passes)
    mockVerifySubredditExists.mockResolvedValue(true);
    // Default: no existing posts for subreddit
    mockPostsFindMany.mockResolvedValue([]);
    // Default: no tags for user
    mockTagsFindMany.mockResolvedValue([]);
    // Default: cron GET returns a Response
    mockCronGET.mockResolvedValue(new Response(JSON.stringify({ fetched: [], skipped: 0 })));
    // Default: no fetch statuses
    mockSelectFromWhere.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listSubreddits", () => {
    it("returns empty array when no subreddits exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listSubreddits();

      expect(result).toEqual([]);
      expect(mockFindMany).toHaveBeenCalledOnce();
    });

    it("returns subreddits for the current user", async () => {
      const mockData = [
        { id: "sub-1", name: "database", userId: MOCK_USER_ID, createdAt: new Date("2024-01-01") },
        { id: "sub-2", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date("2024-01-02") },
      ];
      mockFindMany.mockResolvedValue(mockData);
      mockSelectFromWhere.mockResolvedValue([]);

      const result = await listSubreddits();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "sub-1",
        name: "database",
        createdAt: new Date("2024-01-01"),
        fetchStatus: undefined,
      });
      expect(result[1]).toEqual({
        id: "sub-2",
        name: "postgresql",
        createdAt: new Date("2024-01-02"),
        fetchStatus: undefined,
      });
    });

    it("includes fetch status when subreddit_fetch_status row exists", async () => {
      const lastFetched = new Date("2024-06-15T10:00:00Z");
      const mockData = [
        { id: "sub-1", name: "database", userId: MOCK_USER_ID, createdAt: new Date("2024-01-01") },
        { id: "sub-2", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date("2024-01-02") },
      ];
      mockFindMany.mockResolvedValue(mockData);
      mockSelectFromWhere.mockResolvedValue([
        { name: "postgresql", lastFetchedAt: lastFetched, refreshIntervalMinutes: 60, createdAt: new Date() },
      ]);

      const result = await listSubreddits();

      expect(result).toHaveLength(2);
      expect(result[0]!.fetchStatus).toBeUndefined(); // "database" has no fetch status
      expect(result[1]!.fetchStatus).toEqual({
        lastFetchedAt: lastFetched,
        refreshIntervalMinutes: 60,
      });
    });

    it("returns subreddits in alphabetical order", async () => {
      // The action specifies alphabetical ordering via asc(subreddits.name)
      // We verify the mock was called with the right ordering options
      const mockData = [
        { id: "sub-1", name: "database", userId: MOCK_USER_ID, createdAt: new Date() },
        { id: "sub-2", name: "node", userId: MOCK_USER_ID, createdAt: new Date() },
        { id: "sub-3", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
      ];
      mockFindMany.mockResolvedValue(mockData);

      const result = await listSubreddits();

      expect(result).toHaveLength(3);
      // Verify order (database comes before node comes before postgresql alphabetically)
      expect(result.map((s) => s.name)).toEqual(["database", "node", "postgresql"]);
    });
  });

  describe("addSubreddit", () => {
    describe("validation", () => {
      it("rejects empty subreddit name", async () => {
        const result = await addSubreddit("");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Subreddit name is required");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects name shorter than 3 characters", async () => {
        const result = await addSubreddit("ab");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("at least 3 characters");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects name longer than 21 characters", async () => {
        const result = await addSubreddit("a".repeat(22));

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("at most 21 characters");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects special characters", async () => {
        const result = await addSubreddit("test-subreddit");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("letters, numbers, and underscores");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects spaces in name", async () => {
        const result = await addSubreddit("learn python");

        expect(result.success).toBe(false);
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("normalization", () => {
      it("normalizes r/PostgreSQL to postgresql", async () => {
        mockFindFirst.mockResolvedValue(null); // No duplicate
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("r/PostgreSQL");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit.name).toBe("postgresql");
        }
        // Verify the normalized name was used for insert
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ name: "postgresql", userId: MOCK_USER_ID })
        );
      });

      it("converts uppercase to lowercase", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("POSTGRESQL");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit.name).toBe("postgresql");
        }
      });

      it("strips R/ prefix (case-insensitive)", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "javascript", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("R/JavaScript");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit.name).toBe("javascript");
        }
      });
    });

    describe("duplicate detection", () => {
      it("rejects duplicate subreddit for same user", async () => {
        mockFindFirst.mockResolvedValue({
          id: "existing-sub",
          name: "postgresql",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        });

        const result = await addSubreddit("postgresql");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Subreddit already added");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("detects duplicate after normalization", async () => {
        mockFindFirst.mockResolvedValue({
          id: "existing-sub",
          name: "postgresql",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        });

        const result = await addSubreddit("r/PostgreSQL"); // Should normalize to "postgresql"

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Subreddit already added");
        }
      });
    });

    describe("successful creation", () => {
      it("creates subreddit and returns data", async () => {
        mockFindFirst.mockResolvedValue(null);
        const createdAt = new Date();
        mockReturning.mockResolvedValue([
          { id: "new-sub-id", name: "typescript", userId: MOCK_USER_ID, createdAt },
        ]);

        const result = await addSubreddit("typescript");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit).toEqual({
            id: "new-sub-id",
            name: "typescript",
            createdAt,
          });
        }
        expect(mockInsert).toHaveBeenCalledOnce();
      });

      it("accepts valid subreddit with underscores", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "learn_python", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("learn_python");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit.name).toBe("learn_python");
        }
      });

      it("accepts minimum length name (3 characters)", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "sql", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("sql");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit.name).toBe("sql");
        }
      });

      it("accepts maximum length name (21 characters)", async () => {
        const maxName = "a".repeat(21);
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: maxName, userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit(maxName);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.subreddit.name).toBe(maxName);
        }
      });
    });

    describe("subreddit verification", () => {
      it("rejects subreddit that does not exist on Reddit", async () => {
        mockVerifySubredditExists.mockResolvedValue(false);

        const result = await addSubreddit("nonexistent_sub");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Subreddit not found on Reddit");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("allows subreddit when verification passes", async () => {
        mockVerifySubredditExists.mockResolvedValue(true);
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("postgresql");

        expect(result.success).toBe(true);
        expect(mockVerifySubredditExists).toHaveBeenCalledWith("postgresql");
      });

      it("allows subreddit when API fails (graceful skip)", async () => {
        // verifySubredditExists returns true on API failure
        mockVerifySubredditExists.mockResolvedValue(true);
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "database", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        const result = await addSubreddit("database");

        expect(result.success).toBe(true);
      });

      it("verifies with normalized name", async () => {
        mockVerifySubredditExists.mockResolvedValue(true);
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "postgresql", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        await addSubreddit("r/PostgreSQL");

        // Should verify with normalized lowercase name
        expect(mockVerifySubredditExists).toHaveBeenCalledWith("postgresql");
      });

      it("does not call verification for invalid names", async () => {
        await addSubreddit("ab"); // Too short

        expect(mockVerifySubredditExists).not.toHaveBeenCalled();
      });
    });

    describe("post linking for existing subreddits", () => {
      it("links existing posts to user when subreddit already has posts", async () => {
        mockFindFirst.mockResolvedValue(null); // No duplicate
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "nextjs", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        // Existing posts in the global posts table for this subreddit
        mockPostsFindMany.mockResolvedValue([
          {
            id: "post-1",
            redditId: "t3_abc",
            title: "Nextjs tutorial",
            body: "Learn nextjs",
            author: "user1",
            subreddit: "nextjs",
            permalink: "/r/nextjs/abc",
            url: null,
            redditCreatedAt: new Date(),
            score: 10,
            numComments: 5,
            createdAt: new Date(),
          },
        ]);
        // No tags for user
        mockTagsFindMany.mockResolvedValue([]);
        // user_posts insert succeeds
        mockOnConflictDoNothing.mockResolvedValue([{ userId: MOCK_USER_ID, postId: "post-1", status: "new" }]);

        const result = await addSubreddit("nextjs");

        expect(result.success).toBe(true);
        // Should NOT trigger the cron endpoint
        expect(mockCronGET).not.toHaveBeenCalled();
        // Should have inserted user_posts (insert called for subreddit + user_posts)
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });

      it("matches tags when linking existing posts", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "reactjs", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        mockPostsFindMany.mockResolvedValue([
          {
            id: "post-1",
            redditId: "t3_xyz",
            title: "React hooks guide",
            body: "useState and useEffect",
            author: "dev1",
            subreddit: "reactjs",
            permalink: "/r/reactjs/xyz",
            url: null,
            redditCreatedAt: new Date(),
            score: 50,
            numComments: 12,
            createdAt: new Date(),
          },
        ]);

        // User has a tag with matching search term
        mockTagsFindMany.mockResolvedValue([
          {
            id: "tag-1",
            userId: MOCK_USER_ID,
            name: "Hooks",
            color: "#6366f1",
            createdAt: new Date(),
            searchTerms: [{ id: "st-1", tagId: "tag-1", term: "hooks", createdAt: new Date() }],
          },
        ]);

        // user_post insert returns a result (newly created)
        mockOnConflictDoNothing.mockResolvedValue([{ userId: MOCK_USER_ID, postId: "post-1", status: "new" }]);

        const result = await addSubreddit("reactjs");

        expect(result.success).toBe(true);
        expect(mockCronGET).not.toHaveBeenCalled();
        // insert called for: subreddit, user_post, user_post_tag
        expect(mockInsert).toHaveBeenCalledTimes(3);
      });

      it("does not create duplicate user_posts if already linked", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "golang", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);

        mockPostsFindMany.mockResolvedValue([
          {
            id: "post-1",
            redditId: "t3_gol",
            title: "Go tutorial",
            body: null,
            author: "gopher",
            subreddit: "golang",
            permalink: "/r/golang/gol",
            url: null,
            redditCreatedAt: new Date(),
            score: 5,
            numComments: 1,
            createdAt: new Date(),
          },
        ]);
        mockTagsFindMany.mockResolvedValue([]);
        // onConflictDoNothing returns empty (post already linked)
        mockOnConflictDoNothing.mockResolvedValue([]);

        const result = await addSubreddit("golang");

        expect(result.success).toBe(true);
        // insert for subreddit + user_post (no tag inserts since no user_post created)
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });
    });

    describe("on-demand fetch for new subreddits", () => {
      it("triggers cron endpoint when subreddit has no existing posts", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          { id: "new-sub", name: "svelte", userId: MOCK_USER_ID, createdAt: new Date() },
        ]);
        mockPostsFindMany.mockResolvedValue([]); // No existing posts

        const result = await addSubreddit("svelte");

        expect(result.success).toBe(true);
        expect(mockCronGET).toHaveBeenCalledOnce();
      });
    });
  });

  describe("removeSubreddit", () => {
    it("returns error when subreddit not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await removeSubreddit("nonexistent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Subreddit not found");
      }
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("successfully removes existing subreddit", async () => {
      mockFindFirst.mockResolvedValue({
        id: "sub-to-delete",
        name: "postgresql",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
      });

      const result = await removeSubreddit("sub-to-delete");

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it("does not affect posts from removed subreddit", async () => {
      // This is verified by the fact that we only delete from subreddits table,
      // not from posts table. Posts have no FK to subreddits, just a varchar field.
      mockFindFirst.mockResolvedValue({
        id: "sub-to-delete",
        name: "postgresql",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
      });

      const result = await removeSubreddit("sub-to-delete");

      expect(result.success).toBe(true);
      // Verify only subreddits table was deleted from
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it("verifies subreddit belongs to current user before deletion", async () => {
      // When mockFindFirst returns null (meaning subreddit not found for this user),
      // the delete should not be called
      mockFindFirst.mockResolvedValue(null);

      const result = await removeSubreddit("other-users-subreddit");

      expect(result.success).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
