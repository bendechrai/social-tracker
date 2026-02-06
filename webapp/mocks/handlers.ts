import { http, HttpResponse } from "msw";

// Arctic Shift API mock handlers
export const handlers = [
  // Mock Arctic Shift post search endpoint
  http.get(
    "https://arctic-shift.photon-reddit.com/api/posts/search",
    ({ request }) => {
      const url = new URL(request.url);
      const subreddit = url.searchParams.get("subreddit") ?? "unknown";

      return HttpResponse.json(
        {
          data: [
            {
              id: "mock_post_1",
              title: `Mock post in r/${subreddit}`,
              selftext:
                "This is a mock post body for testing purposes.",
              author: "mock_user",
              subreddit: subreddit,
              permalink: `/r/${subreddit}/comments/mock_post_1/mock_post/`,
              url: `https://reddit.com/r/${subreddit}/comments/mock_post_1/mock_post/`,
              created_utc: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
              score: 42,
              num_comments: 10,
              is_self: false,
            },
          ],
        },
        {
          headers: {
            "X-RateLimit-Remaining": "99",
            "X-RateLimit-Reset": String(
              Math.floor(Date.now() / 1000) + 60
            ),
          },
        }
      );
    }
  ),
];
