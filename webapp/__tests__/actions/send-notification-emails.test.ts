/**
 * Unit tests for sendNotificationEmails function.
 *
 * Tests cover:
 * - Eligible user with new tagged posts receives email
 * - Ineligible user (last_emailed_at < 4hr) is skipped
 * - No tagged posts → no email and no timestamp update
 * - Unverified user is skipped (emailVerified null)
 * - Failed email send does not update last_emailed_at
 * - Multiple users with different outcomes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Track calls to identify query types
const mockEligibleUsersResult = vi.fn();
const mockTaggedPostsResult = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

// The sendNotificationEmails function makes two types of db.select() calls:
// 1. Eligible users: select().from(users).where(...) → returns array directly
// 2. Tagged posts: select().from(userPostTags).innerJoin().innerJoin().innerJoin().where().orderBy()
//
// We use a fromCallCount to differentiate: first from() call is for eligible users,
// subsequent from() calls are for tagged posts.
let fromCallCount = 0;

vi.mock("@/lib/db", () => {
  return {
    db: {
      select: () => ({
        from: () => {
          fromCallCount++;
          if (fromCallCount === 1) {
            // Eligible users query: select().from(users).where()
            return {
              where: () => mockEligibleUsersResult(),
            };
          }
          // Tagged posts query: select().from(userPostTags).innerJoin()...
          return {
            innerJoin: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    orderBy: () => mockTaggedPostsResult(),
                  }),
                }),
              }),
            }),
          };
        },
      }),
      update: () => ({
        set: (...args: unknown[]) => {
          mockUpdateSet(...args);
          return {
            where: (...wArgs: unknown[]) => {
              mockUpdateWhere(...wArgs);
              return Promise.resolve();
            },
          };
        },
      }),
    },
  };
});

// Mock email sending
const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock email template builder
const mockBuildNotificationEmail = vi.fn();
vi.mock("@/lib/email-templates", () => ({
  buildNotificationEmail: (...args: unknown[]) =>
    mockBuildNotificationEmail(...args),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth (required by posts.ts "use server" actions)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock users action
vi.mock("@/app/actions/users", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("test-user"),
}));

// Mock reddit
vi.mock("@/lib/reddit", () => ({
  fetchRedditPosts: vi.fn().mockResolvedValue([]),
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    sql: actual.sql,
    eq: vi.fn(),
    and: vi.fn(),
    desc: vi.fn(),
    inArray: vi.fn(),
    notInArray: vi.fn(),
    isNotNull: vi.fn(),
    gt: vi.fn(),
    isNull: vi.fn(),
    or: vi.fn(),
    lte: vi.fn(),
  };
});

// Import after mocks
import { sendNotificationEmails } from "@/app/actions/posts";

describe("sendNotificationEmails", () => {
  const APP_URL = "https://app.example.com";

  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;

    // Default: no eligible users
    mockEligibleUsersResult.mockResolvedValue([]);

    // Default: no tagged posts
    mockTaggedPostsResult.mockResolvedValue([]);

    // Default: email template returns valid content
    mockBuildNotificationEmail.mockReturnValue({
      subject: "Social Tracker: 1 new tagged post",
      html: "<p>Hi</p>",
      text: "Hi",
      headers: {
        "List-Unsubscribe":
          "<https://app.example.com/api/unsubscribe?token=abc>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    // Default: email sends successfully
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it("sends email to eligible user with new tagged posts", async () => {
    mockEligibleUsersResult.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "user@example.com",
        lastEmailedAt: null,
      },
    ]);

    mockTaggedPostsResult.mockResolvedValueOnce([
      {
        postId: "post-1",
        title: "Test Post",
        body: "Test body",
        subreddit: "nextjs",
        author: "testuser",
        tagName: "React",
        tagColor: "#6366f1",
      },
    ]);

    const result = await sendNotificationEmails(APP_URL);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Social Tracker: 1 new tagged post",
      })
    );
    // last_emailed_at should be updated
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastEmailedAt: expect.any(Date),
      })
    );
  });

  it("skips user with no new tagged posts and does not update timestamp", async () => {
    mockEligibleUsersResult.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "user@example.com",
        lastEmailedAt: null,
      },
    ]);

    mockTaggedPostsResult.mockResolvedValueOnce([]);

    const result = await sendNotificationEmails(APP_URL);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("skips ineligible users (query returns empty when last_emailed_at < 4hr)", async () => {
    // The query filters out users with recent last_emailed_at,
    // so they simply won't be in the result set
    mockEligibleUsersResult.mockResolvedValueOnce([]);

    const result = await sendNotificationEmails(APP_URL);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips unverified users (query filters emailVerified is not null)", async () => {
    // Unverified users are filtered out by the SQL query (isNotNull(emailVerified)),
    // so they won't appear in the eligible users list
    mockEligibleUsersResult.mockResolvedValueOnce([]);

    const result = await sendNotificationEmails(APP_URL);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("passes posts to buildNotificationEmail with correct shape", async () => {
    const taggedPosts = [
      {
        postId: "post-1",
        title: "Post One",
        body: "Body one",
        subreddit: "react",
        author: "user1",
        tagName: "React",
        tagColor: "#6366f1",
      },
      {
        postId: "post-2",
        title: "Post Two",
        body: null,
        subreddit: "nextjs",
        author: "user2",
        tagName: "Next.js",
        tagColor: "#10b981",
      },
    ];

    mockEligibleUsersResult.mockResolvedValueOnce([
      { id: "user-1", email: "user@example.com", lastEmailedAt: null },
    ]);
    mockTaggedPostsResult.mockResolvedValueOnce(taggedPosts);

    await sendNotificationEmails(APP_URL);

    expect(mockBuildNotificationEmail).toHaveBeenCalledWith({
      userId: "user-1",
      posts: taggedPosts,
      appUrl: APP_URL,
    });
  });

  it("does not update last_emailed_at when email send fails", async () => {
    mockEligibleUsersResult.mockResolvedValueOnce([
      { id: "user-1", email: "user@example.com", lastEmailedAt: null },
    ]);
    mockTaggedPostsResult.mockResolvedValueOnce([
      {
        postId: "post-1",
        title: "Test",
        body: null,
        subreddit: "test",
        author: "user",
        tagName: "Tag",
        tagColor: "#000",
      },
    ]);
    mockSendEmail.mockResolvedValueOnce({
      success: false,
      error: "SMTP error",
    });

    const result = await sendNotificationEmails(APP_URL);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("handles multiple users with different outcomes", async () => {
    mockEligibleUsersResult.mockResolvedValueOnce([
      { id: "user-1", email: "user1@example.com", lastEmailedAt: null },
      { id: "user-2", email: "user2@example.com", lastEmailedAt: null },
      { id: "user-3", email: "user3@example.com", lastEmailedAt: null },
    ]);

    // User 1: has tagged posts, email succeeds
    mockTaggedPostsResult.mockResolvedValueOnce([
      {
        postId: "p1",
        title: "Post",
        body: null,
        subreddit: "test",
        author: "a",
        tagName: "Tag",
        tagColor: "#000",
      },
    ]);

    // User 2: no tagged posts
    mockTaggedPostsResult.mockResolvedValueOnce([]);

    // User 3: has tagged posts, email fails
    mockTaggedPostsResult.mockResolvedValueOnce([
      {
        postId: "p2",
        title: "Post 2",
        body: null,
        subreddit: "test",
        author: "b",
        tagName: "Tag",
        tagColor: "#000",
      },
    ]);

    mockSendEmail
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: "SMTP error" });

    const result = await sendNotificationEmails(APP_URL);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(2); // user-2 (no posts) + user-3 (email failed)
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    // Only user-1's timestamp should be updated
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
  });
});
