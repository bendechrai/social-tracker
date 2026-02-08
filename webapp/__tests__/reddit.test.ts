/**
 * Unit tests for Arctic Shift API client.
 *
 * These tests verify that the Arctic Shift client correctly:
 * - Builds correct API URLs with parameters
 * - Parses response and extracts all required fields
 * - Deduplicates posts by reddit_id
 * - Handles API errors gracefully (5xx, network errors)
 * - Respects rate limit headers
 * - Returns empty results for empty inputs
 * - Sorts results by creation time
 * - Accepts per-subreddit timestamps
 *
 * Uses MSW to mock Arctic Shift API endpoints.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { fetchRedditPosts, fetchRedditComments, resetRateLimitState, verifySubredditExists } from "@/lib/reddit";

/** Helper: build a Map from subreddit names using a shared after-timestamp. */
function toMap(subreddits: string[], afterTimestamp?: number): Map<string, number> {
  const ts = afterTimestamp ?? Math.floor(Date.now() / 1000) - 48 * 60 * 60;
  return new Map(subreddits.map((s) => [s, ts]));
}

describe("fetchRedditPosts", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  describe("input validation", () => {
    it("returns empty array when no subreddits provided", async () => {
      const result = await fetchRedditPosts(new Map());
      expect(result).toEqual([]);
    });
  });

  describe("API URL construction", () => {
    it("builds correct Arctic Shift API URL with parameters", async () => {
      let capturedUrl = "";
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ data: [] });
          }
        )
      );

      const afterTs = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
      await fetchRedditPosts(new Map([["postgresql", afterTs]]));

      const url = new URL(capturedUrl);
      expect(url.searchParams.get("subreddit")).toBe("postgresql");
      expect(url.searchParams.has("query")).toBe(false);
      expect(url.searchParams.get("sort")).toBe("desc");
      expect(url.searchParams.get("limit")).toBe("auto");
      // after should match the provided timestamp
      const capturedAfterTs = parseInt(url.searchParams.get("after")!);
      expect(capturedAfterTs).toBe(afterTs);
    });

    it("makes one request per subreddit", async () => {
      const requests: string[] = [];
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            const url = new URL(request.url);
            requests.push(url.searchParams.get("subreddit")!);
            return HttpResponse.json({ data: [] });
          }
        )
      );

      await fetchRedditPosts(toMap(["sub1", "sub2"]));

      expect(requests).toEqual(["sub1", "sub2"]);
    });
  });

  describe("response parsing", () => {
    it("fetches posts from Arctic Shift API", async () => {
      const result = await fetchRedditPosts(toMap(["postgresql"]));
      expect(result.length).toBeGreaterThan(0);
    });

    it("correctly parses and extracts all required post fields", async () => {
      const now = Math.floor(Date.now() / 1000);
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "abc123",
                  title: "Test Post Title",
                  selftext: "Test body content",
                  author: "test_author",
                  subreddit: "postgresql",
                  permalink: "/r/postgresql/comments/abc123/test_post/",
                  url: "https://example.com",
                  created_utc: now - 3600,
                  score: 42,
                  num_comments: 7,
                  is_self: false,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["postgresql"]));
      expect(result.length).toBe(1);

      const post = result[0]!;
      expect(post.redditId).toBe("t3_abc123");
      expect(post.title).toBe("Test Post Title");
      expect(post.body).toBe("Test body content");
      expect(post.author).toBe("test_author");
      expect(post.subreddit).toBe("postgresql");
      expect(post.permalink).toBe("/r/postgresql/comments/abc123/test_post/");
      expect(post.url).toBe("https://example.com");
      expect(post.redditCreatedAt).toBeInstanceOf(Date);
      expect(post.score).toBe(42);
      expect(post.numComments).toBe(7);
      expect(post.isSelf).toBe(false);
    });

    it("prefixes reddit_id with t3_", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "xyz789",
                  title: "Post",
                  selftext: null,
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/comments/xyz789/",
                  url: null,
                  created_utc: Math.floor(Date.now() / 1000) - 1800,
                  score: 1,
                  num_comments: 0,
                  is_self: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result[0]!.redditId).toBe("t3_xyz789");
    });

    it("handles null selftext as null body", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "nullbody",
                  title: "Link Post",
                  selftext: null,
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/comments/nullbody/",
                  url: "https://example.com",
                  created_utc: Math.floor(Date.now() / 1000) - 1800,
                  score: 5,
                  num_comments: 2,
                  is_self: false,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result[0]!.body).toBeNull();
    });

    it("handles empty string selftext as null body", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "emptybody",
                  title: "Empty Body",
                  selftext: "",
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/comments/emptybody/",
                  url: null,
                  created_utc: Math.floor(Date.now() / 1000) - 1800,
                  score: 1,
                  num_comments: 0,
                  is_self: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result[0]!.body).toBeNull();
    });

    it("maps over_18: true to isNsfw: true on fetched post", async () => {
      const now = Math.floor(Date.now() / 1000);
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "nsfw_post",
                  title: "NSFW Post",
                  selftext: "nsfw content",
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/comments/nsfw_post/",
                  url: null,
                  created_utc: now - 1800,
                  score: 5,
                  num_comments: 1,
                  is_self: true,
                  over_18: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result[0]!.isNsfw).toBe(true);
    });

    it("maps over_18: false to isNsfw: false on fetched post", async () => {
      const now = Math.floor(Date.now() / 1000);
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "sfw_post",
                  title: "SFW Post",
                  selftext: "safe content",
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/comments/sfw_post/",
                  url: null,
                  created_utc: now - 1800,
                  score: 3,
                  num_comments: 0,
                  is_self: true,
                  over_18: false,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result[0]!.isNsfw).toBe(false);
    });

    it("handles missing data array gracefully", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({});
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result).toEqual([]);
    });
  });

  describe("multiple subreddits", () => {
    it("fetches from multiple subreddits", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            const url = new URL(request.url);
            const subreddit = url.searchParams.get("subreddit")!;
            return HttpResponse.json({
              data: [
                {
                  id: `post_${subreddit}`,
                  title: `Post from r/${subreddit}`,
                  selftext: "Test body",
                  author: "test_author",
                  subreddit: subreddit,
                  permalink: `/r/${subreddit}/comments/test/`,
                  url: null,
                  created_utc: Math.floor(Date.now() / 1000) - 1800,
                  score: 10,
                  num_comments: 5,
                  is_self: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["postgresql", "database"]));
      expect(result.length).toBe(2);
      expect(result.map((p) => p.subreddit).sort()).toEqual([
        "database",
        "postgresql",
      ]);
    });
  });

  describe("deduplication", () => {
    it("deduplicates posts with the same ID across subreddits", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
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
                  is_self: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["postgresql", "database"]));
      expect(result.length).toBe(1);
    });

  });

  describe("sorting", () => {
    it("sorts results by creation time descending", async () => {
      const now = Math.floor(Date.now() / 1000);
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json({
              data: [
                {
                  id: "older",
                  title: "Older post",
                  selftext: null,
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/1/",
                  url: null,
                  created_utc: now - 3600,
                  score: 1,
                  num_comments: 0,
                  is_self: true,
                },
                {
                  id: "newer",
                  title: "Newer post",
                  selftext: null,
                  author: "author",
                  subreddit: "test",
                  permalink: "/r/test/2/",
                  url: null,
                  created_utc: now - 900,
                  score: 5,
                  num_comments: 2,
                  is_self: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result.length).toBe(2);
      expect(result[0]!.redditId).toBe("t3_newer");
      expect(result[1]!.redditId).toBe("t3_older");
    });
  });

  describe("error handling", () => {
    it("handles API errors gracefully and continues with other combinations", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            const url = new URL(request.url);
            const subreddit = url.searchParams.get("subreddit");

            // First subreddit fails with client error (no retries)
            if (subreddit === "failing") {
              return new HttpResponse(null, { status: 404 });
            }

            // Second subreddit succeeds
            return HttpResponse.json({
              data: [
                {
                  id: "success_post",
                  title: "Success post",
                  selftext: null,
                  author: "author",
                  subreddit: subreddit!,
                  permalink: "/r/test/",
                  url: null,
                  created_utc: Math.floor(Date.now() / 1000) - 1800,
                  score: 1,
                  num_comments: 0,
                  is_self: true,
                },
              ],
            });
          }
        )
      );

      const result = await fetchRedditPosts(toMap(["failing", "working"]));
      expect(result.length).toBe(1);
      expect(result[0]!.subreddit).toBe("working");
    }, 15000);

    it("handles network errors gracefully", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.error();
          }
        )
      );

      // Should not throw
      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result).toEqual([]);
    }, 15000);

    it("does not require any authentication", async () => {
      let requestHeaders: Headers | null = null;
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            requestHeaders = new Headers(request.headers);
            return HttpResponse.json({ data: [] });
          }
        )
      );

      await fetchRedditPosts(toMap(["test"]));

      // No Authorization header should be sent
      expect(requestHeaders!.get("Authorization")).toBeNull();
    });
  });

  describe("rate limiting", () => {
    it("reads rate limit headers from response", async () => {
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          () => {
            return HttpResponse.json(
              { data: [] },
              {
                headers: {
                  "X-RateLimit-Remaining": "50",
                  "X-RateLimit-Reset": String(
                    Math.floor(Date.now() / 1000) + 60
                  ),
                },
              }
            );
          }
        )
      );

      // Should succeed without issues
      const result = await fetchRedditPosts(toMap(["test"]));
      expect(result).toEqual([]);
    });
  });

  describe("per-subreddit timestamps", () => {
    it("uses the provided after-timestamp for each subreddit", async () => {
      let capturedAfter = "";
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            const url = new URL(request.url);
            capturedAfter = url.searchParams.get("after")!;
            return HttpResponse.json({ data: [] });
          }
        )
      );

      const specificTs = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
      await fetchRedditPosts(new Map([["test", specificTs]]));

      const afterTs = parseInt(capturedAfter);
      expect(afterTs).toBe(specificTs);
    });

    it("uses different after-timestamps for different subreddits", async () => {
      const capturedTimestamps = new Map<string, number>();
      server.use(
        http.get(
          "https://arctic-shift.photon-reddit.com/api/posts/search",
          ({ request }) => {
            const url = new URL(request.url);
            const subreddit = url.searchParams.get("subreddit")!;
            const after = parseInt(url.searchParams.get("after")!);
            capturedTimestamps.set(subreddit, after);
            return HttpResponse.json({ data: [] });
          }
        )
      );

      const now = Math.floor(Date.now() / 1000);
      const recentTs = now - 3600; // 1 hour ago (subreddit with recent posts)
      const oldTs = now - 7 * 24 * 60 * 60; // 7 days ago (initial backfill)

      await fetchRedditPosts(new Map([
        ["postgresql", recentTs],
        ["database", oldTs],
      ]));

      expect(capturedTimestamps.get("postgresql")).toBe(recentTs);
      expect(capturedTimestamps.get("database")).toBe(oldTs);
    });
  });
});

