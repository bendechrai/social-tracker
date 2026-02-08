// Arctic Shift API client for fetching Reddit posts
// Uses the free, public Arctic Shift API — no authentication required
// https://arctic-shift.photon-reddit.com

const ARCTIC_SHIFT_POSTS_URL =
  "https://arctic-shift.photon-reddit.com/api/posts/search";
const ARCTIC_SHIFT_COMMENTS_URL =
  "https://arctic-shift.photon-reddit.com/api/comments/search";

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
  over_18: boolean;
}

interface ArcticShiftResponse {
  data: ArcticShiftPost[];
}

interface ArcticShiftComment {
  id: string;
  link_id: string;
  parent_id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
}

export interface FetchedComment {
  redditId: string;
  postRedditId: string;
  parentRedditId: string | null;
  author: string;
  body: string;
  score: number;
  redditCreatedAt: Date;
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
  isNsfw: boolean;
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
 * Build Arctic Shift search URL for all recent posts in a subreddit.
 */
function buildSearchUrl(
  subreddit: string,
  afterTimestamp: number
): string {
  const url = new URL(ARCTIC_SHIFT_POSTS_URL);
  url.searchParams.set("subreddit", subreddit);
  url.searchParams.set("after", afterTimestamp.toString());
  url.searchParams.set("sort", "desc");
  url.searchParams.set("limit", "auto");
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
    isNsfw: post.over_18 ?? false,
  };
}

/**
 * Fetch all recent Reddit posts from Arctic Shift API.
 *
 * Fetches all posts from configured subreddits, each with its own
 * `after` timestamp for incremental fetching. One API call per
 * subreddit (no query filtering). Tag matching is done locally by
 * the caller. No authentication required.
 *
 * @param subredditTimestamps - Map of subreddit name → Unix after-timestamp (seconds)
 * @returns Deduplicated, sorted list of fetched posts
 */
export async function fetchRedditPosts(
  subredditTimestamps: Map<string, number>
): Promise<FetchedPost[]> {
  if (subredditTimestamps.size === 0) {
    return [];
  }

  const posts: FetchedPost[] = [];
  const seenIds = new Set<string>();

  // One request per subreddit — fetch posts newer than its after-timestamp
  for (const [subreddit, afterTimestamp] of subredditTimestamps) {
    try {
      const url = buildSearchUrl(subreddit, afterTimestamp);
      const response = await fetchWithRetry(url);
      const data = (await response.json()) as ArcticShiftResponse;

      if (!data.data || !Array.isArray(data.data)) {
        continue;
      }

      for (const rawPost of data.data) {
        const postId = `t3_${rawPost.id}`;

        // Deduplicate by reddit_id (handles cross-posts across subreddits)
        if (seenIds.has(postId)) {
          continue;
        }

        seenIds.add(postId);
        posts.push(parsePost(rawPost));
      }
    } catch (error) {
      console.error(
        `Error fetching from Arctic Shift for r/${subreddit}:`,
        error
      );
      // Continue with other subreddits
    }
  }

  // Sort by Reddit creation time, newest first
  posts.sort((a, b) => b.redditCreatedAt.getTime() - a.redditCreatedAt.getTime());

  return posts;
}

/**
 * Parse a single Arctic Shift comment into our FetchedComment format.
 * Prefixes reddit_id with t1_ and link_id/parent_id as appropriate.
 */
function parseComment(comment: ArcticShiftComment): FetchedComment {
  const redditId = comment.id.startsWith("t1_")
    ? comment.id
    : `t1_${comment.id}`;
  const postRedditId = comment.link_id.startsWith("t3_")
    ? comment.link_id
    : `t3_${comment.link_id}`;

  // parent_id can be a post (t3_) or comment (t1_).
  // If parent_id equals link_id it's a top-level comment → null.
  let parentRedditId: string | null = null;
  if (comment.parent_id && comment.parent_id !== comment.link_id) {
    parentRedditId = comment.parent_id.startsWith("t1_")
      ? comment.parent_id
      : `t1_${comment.parent_id}`;
  }

  return {
    redditId,
    postRedditId,
    parentRedditId,
    author: comment.author,
    body: comment.body ?? "",
    score: comment.score ?? 0,
    redditCreatedAt: new Date(comment.created_utc * 1000),
  };
}

/**
 * Fetch top comments for a single post from Arctic Shift.
 *
 * @param postRedditId - Reddit post ID (with t3_ prefix, e.g. "t3_abc123")
 * @param limit - Maximum number of comments to fetch (default 50)
 * @returns Array of parsed comments, sorted by score descending
 */
export async function fetchRedditComments(
  postRedditId: string,
  limit = 50
): Promise<FetchedComment[]> {
  try {
    // Strip t3_ prefix for the Arctic Shift API query
    const linkId = postRedditId.startsWith("t3_")
      ? postRedditId.slice(3)
      : postRedditId;

    const url = new URL(ARCTIC_SHIFT_COMMENTS_URL);
    url.searchParams.set("link_id", linkId);
    url.searchParams.set("limit", String(limit));

    const response = await fetchWithRetry(url.toString());
    const data = (await response.json()) as { data?: ArcticShiftComment[] };

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    // Sort by score descending (client-side — Arctic Shift only supports sort_type=created_utc)
    return data.data.map(parseComment).sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error(
      `Error fetching comments for ${postRedditId} from Arctic Shift:`,
      error
    );
    return [];
  }
}

/**
 * Verify a subreddit exists by checking if Arctic Shift has any posts from it.
 * Searches for at least one post in the subreddit to confirm its existence.
 *
 * Returns true if the subreddit exists, false if it doesn't.
 * On API errors, returns true to skip verification gracefully
 * (prevents blocking users due to API downtime).
 */
export async function verifySubredditExists(
  subredditName: string
): Promise<boolean> {
  try {
    const url = new URL(ARCTIC_SHIFT_POSTS_URL);
    url.searchParams.set("subreddit", subredditName);
    url.searchParams.set("limit", "1");

    const response = await fetchWithRetry(url.toString());
    const data = (await response.json()) as ArcticShiftResponse;

    if (!data.data || !Array.isArray(data.data)) {
      // API returned unexpected format — skip verification gracefully
      return true;
    }

    return data.data.length > 0;
  } catch {
    // API failure — skip verification gracefully so users aren't blocked
    console.error(
      `Failed to verify subreddit "${subredditName}" via Arctic Shift, skipping verification`
    );
    return true;
  }
}
