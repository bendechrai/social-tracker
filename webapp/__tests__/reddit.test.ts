/**
 * Unit tests for Reddit API client.
 *
 * These tests verify that the Reddit client correctly:
 * - Returns empty results when credentials are not configured
 * - Parses Reddit API responses correctly
 * - Extracts all required fields from posts
 * - Handles API errors gracefully
 *
 * Uses MSW to mock Reddit API endpoints.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { fetchRedditPosts, isRedditConfigured, clearTokenCache } from "@/lib/reddit";

// Store original env vars
const originalEnv = { ...process.env };

describe("isRedditConfigured", () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    delete process.env.REDDIT_USERNAME;
    delete process.env.REDDIT_PASSWORD;
  });

  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };
  });

  it("returns false when no credentials are configured", () => {
    expect(isRedditConfigured()).toBe(false);
  });

  it("returns false when only some credentials are configured", () => {
    process.env.REDDIT_CLIENT_ID = "test_id";
    process.env.REDDIT_CLIENT_SECRET = "test_secret";
    // Missing username and password
    expect(isRedditConfigured()).toBe(false);
  });

  it("returns true when all credentials are configured", () => {
    process.env.REDDIT_CLIENT_ID = "test_id";
    process.env.REDDIT_CLIENT_SECRET = "test_secret";
    process.env.REDDIT_USERNAME = "test_user";
    process.env.REDDIT_PASSWORD = "test_pass";
    expect(isRedditConfigured()).toBe(true);
  });
});

describe("fetchRedditPosts", () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    delete process.env.REDDIT_USERNAME;
    delete process.env.REDDIT_PASSWORD;
  });

  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };
  });

  describe("when credentials are not configured", () => {
    it("returns empty array gracefully", async () => {
      const result = await fetchRedditPosts(["postgresql"], ["yugabyte"]);
      expect(result).toEqual([]);
    });

    it("does not throw an error", async () => {
      await expect(
        fetchRedditPosts(["postgresql"], ["yugabyte"])
      ).resolves.not.toThrow();
    });
  });

  describe("when credentials are configured", () => {
    beforeEach(() => {
      process.env.REDDIT_CLIENT_ID = "test_id";
      process.env.REDDIT_CLIENT_SECRET = "test_secret";
      process.env.REDDIT_USERNAME = "test_user";
      process.env.REDDIT_PASSWORD = "test_pass";
    });

    it("returns empty array when no subreddits provided", async () => {
      const result = await fetchRedditPosts([], ["yugabyte"]);
      expect(result).toEqual([]);
    });

    it("returns empty array when no search terms provided", async () => {
      const result = await fetchRedditPosts(["postgresql"], []);
      expect(result).toEqual([]);
    });

    it("fetches posts from Reddit API", async () => {
      const result = await fetchRedditPosts(["postgresql"], ["yugabyte"]);
      expect(result.length).toBeGreaterThan(0);
    });

    it("correctly parses post data", async () => {
      const result = await fetchRedditPosts(["postgresql"], ["yugabyte"]);
      expect(result.length).toBeGreaterThan(0);

      const post = result[0]!;
      expect(post).toHaveProperty("redditId");
      expect(post).toHaveProperty("title");
      expect(post).toHaveProperty("body");
      expect(post).toHaveProperty("author");
      expect(post).toHaveProperty("subreddit");
      expect(post).toHaveProperty("permalink");
      expect(post).toHaveProperty("url");
      expect(post).toHaveProperty("redditCreatedAt");
      expect(post).toHaveProperty("score");
      expect(post).toHaveProperty("numComments");
    });

    it("extracts all required fields", async () => {
      const result = await fetchRedditPosts(["testsubreddit"], ["test"]);
      expect(result.length).toBeGreaterThan(0);

      const post = result[0]!;
      expect(typeof post.redditId).toBe("string");
      expect(typeof post.title).toBe("string");
      expect(post.body === null || typeof post.body === "string").toBe(true);
      expect(typeof post.author).toBe("string");
      expect(typeof post.subreddit).toBe("string");
      expect(typeof post.permalink).toBe("string");
      expect(post.url === null || typeof post.url === "string").toBe(true);
      expect(post.redditCreatedAt instanceof Date).toBe(true);
      expect(typeof post.score).toBe("number");
      expect(typeof post.numComments).toBe("number");
    });

    it("fetches from multiple subreddits", async () => {
      // Override the mock to return different posts for each subreddit
      server.use(
        http.get("https://oauth.reddit.com/r/:subreddit/search", ({ params }) => {
          const subreddit = params.subreddit as string;
          return HttpResponse.json({
            kind: "Listing",
            data: {
              after: null,
              children: [
                {
                  kind: "t3",
                  data: {
                    id: `post_${subreddit}`,
                    title: `Post from r/${subreddit}`,
                    selftext: "Test body",
                    author: "test_author",
                    subreddit: subreddit,
                    permalink: `/r/${subreddit}/comments/test/`,
                    url: `https://reddit.com/r/${subreddit}/comments/test/`,
                    created_utc: Math.floor(Date.now() / 1000) - 1800,
                    score: 10,
                    num_comments: 5,
                  },
                },
              ],
            },
          });
        })
      );

      const result = await fetchRedditPosts(
        ["postgresql", "database"],
        ["yugabyte"]
      );
      expect(result.length).toBe(2);
      expect(result.map((p) => p.subreddit).sort()).toEqual(["database", "postgresql"]);
    });

    it("deduplicates posts with the same ID", async () => {
      // Override mock to return same post ID from different subreddits
      server.use(
        http.get("https://oauth.reddit.com/r/:subreddit/search", () => {
          return HttpResponse.json({
            kind: "Listing",
            data: {
              after: null,
              children: [
                {
                  kind: "t3",
                  data: {
                    id: "same_post_id",
                    title: "Duplicate post",
                    selftext: "Body",
                    author: "author",
                    subreddit: "test",
                    permalink: "/r/test/comments/same_post_id/",
                    url: null,
                    created_utc: Math.floor(Date.now() / 1000) - 1800,
                    score: 1,
                    num_comments: 0,
                  },
                },
              ],
            },
          });
        })
      );

      const result = await fetchRedditPosts(
        ["postgresql", "database"],
        ["test"]
      );
      expect(result.length).toBe(1);
    });

    it("filters posts by time window", async () => {
      const now = Math.floor(Date.now() / 1000);
      server.use(
        http.get("https://oauth.reddit.com/r/:subreddit/search", () => {
          return HttpResponse.json({
            kind: "Listing",
            data: {
              after: null,
              children: [
                {
                  kind: "t3",
                  data: {
                    id: "recent_post",
                    title: "Recent post",
                    selftext: null,
                    author: "author",
                    subreddit: "test",
                    permalink: "/r/test/comments/recent/",
                    url: null,
                    created_utc: now - 1800, // 30 minutes ago
                    score: 10,
                    num_comments: 5,
                  },
                },
                {
                  kind: "t3",
                  data: {
                    id: "old_post",
                    title: "Old post",
                    selftext: null,
                    author: "author",
                    subreddit: "test",
                    permalink: "/r/test/comments/old/",
                    url: null,
                    created_utc: now - 7200, // 2 hours ago
                    score: 50,
                    num_comments: 20,
                  },
                },
              ],
            },
          });
        })
      );

      // Default window is 1 hour
      const result = await fetchRedditPosts(["test"], ["query"], 1);
      expect(result.length).toBe(1);
      expect(result[0]!.redditId).toBe("recent_post");
    });

    it("sorts results by creation time descending", async () => {
      const now = Math.floor(Date.now() / 1000);
      server.use(
        http.get("https://oauth.reddit.com/r/:subreddit/search", () => {
          return HttpResponse.json({
            kind: "Listing",
            data: {
              after: null,
              children: [
                {
                  kind: "t3",
                  data: {
                    id: "older",
                    title: "Older post",
                    selftext: null,
                    author: "author",
                    subreddit: "test",
                    permalink: "/r/test/1/",
                    url: null,
                    created_utc: now - 1800,
                    score: 1,
                    num_comments: 0,
                  },
                },
                {
                  kind: "t3",
                  data: {
                    id: "newer",
                    title: "Newer post",
                    selftext: null,
                    author: "author",
                    subreddit: "test",
                    permalink: "/r/test/2/",
                    url: null,
                    created_utc: now - 900, // 15 minutes ago
                    score: 5,
                    num_comments: 2,
                  },
                },
              ],
            },
          });
        })
      );

      const result = await fetchRedditPosts(["test"], ["query"]);
      expect(result.length).toBe(2);
      expect(result[0]!.redditId).toBe("newer");
      expect(result[1]!.redditId).toBe("older");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      process.env.REDDIT_CLIENT_ID = "test_id";
      process.env.REDDIT_CLIENT_SECRET = "test_secret";
      process.env.REDDIT_USERNAME = "test_user";
      process.env.REDDIT_PASSWORD = "test_pass";
    });

    it("handles API errors gracefully and continues with other subreddits", async () => {
      // Use 404 instead of 500 to avoid retry logic that causes timeout
      server.use(
        http.get("https://oauth.reddit.com/r/:subreddit/search", ({ params }) => {
          const subreddit = params.subreddit as string;

          // First subreddit fails with client error (no retries)
          if (subreddit === "failing") {
            return new HttpResponse(null, { status: 404 });
          }

          // Second subreddit succeeds
          return HttpResponse.json({
            kind: "Listing",
            data: {
              after: null,
              children: [
                {
                  kind: "t3",
                  data: {
                    id: "success_post",
                    title: "Success post",
                    selftext: null,
                    author: "author",
                    subreddit: subreddit,
                    permalink: "/r/test/",
                    url: null,
                    created_utc: Math.floor(Date.now() / 1000) - 1800,
                    score: 1,
                    num_comments: 0,
                  },
                },
              ],
            },
          });
        })
      );

      // Should not throw, and should return results from successful subreddit
      const result = await fetchRedditPosts(
        ["failing", "working"],
        ["query"]
      );
      expect(result.length).toBe(1);
      expect(result[0]!.subreddit).toBe("working");
    }, 10000);

    it("handles auth failure gracefully", async () => {
      // Clear the token cache to ensure we try to get a new token
      clearTokenCache();

      server.use(
        http.post("https://www.reddit.com/api/v1/access_token", () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      const result = await fetchRedditPosts(["test"], ["query"]);
      expect(result).toEqual([]);
    });
  });
});