describe("fetchRedditComments", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("fetches comments for a post and returns parsed results", async () => {
    const now = Math.floor(Date.now() / 1000);
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/comments/search",
        () => {
          return HttpResponse.json({
            data: [
              {
                id: "comment1",
                link_id: "post1",
                parent_id: "post1",
                author: "user1",
                body: "Great post!",
                score: 15,
                created_utc: now - 1800,
              },
              {
                id: "comment2",
                link_id: "post1",
                parent_id: "t1_comment1",
                author: "user2",
                body: "I agree!",
                score: 5,
                created_utc: now - 900,
              },
            ],
          });
        }
      )
    );

    const result = await fetchRedditComments("t3_post1");
    expect(result.length).toBe(2);

    expect(result[0]!.redditId).toBe("t1_comment1");
    expect(result[0]!.postRedditId).toBe("t3_post1");
    expect(result[0]!.parentRedditId).toBeNull(); // top-level
    expect(result[0]!.author).toBe("user1");
    expect(result[0]!.body).toBe("Great post!");
    expect(result[0]!.score).toBe(15);

    expect(result[1]!.redditId).toBe("t1_comment2");
    expect(result[1]!.parentRedditId).toBe("t1_comment1"); // reply
  });

  it("strips t3_ prefix for API query parameter", async () => {
    let capturedUrl = "";
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/comments/search",
        ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [] });
        }
      )
    );

    await fetchRedditComments("t3_abc123");

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("link_id")).toBe("abc123");
  });

  it("limits to 50 comments by default", async () => {
    let capturedUrl = "";
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/comments/search",
        ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [] });
        }
      )
    );

    await fetchRedditComments("t3_test");

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("handles API errors gracefully and returns empty array", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/comments/search",
        () => {
          return new HttpResponse(null, { status: 404 });
        }
      )
    );

    const result = await fetchRedditComments("t3_test");
    expect(result).toEqual([]);
  }, 15000);

  it("handles missing data array gracefully", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/comments/search",
        () => {
          return HttpResponse.json({});
        }
      )
    );

    const result = await fetchRedditComments("t3_test");
    expect(result).toEqual([]);
  });

  it("handles top-level comments (parent_id equals link_id)", async () => {
    const now = Math.floor(Date.now() / 1000);
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/comments/search",
        () => {
          return HttpResponse.json({
            data: [
              {
                id: "toplevel",
                link_id: "mypost",
                parent_id: "mypost",
                author: "author",
                body: "Top comment",
                score: 10,
                created_utc: now - 1000,
              },
            ],
          });
        }
      )
    );

    const result = await fetchRedditComments("t3_mypost");
    expect(result[0]!.parentRedditId).toBeNull();
  });
});

