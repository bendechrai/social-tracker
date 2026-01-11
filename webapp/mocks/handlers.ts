import { http, HttpResponse } from "msw";

// Reddit API mock handlers
export const handlers = [
  // Mock Reddit OAuth token endpoint
  http.post("https://www.reddit.com/api/v1/access_token", () => {
    return HttpResponse.json({
      access_token: "mock_access_token",
      token_type: "bearer",
      expires_in: 86400,
      scope: "read",
    });
  }),

  // Mock Reddit search endpoint
  http.get("https://oauth.reddit.com/r/:subreddit/search", ({ params }) => {
    const subreddit = params.subreddit;
    return HttpResponse.json({
      kind: "Listing",
      data: {
        after: null,
        children: [
          {
            kind: "t3",
            data: {
              id: "mock_post_1",
              title: `Mock post in r/${subreddit}`,
              selftext: "This is a mock post body for testing purposes.",
              author: "mock_user",
              subreddit: subreddit,
              permalink: `/r/${subreddit}/comments/mock_post_1/mock_post/`,
              url: `https://reddit.com/r/${subreddit}/comments/mock_post_1/mock_post/`,
              created_utc: Math.floor(Date.now() / 1000) - 3600,
              score: 42,
              num_comments: 10,
            },
          },
        ],
      },
    });
  }),
];
