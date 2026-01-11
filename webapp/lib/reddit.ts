// Reddit API client with OAuth2 authentication
// Handles token acquisition, rate limiting, and post fetching

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string | null;
  author: string;
  subreddit: string;
  permalink: string;
  url: string | null;
  created_utc: number;
  score: number;
  num_comments: number;
}

interface RedditListingChild {
  kind: string;
  data: RedditPost;
}

interface RedditListingResponse {
  kind: string;
  data: {
    after: string | null;
    children: RedditListingChild[];
  };
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

// Rate limiting: 60 requests per minute
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000; // 1 minute in ms
const requestTimestamps: number[] = [];

// Check if Reddit API credentials are configured
export function isRedditConfigured(): boolean {
  return !!(
    process.env.REDDIT_CLIENT_ID &&
    process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USERNAME &&
    process.env.REDDIT_PASSWORD
  );
}

// Acquire OAuth2 token from Reddit
async function getAccessToken(): Promise<string | null> {
  if (!isRedditConfigured()) {
    console.warn("Reddit API credentials not configured");
    return null;
  }

  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  const username = process.env.REDDIT_USERNAME!;
  const password = process.env.REDDIT_PASSWORD!;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SocialTracker/1.0 (by /u/" + username + ")",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  if (!response.ok) {
    console.error("Failed to get Reddit access token:", response.status);
    return null;
  }

  const data = (await response.json()) as RedditTokenResponse;

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// Rate limiting helper
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();

  // Remove timestamps outside the rate window
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < now - RATE_WINDOW) {
    requestTimestamps.shift();
  }

  // If at rate limit, wait until oldest request falls outside window
  if (requestTimestamps.length >= RATE_LIMIT) {
    const oldestTimestamp = requestTimestamps[0]!;
    const waitTime = oldestTimestamp + RATE_WINDOW - now + 100; // 100ms buffer
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  requestTimestamps.push(Date.now());
}

// Retry with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await waitForRateLimit();
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Reddit API error: ${response.status}`);
      }

      // For 429 or server errors, retry with backoff
      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Reddit API error: ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed after retries");
}

// Fetch posts from Reddit matching search criteria
export interface FetchedPost {
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
}

export async function fetchRedditPosts(
  subreddits: string[],
  searchTerms: string[],
  timeWindowHours = 1
): Promise<FetchedPost[]> {
  if (!isRedditConfigured()) {
    console.warn("Reddit API not configured, returning empty results");
    return [];
  }

  const token = await getAccessToken();
  if (!token) {
    return [];
  }

  const posts: FetchedPost[] = [];
  const seenIds = new Set<string>();

  // Calculate time threshold
  const minCreatedAt = Date.now() / 1000 - timeWindowHours * 60 * 60;

  // Build search query from terms
  const query = searchTerms.join(" OR ");
  if (!query) {
    return [];
  }

  for (const subreddit of subreddits) {
    try {
      const url = new URL(`https://oauth.reddit.com/r/${subreddit}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("restrict_sr", "on");
      url.searchParams.set("sort", "new");
      url.searchParams.set("t", "day"); // Search within last day, we'll filter by time
      url.searchParams.set("limit", "100");

      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": `SocialTracker/1.0 (by /u/${process.env.REDDIT_USERNAME})`,
        },
      });

      const data = (await response.json()) as RedditListingResponse;

      for (const child of data.data.children) {
        const post = child.data;

        // Skip if already seen or too old
        if (seenIds.has(post.id) || post.created_utc < minCreatedAt) {
          continue;
        }

        seenIds.add(post.id);
        posts.push({
          redditId: post.id,
          title: post.title,
          body: post.selftext || null,
          author: post.author,
          subreddit: post.subreddit,
          permalink: post.permalink,
          url: post.url || null,
          redditCreatedAt: new Date(post.created_utc * 1000),
          score: post.score,
          numComments: post.num_comments,
        });
      }
    } catch (error) {
      console.error(`Error fetching from r/${subreddit}:`, error);
      // Continue with other subreddits
    }
  }

  // Sort by Reddit creation time, newest first
  posts.sort((a, b) => b.redditCreatedAt.getTime() - a.redditCreatedAt.getTime());

  return posts;
}
