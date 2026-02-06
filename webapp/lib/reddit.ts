// Arctic Shift API client for fetching Reddit posts
// Uses the free, public Arctic Shift API — no authentication required
// https://arctic-shift.photon-reddit.com

const ARCTIC_SHIFT_BASE_URL =
  "https://arctic-shift.photon-reddit.com/api/posts/search";

// Default time window: 48 hours (accounts for ~36h data delay)
const DEFAULT_TIME_WINDOW_HOURS = 48;

// Rate limit tracking from response headers
let rateLimitRemaining: number | null = null;
let rateLimitReset: number | null = null; // Unix timestamp when limit resets

interface ArcticShiftPost {
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
  is_self: boolean;
}

interface ArcticShiftResponse {
  data: ArcticShiftPost[];
}

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
  isSelf: boolean;
}

/**
 * Reset rate limit state (for testing).
 */
export function resetRateLimitState(): void {
  rateLimitRemaining = null;
  rateLimitReset = null;
}

/**
 * Check rate limit headers and wait if necessary.
 * Arctic Shift returns X-RateLimit-Remaining and X-RateLimit-Reset headers.
 */
async function checkRateLimit(): Promise<void> {
  if (rateLimitRemaining !== null && rateLimitRemaining <= 1 && rateLimitReset !== null) {
    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = rateLimitReset - now;
    if (waitSeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    }
  }
}

/**
 * Update rate limit state from response headers.
 */
function updateRateLimitFromHeaders(headers: Headers): void {
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");

  if (remaining !== null) {
    rateLimitRemaining = parseInt(remaining, 10);
  }
  if (reset !== null) {
    rateLimitReset = parseInt(reset, 10);
  }
}

/**
 * Fetch with exponential backoff retry for transient errors.
 * Retries on 429 (rate limit) and 5xx (server error).
 * Throws on 4xx client errors (except 429).
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await checkRateLimit();
      const response = await fetch(url);

      updateRateLimitFromHeaders(response.headers);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Arctic Shift API error: ${response.status}`);
      }

      // Retry on 429 or 5xx with exponential backoff
      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Arctic Shift API error: ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed after retries");
}

/**
 * Build Arctic Shift search URL for a subreddit + search term combination.
 */
function buildSearchUrl(
  subreddit: string,
  query: string,
  afterTimestamp: number
): string {
  const url = new URL(ARCTIC_SHIFT_BASE_URL);
  url.searchParams.set("subreddit", subreddit);
  url.searchParams.set("query", query);
  url.searchParams.set("after", afterTimestamp.toString());
  url.searchParams.set("sort", "desc");
  url.searchParams.set("limit", "100");
  return url.toString();
}

/**
 * Parse a single Arctic Shift post into our FetchedPost format.
 * Prefixes reddit_id with t3_ per spec.
 */
function parsePost(post: ArcticShiftPost): FetchedPost {
  return {
    redditId: `t3_${post.id}`,
    title: post.title,
    body: post.selftext || null,
    author: post.author,
    subreddit: post.subreddit,
    permalink: post.permalink,
    url: post.url || null,
    redditCreatedAt: new Date(post.created_utc * 1000),
    score: post.score,
    numComments: post.num_comments,
    isSelf: post.is_self ?? false,
  };
}

/**
 * Fetch Reddit posts from Arctic Shift API.
 *
 * Searches configured subreddits for posts matching search terms
 * within a time window. No authentication required.
 *
 * @param subreddits - List of subreddit names (without r/ prefix)
 * @param searchTerms - List of search terms to match
 * @param timeWindowHours - How far back to search (default: 48 hours)
 * @returns Deduplicated, sorted list of fetched posts
 */
export async function fetchRedditPosts(
  subreddits: string[],
  searchTerms: string[],
  timeWindowHours = DEFAULT_TIME_WINDOW_HOURS
): Promise<FetchedPost[]> {
  if (subreddits.length === 0 || searchTerms.length === 0) {
    return [];
  }

  const posts: FetchedPost[] = [];
  const seenIds = new Set<string>();

  // Calculate time threshold as Unix timestamp
  const afterTimestamp = Math.floor(Date.now() / 1000) - timeWindowHours * 60 * 60;

  // For each subreddit + search term combination, make one request
  for (const subreddit of subreddits) {
    for (const term of searchTerms) {
      try {
        const url = buildSearchUrl(subreddit, term, afterTimestamp);
        const response = await fetchWithRetry(url);
        const data = (await response.json()) as ArcticShiftResponse;

        if (!data.data || !Array.isArray(data.data)) {
          continue;
        }

        for (const rawPost of data.data) {
          const postId = `t3_${rawPost.id}`;

          // Deduplicate by reddit_id
          if (seenIds.has(postId)) {
            continue;
          }

          seenIds.add(postId);
          posts.push(parsePost(rawPost));
        }
      } catch (error) {
        console.error(
          `Error fetching from Arctic Shift for r/${subreddit} term="${term}":`,
          error
        );
        // Continue with other subreddit+term combinations
      }
    }
  }

  // Sort by Reddit creation time, newest first
  posts.sort((a, b) => b.redditCreatedAt.getTime() - a.redditCreatedAt.getTime());

  return posts;
}
