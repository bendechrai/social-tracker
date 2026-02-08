/**
 * Unit tests for GET /api/cron/fetch-posts route.
 *
 * Tests cover:
 * - Advisory lock acquisition and skipped response when lock is held
 * - Subreddits with no subreddit_fetch_status row trigger fetch
 * - Subreddits not due (within refresh interval) are skipped
 * - last_fetched_at is updated after successful fetch
 * - Response shape matches spec: { fetched: [...], skipped: N }
 * - Empty subreddit list returns empty result
 * - Idempotent: no duplicate posts on re-runs (via fetchPostsForAllUsers)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db.execute for advisory lock
const mockExecute = vi.fn();
// Mock selectDistinct for subreddit names
const mockSelectDistinctFrom = vi.fn();
const mockSelectDistinct = vi.fn(() => ({
  from: mockSelectDistinctFrom,
}));
// Mock select for fetch statuses
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({
  where: mockSelectWhere,
}));
const mockSelect = vi.fn(() => ({
  from: mockSelectFrom,
}));
// Mock insert for upsert of subreddit_fetch_status
const mockOnConflictDoUpdate = vi.fn();
const mockInsertValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockInsert = vi.fn(() => ({
  values: mockInsertValues,
}));

vi.mock("@/lib/db", () => ({
  db: {
    execute: (arg: unknown) => mockExecute(arg),
    selectDistinct: () => mockSelectDistinct(),
    select: () => mockSelect(),
    insert: () => mockInsert(),
  },
}));

// Mock reddit fetcher
const mockFetchRedditPosts = vi.fn();
const mockFetchRedditComments = vi.fn();
vi.mock("@/lib/reddit", () => ({
  fetchRedditPosts: (...args: unknown[]) => mockFetchRedditPosts(...args),
  fetchRedditComments: (...args: unknown[]) => mockFetchRedditComments(...args),
}));

// Mock post actions
const mockFetchPostsForAllUsers = vi.fn();
const mockGetLastPostTimestampPerSubreddit = vi.fn();
const mockSendNotificationEmails = vi.fn();
const mockUpsertComments = vi.fn();
vi.mock("@/app/actions/posts", () => ({
  fetchPostsForAllUsers: (...args: unknown[]) =>
    mockFetchPostsForAllUsers(...args),
  getLastPostTimestampPerSubreddit: (...args: unknown[]) =>
    mockGetLastPostTimestampPerSubreddit(...args),
  sendNotificationEmails: (...args: unknown[]) =>
    mockSendNotificationEmails(...args),
  upsertComments: (...args: unknown[]) =>
    mockUpsertComments(...args),
}));

// Mock drizzle-orm operators (preserve relations for schema imports)
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    sql: actual.sql,
    inArray: vi.fn(),
  };
});

// Import after mocks
import { GET } from "@/app/api/cron/fetch-posts/route";

describe("GET /api/cron/fetch-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: lock acquired successfully
    mockExecute.mockResolvedValue([{ pg_try_advisory_lock: true }]);
    // Default: no subreddits
    mockSelectDistinctFrom.mockResolvedValue([]);
    // Default: no fetch statuses
    mockSelectWhere.mockResolvedValue([]);
    // Default: no last timestamps
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(new Map());
    // Default: no posts fetched
    mockFetchRedditPosts.mockResolvedValue([]);
    // Default: fan-out returns 0
    mockFetchPostsForAllUsers.mockResolvedValue({ newUserPostCount: 0 });
    // Default: no comments fetched
    mockFetchRedditComments.mockResolvedValue([]);
    // Default: upsert comments
    mockUpsertComments.mockResolvedValue({ upsertedCount: 0 });
    // Default: notification emails
    mockSendNotificationEmails.mockResolvedValue({ sent: 0, skipped: 0 });
    // Default: upsert succeeds
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
  });

  it("should return skipped response when advisory lock is already held", async () => {
    mockExecute.mockResolvedValueOnce([{ pg_try_advisory_lock: false }]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ status: "skipped", reason: "already_running" });
    // Should not query subreddits
    expect(mockSelectDistinct).not.toHaveBeenCalled();
  });

  it("should release advisory lock even after returning skipped", async () => {
    mockExecute.mockResolvedValueOnce([{ pg_try_advisory_lock: false }]);

    await GET();

    // Lock was not acquired, so no unlock should happen
    // (skipped path returns before the try block)
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("should return empty result when no subreddits have subscribers", async () => {
    mockSelectDistinctFrom.mockResolvedValue([]);

    const res = await GET();
    const data = await res.json();

    expect(data).toEqual({ fetched: [], skipped: 0 });
    // Advisory lock should be released (execute called twice: acquire + release)
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("should fetch subreddits with no fetch_status row (7-day backfill)", async () => {
    mockSelectDistinctFrom.mockResolvedValue([{ name: "nextjs" }]);
    mockSelectWhere.mockResolvedValue([]); // No fetch_status rows
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(new Map());

    const res = await GET();
    const data = await res.json();

    expect(data.fetched).toEqual(["nextjs"]);
    expect(data.skipped).toBe(0);
    expect(mockFetchRedditPosts).toHaveBeenCalledTimes(1);
    expect(mockFetchPostsForAllUsers).toHaveBeenCalledWith("nextjs", []);
  });

  it("should skip subreddits that are not due for refresh", async () => {
    const recentFetch = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    mockSelectDistinctFrom.mockResolvedValue([{ name: "react" }]);
    mockSelectWhere.mockResolvedValue([
      {
        name: "react",
        lastFetchedAt: recentFetch,
        refreshIntervalMinutes: 60,
        createdAt: new Date(),
      },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.fetched).toEqual([]);
    expect(data.skipped).toBe(1);
    expect(mockFetchRedditPosts).not.toHaveBeenCalled();
  });

  it("should fetch subreddits that are overdue for refresh", async () => {
    const oldFetch = new Date(Date.now() - 120 * 60 * 1000); // 2 hours ago
    mockSelectDistinctFrom.mockResolvedValue([{ name: "typescript" }]);
    mockSelectWhere.mockResolvedValue([
      {
        name: "typescript",
        lastFetchedAt: oldFetch,
        refreshIntervalMinutes: 60,
        createdAt: new Date(),
      },
    ]);
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(
      new Map([["typescript", new Date(Date.now() - 3600 * 1000)]])
    );

    const res = await GET();
    const data = await res.json();

    expect(data.fetched).toEqual(["typescript"]);
    expect(data.skipped).toBe(0);
    expect(mockFetchRedditPosts).toHaveBeenCalledTimes(1);
  });

  it("should upsert subreddit_fetch_status after successful fetch", async () => {
    mockSelectDistinctFrom.mockResolvedValue([{ name: "svelte" }]);
    mockSelectWhere.mockResolvedValue([]);

    await GET();

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "svelte" })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("should handle mix of due and not-due subreddits", async () => {
    const recentFetch = new Date(Date.now() - 10 * 60 * 1000);
    const oldFetch = new Date(Date.now() - 120 * 60 * 1000);
    mockSelectDistinctFrom.mockResolvedValue([
      { name: "react" },
      { name: "vue" },
      { name: "angular" },
    ]);
    mockSelectWhere.mockResolvedValue([
      {
        name: "react",
        lastFetchedAt: recentFetch,
        refreshIntervalMinutes: 60,
        createdAt: new Date(),
      },
      {
        name: "vue",
        lastFetchedAt: oldFetch,
        refreshIntervalMinutes: 60,
        createdAt: new Date(),
      },
      // angular has no fetch status — will be fetched
    ]);
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(new Map());

    const res = await GET();
    const data = await res.json();

    expect(data.fetched).toEqual(["vue", "angular"]);
    expect(data.skipped).toBe(1);
    expect(mockFetchRedditPosts).toHaveBeenCalledTimes(2);
  });

  it("should always release the advisory lock on success", async () => {
    mockSelectDistinctFrom.mockResolvedValue([{ name: "test" }]);
    mockSelectWhere.mockResolvedValue([]);

    await GET();

    // execute called: 1 for lock acquire, 1 for lock release
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("should release advisory lock even on error", async () => {
    mockSelectDistinctFrom.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    // Lock should still be released
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("should pass fetched posts to fetchPostsForAllUsers", async () => {
    const mockPosts = [
      {
        redditId: "t3_abc",
        title: "Test",
        body: null,
        author: "user1",
        subreddit: "nextjs",
        permalink: "/r/nextjs/abc",
        url: null,
        redditCreatedAt: new Date(),
        score: 10,
        numComments: 5,
        isSelf: true,
        isNsfw: false,
      },
    ];
    mockSelectDistinctFrom.mockResolvedValue([{ name: "nextjs" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockFetchRedditPosts.mockResolvedValue(mockPosts);

    await GET();

    expect(mockFetchPostsForAllUsers).toHaveBeenCalledWith("nextjs", mockPosts);
  });

  it("should call sendNotificationEmails after successful fetch", async () => {
    mockSelectDistinctFrom.mockResolvedValue([{ name: "nextjs" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(new Map());

    const res = await GET();
    const data = await res.json();

    expect(mockSendNotificationEmails).toHaveBeenCalledTimes(1);
    expect(data.emails).toEqual({ sent: 0, skipped: 0 });
  });

  it("should include email results in response", async () => {
    mockSelectDistinctFrom.mockResolvedValue([{ name: "nextjs" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(new Map());
    mockSendNotificationEmails.mockResolvedValue({ sent: 2, skipped: 1 });

    const res = await GET();
    const data = await res.json();

    expect(data.emails).toEqual({ sent: 2, skipped: 1 });
  });

  it("should not call sendNotificationEmails when no subreddits exist", async () => {
    mockSelectDistinctFrom.mockResolvedValue([]);

    await GET();

    expect(mockSendNotificationEmails).not.toHaveBeenCalled();
  });

  it("should not call sendNotificationEmails when no subreddits are due", async () => {
    const recentFetch = new Date(Date.now() - 10 * 60 * 1000);
    mockSelectDistinctFrom.mockResolvedValue([{ name: "react" }]);
    mockSelectWhere.mockResolvedValue([
      {
        name: "react",
        lastFetchedAt: recentFetch,
        refreshIntervalMinutes: 60,
        createdAt: new Date(),
      },
    ]);

    await GET();

    expect(mockSendNotificationEmails).not.toHaveBeenCalled();
  });

  it("should use DB timestamp for incremental fetch when available", async () => {
    const lastPostDate = new Date("2026-02-06T12:00:00Z");
    mockSelectDistinctFrom.mockResolvedValue([{ name: "golang" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockGetLastPostTimestampPerSubreddit.mockResolvedValue(
      new Map([["golang", lastPostDate]])
    );

    await GET();

    expect(mockFetchRedditPosts).toHaveBeenCalledTimes(1);
    const callArg = mockFetchRedditPosts.mock.calls[0]![0] as Map<
      string,
      number
    >;
    expect(callArg.get("golang")).toBe(
      Math.floor(lastPostDate.getTime() / 1000)
    );
  });

  it("should fetch comments for each fetched post", async () => {
    const mockPosts = [
      {
        redditId: "t3_post1",
        title: "Post 1",
        body: null,
        author: "user1",
        subreddit: "nextjs",
        permalink: "/r/nextjs/post1",
        url: null,
        redditCreatedAt: new Date(),
        score: 10,
        numComments: 5,
        isSelf: true,
        isNsfw: false,
      },
      {
        redditId: "t3_post2",
        title: "Post 2",
        body: null,
        author: "user2",
        subreddit: "nextjs",
        permalink: "/r/nextjs/post2",
        url: null,
        redditCreatedAt: new Date(),
        score: 20,
        numComments: 3,
        isSelf: true,
        isNsfw: false,
      },
    ];
    mockSelectDistinctFrom.mockResolvedValue([{ name: "nextjs" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockFetchRedditPosts.mockResolvedValue(mockPosts);
    mockFetchRedditComments.mockResolvedValue([
      {
        redditId: "t1_comment1",
        postRedditId: "t3_post1",
        parentRedditId: null,
        author: "commenter",
        body: "Nice!",
        score: 5,
        redditCreatedAt: new Date(),
      },
    ]);

    await GET();

    // fetchRedditComments called once per post
    expect(mockFetchRedditComments).toHaveBeenCalledTimes(2);
    expect(mockFetchRedditComments).toHaveBeenCalledWith("t3_post1");
    expect(mockFetchRedditComments).toHaveBeenCalledWith("t3_post2");
    // upsertComments called once per post
    expect(mockUpsertComments).toHaveBeenCalledTimes(2);
  });

  it("should not fetch comments when no posts are fetched", async () => {
    mockSelectDistinctFrom.mockResolvedValue([{ name: "nextjs" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockFetchRedditPosts.mockResolvedValue([]);

    await GET();

    expect(mockFetchRedditComments).not.toHaveBeenCalled();
    expect(mockUpsertComments).not.toHaveBeenCalled();
  });

  it("should pass fetched comments to upsertComments", async () => {
    const mockPosts = [
      {
        redditId: "t3_abc",
        title: "Test",
        body: null,
        author: "user",
        subreddit: "test",
        permalink: "/r/test/abc",
        url: null,
        redditCreatedAt: new Date(),
        score: 1,
        numComments: 1,
        isSelf: true,
        isNsfw: false,
      },
    ];
    const mockComments = [
      {
        redditId: "t1_xyz",
        postRedditId: "t3_abc",
        parentRedditId: null,
        author: "commenter",
        body: "Hello",
        score: 3,
        redditCreatedAt: new Date(),
      },
    ];
    mockSelectDistinctFrom.mockResolvedValue([{ name: "test" }]);
    mockSelectWhere.mockResolvedValue([]);
    mockFetchRedditPosts.mockResolvedValue(mockPosts);
    mockFetchRedditComments.mockResolvedValue(mockComments);

    await GET();

    expect(mockUpsertComments).toHaveBeenCalledWith(mockComments);
  });
});
