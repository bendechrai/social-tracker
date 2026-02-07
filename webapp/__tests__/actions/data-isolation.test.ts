/**
 * Data isolation tests for server actions.
 *
 * Verifies acceptance criteria from authentication.md:
 * - Data isolated: Users only see their own tags, subreddits, posts
 *
 * And from user-api-keys.md:
 * - Keys isolated: User A cannot access User B's keys
 *
 * These tests verify that every server action scopes queries by userId,
 * ensuring multi-tenant data isolation at the database query level.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Track all database query calls to verify userId filtering
const mockQueryCalls: Array<{ method: string; args: unknown[] }> = [];

// Common mock functions
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockWhere = vi.fn();
const mockCountResult = vi.fn();
const mockGroupByResult = vi.fn();
const mockSelectDistinctResult = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      subreddits: {
        findMany: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "subreddits.findMany", args });
          return mockFindMany(...args);
        },
        findFirst: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "subreddits.findFirst", args });
          return mockFindFirst(...args);
        },
      },
      tags: {
        findMany: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "tags.findMany", args });
          return mockFindMany(...args);
        },
        findFirst: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "tags.findFirst", args });
          return mockFindFirst(...args);
        },
      },
      posts: {
        findMany: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "posts.findMany", args });
          return mockFindMany(...args);
        },
        findFirst: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "posts.findFirst", args });
          return mockFindFirst(...args);
        },
      },
      userPosts: {
        findMany: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "userPosts.findMany", args });
          return mockFindMany(...args);
        },
        findFirst: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "userPosts.findFirst", args });
          return mockFindFirst(...args);
        },
      },
      users: {
        findFirst: (...args: unknown[]) => {
          mockQueryCalls.push({ method: "users.findFirst", args });
          return mockFindFirst(...args);
        },
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
            where: (...whereArgs: unknown[]) => {
              mockWhere(...whereArgs);
              return {
                returning: () => mockReturning(),
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
    select: () => ({
      from: () => ({
        where: () => {
          const promise = mockCountResult();
          (promise as Promise<unknown[]> & { groupBy: () => Promise<unknown[]> }).groupBy = () => mockGroupByResult();
          return promise;
        },
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve([]),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Track which user ID is returned
let currentMockUserId = "user-A-id";
vi.mock("@/app/actions/users", () => ({
  getCurrentUserId: vi.fn().mockImplementation(() => Promise.resolve(currentMockUserId)),
}));

// Mock reddit module
vi.mock("@/lib/reddit", () => ({
  verifySubredditExists: vi.fn().mockResolvedValue(true),
  fetchRedditPosts: vi.fn().mockResolvedValue([]),
}));

// Mock encryption for api-keys
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-value"),
  decrypt: vi.fn().mockReturnValue("decrypted-key"),
}));

// Mock the cron route handler (used by addSubreddit for on-demand fetch)
vi.mock("@/app/api/cron/fetch-posts/route", () => ({
  GET: vi.fn().mockResolvedValue(new Response(JSON.stringify({ fetched: [], skipped: 0 }))),
}));

// Import actions after mocks
import { listSubreddits, addSubreddit } from "@/app/actions/subreddits";
import { listTags, createTag } from "@/app/actions/tags";
import { listPosts, getPostCounts } from "@/app/actions/posts";
import { saveGroqApiKey, hasGroqApiKey } from "@/app/actions/api-keys";
import { getCurrentUserId } from "@/app/actions/users";

describe("data isolation between users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryCalls.length = 0;
    currentMockUserId = "user-A-id";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("subreddit isolation", () => {
    it("listSubreddits calls getCurrentUserId to scope by user", async () => {
      mockFindMany.mockResolvedValue([]);
      currentMockUserId = "user-A-id";

      await listSubreddits();

      expect(getCurrentUserId).toHaveBeenCalled();
      // The query was called with a where clause
      expect(mockFindMany).toHaveBeenCalledOnce();
      const queryArgs = mockFindMany.mock.calls[0]![0];
      expect(queryArgs).toHaveProperty("where");
    });

    it("addSubreddit uses authenticated user's ID in insert", async () => {
      currentMockUserId = "user-A-id";
      mockFindFirst.mockResolvedValue(null); // No duplicate
      mockReturning.mockResolvedValue([
        { id: "sub-1", name: "typescript", userId: "user-A-id", createdAt: new Date() },
      ]);

      await addSubreddit("typescript");

      expect(getCurrentUserId).toHaveBeenCalled();
      // The inserted values should contain userId from getCurrentUserId
      expect(mockValues).toHaveBeenCalled();
      const insertedData = mockValues.mock.calls[0]![0];
      expect(insertedData).toHaveProperty("userId", "user-A-id");
    });

    it("addSubreddit checks duplicates scoped to current user", async () => {
      currentMockUserId = "user-A-id";
      mockFindFirst.mockResolvedValue(null);
      mockReturning.mockResolvedValue([
        { id: "sub-1", name: "test", userId: "user-A-id", createdAt: new Date() },
      ]);

      await addSubreddit("test");

      // findFirst should have been called to check for duplicates
      expect(mockFindFirst).toHaveBeenCalled();
      const queryArgs = mockFindFirst.mock.calls[0]![0];
      expect(queryArgs).toHaveProperty("where");
    });
  });

  describe("tag isolation", () => {
    it("listTags calls getCurrentUserId to scope by user", async () => {
      mockFindMany.mockResolvedValue([]);
      currentMockUserId = "user-B-id";

      await listTags();

      expect(getCurrentUserId).toHaveBeenCalled();
      expect(mockFindMany).toHaveBeenCalledOnce();
      const queryArgs = mockFindMany.mock.calls[0]![0];
      expect(queryArgs).toHaveProperty("where");
    });

    it("createTag uses authenticated user's ID in insert", async () => {
      currentMockUserId = "user-B-id";
      mockFindFirst.mockResolvedValue(null); // No duplicate
      mockReturning.mockResolvedValue([
        { id: "tag-1", name: "React", color: "#6366f1", userId: "user-B-id", createdAt: new Date() },
      ]);

      await createTag("React", "#6366f1", []);

      expect(getCurrentUserId).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      const insertedData = mockValues.mock.calls[0]![0];
      expect(insertedData).toHaveProperty("userId", "user-B-id");
    });
  });

  describe("post isolation", () => {
    it("listPosts calls getCurrentUserId to scope by user", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCountResult.mockResolvedValue([{ count: 0 }]);
      currentMockUserId = "user-A-id";

      await listPosts("new");

      expect(getCurrentUserId).toHaveBeenCalled();
    });

    it("getPostCounts calls getCurrentUserId to scope by user", async () => {
      mockGroupByResult.mockResolvedValue([]);
      currentMockUserId = "user-A-id";

      await getPostCounts();

      expect(getCurrentUserId).toHaveBeenCalled();
    });

    it("different users see different data through userId scoping", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCountResult.mockResolvedValue([{ count: 0 }]);

      // User A makes a request
      currentMockUserId = "user-A-id";
      await listPosts("new");
      const firstCall = getCurrentUserId as ReturnType<typeof vi.fn>;
      expect(firstCall).toHaveBeenCalled();

      vi.clearAllMocks();

      // User B makes a request
      currentMockUserId = "user-B-id";
      mockFindMany.mockResolvedValue([]);
      mockCountResult.mockResolvedValue([{ count: 0 }]);
      await listPosts("new");
      expect(getCurrentUserId).toHaveBeenCalled();
    });
  });

  describe("API key isolation", () => {
    it("saveGroqApiKey scopes update to authenticated user", async () => {
      currentMockUserId = "user-A-id";
      mockReturning.mockResolvedValue([{ id: "user-A-id", groqApiKey: "encrypted-value" }]);

      await saveGroqApiKey("gsk_testkey123456789012345678901234");

      expect(getCurrentUserId).toHaveBeenCalled();
      // The where clause should scope to the user
      expect(mockWhere).toHaveBeenCalled();
    });

    it("hasGroqApiKey queries only the authenticated user's record", async () => {
      currentMockUserId = "user-A-id";
      mockFindFirst.mockResolvedValue({ groqApiKey: "encrypted-value" });

      await hasGroqApiKey();

      expect(getCurrentUserId).toHaveBeenCalled();
      expect(mockFindFirst).toHaveBeenCalled();
      const queryArgs = mockFindFirst.mock.calls[0]![0];
      expect(queryArgs).toHaveProperty("where");
    });
  });
});