describe("verifySubredditExists", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("returns true when subreddit has posts", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/posts/search",
        () => {
          return HttpResponse.json({
            data: [
              {
                id: "existing_post",
                title: "A post",
                selftext: null,
                author: "user",
                subreddit: "postgresql",
                permalink: "/r/postgresql/comments/existing_post/",
                url: null,
                created_utc: Math.floor(Date.now() / 1000) - 3600,
                score: 1,
                num_comments: 0,
                is_self: true,
              },
            ],
          });
        }
      )
    );

    const result = await verifySubredditExists("postgresql");
    expect(result).toBe(true);
  });

  it("returns false when subreddit has no posts (nonexistent)", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/posts/search",
        () => {
          return HttpResponse.json({ data: [] });
        }
      )
    );

    const result = await verifySubredditExists("nonexistent_sub");
    expect(result).toBe(false);
  });

  it("returns true on API failure (skips verification gracefully)", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/posts/search",
        () => {
          return new HttpResponse(null, { status: 404 });
        }
      )
    );

    const result = await verifySubredditExists("any_sub");
    expect(result).toBe(true);
  }, 15000);

  it("returns true on network error (skips verification gracefully)", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/posts/search",
        () => {
          return HttpResponse.error();
        }
      )
    );

    const result = await verifySubredditExists("any_sub");
    expect(result).toBe(true);
  }, 15000);

  it("returns true when API returns unexpected format", async () => {
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/posts/search",
        () => {
          return HttpResponse.json({ unexpected: "format" });
        }
      )
    );

    const result = await verifySubredditExists("any_sub");
    expect(result).toBe(true);
  });

  it("sends correct query parameters", async () => {
    let capturedUrl = "";
    server.use(
      http.get(
        "https://arctic-shift.photon-reddit.com/api/posts/search",
        ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [] });
        }
      )
    );

    await verifySubredditExists("testsubreddit");

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("subreddit")).toBe("testsubreddit");
    expect(url.searchParams.get("limit")).toBe("1");
  });
});
