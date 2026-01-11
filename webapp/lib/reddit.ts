// Reddit API client with OAuth2 authentication
// Handles token acquisition, rate limiting, and post fetching
// Supports per-user OAuth tokens with fallback to app-level credentials

import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { decrypt, encrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
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

interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  username: string;
}

// Token cache for app-level credentials (backward compatibility)
let cachedToken: { token: string; expiresAt: number } | null = null;

// Clear token cache (for testing)
export function clearTokenCache(): void {
  cachedToken = null;
}

// Rate limiting: 60 requests per minute
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000; // 1 minute in ms
const requestTimestamps: number[] = [];

// Check if Reddit app-level credentials are configured (for fallback)
export function isRedditConfigured(): boolean {
  return !!(
    process.env.REDDIT_CLIENT_ID &&
    process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USERNAME &&
    process.env.REDDIT_PASSWORD
  );
}

// Check if Reddit OAuth app credentials are configured
export function isRedditOAuthConfigured(): boolean {
  return !!(
    process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET
  );
}

/**
 * Get user's Reddit tokens from the database.
 * Returns null if user has no connected Reddit account.
 */
async function getUserTokens(userId: string): Promise<UserTokens | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      redditAccessToken: true,
      redditRefreshToken: true,
      redditTokenExpiresAt: true,
      redditUsername: true,
    },
  });

  if (
    !user?.redditAccessToken ||
    !user?.redditRefreshToken ||
    !user?.redditUsername
  ) {
    return null;
  }

  try {
    return {
      accessToken: decrypt(user.redditAccessToken),
      refreshToken: decrypt(user.redditRefreshToken),
      expiresAt: user.redditTokenExpiresAt ?? new Date(0),
      username: user.redditUsername,
    };
  } catch (error) {
    console.error("Error decrypting Reddit tokens:", error);
    return null;
  }
}

/**
 * Refresh user's Reddit access token using refresh token.
 * Updates the database with new tokens.
 */
async function refreshUserToken(
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Reddit OAuth credentials not configured");
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SocialTracker/1.0",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    console.error("Failed to refresh Reddit token:", response.status);
    return null;
  }

  const data = (await response.json()) as RedditTokenResponse;

  // Calculate new expiration time
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Encrypt tokens before storage
  const encryptedAccessToken = encrypt(data.access_token);
  // Reddit may or may not return a new refresh token
  const encryptedRefreshToken = data.refresh_token
    ? encrypt(data.refresh_token)
    : encrypt(refreshToken);

  // Update database
  await db
    .update(users)
    .set({
      redditAccessToken: encryptedAccessToken,
      redditRefreshToken: encryptedRefreshToken,
      redditTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return data.access_token;
}

/**
 * Get a valid access token for the user.
 * Refreshes if expired.
 */
async function getUserAccessToken(userId: string): Promise<{
  token: string;
  username: string;
} | null> {
  const tokens = await getUserTokens(userId);
  if (!tokens) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = tokens.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired) {
    const newToken = await refreshUserToken(userId, tokens.refreshToken);
    if (!newToken) {
      return null;
    }
    return { token: newToken, username: tokens.username };
  }

  return { token: tokens.accessToken, username: tokens.username };
}

// Acquire OAuth2 token from Reddit using app-level credentials (fallback)
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

  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  });

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SocialTracker/1.0 (by /u/" + username + ")",
    },
    body: body.toString(),
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

/**
 * Fetch Reddit posts for a specific user.
 * Uses the user's OAuth tokens if connected, or falls back to app-level credentials.
 *
 * @param userId - The user's ID to fetch tokens for
 * @param subreddits - List of subreddits to search
 * @param searchTerms - List of search terms to match
 * @param timeWindowHours - How far back to search (default: 1 hour)
 */
export async function fetchRedditPostsForUser(
  userId: string,
  subreddits: string[],
  searchTerms: string[],
  timeWindowHours = 1
): Promise<FetchedPost[]> {
  // Try user's OAuth tokens first
  const userAuth = await getUserAccessToken(userId);

  if (userAuth) {
    return fetchPostsWithToken(
      userAuth.token,
      userAuth.username,
      subreddits,
      searchTerms,
      timeWindowHours
    );
  }

  // Fall back to app-level credentials if available
  if (isRedditConfigured()) {
    const token = await getAccessToken();
    if (token) {
      return fetchPostsWithToken(
        token,
        process.env.REDDIT_USERNAME!,
        subreddits,
        searchTerms,
        timeWindowHours
      );
    }
  }

  console.warn("No Reddit authentication available for user", userId);
  return [];
}

/**
 * Fetch Reddit posts using app-level credentials (backward compatibility).
 * @deprecated Use fetchRedditPostsForUser with userId instead.
 */
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

  return fetchPostsWithToken(
    token,
    process.env.REDDIT_USERNAME!,
    subreddits,
    searchTerms,
    timeWindowHours
  );
}

/**
 * Internal function to fetch posts with a given token and username.
 */
async function fetchPostsWithToken(
  token: string,
  username: string,
  subreddits: string[],
  searchTerms: string[],
  timeWindowHours: number
): Promise<FetchedPost[]> {
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
          "User-Agent": `SocialTracker/1.0 (by /u/${username})`,
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

/**
 * Check if a user has Reddit connected.
 */
export async function isUserRedditConnected(userId: string): Promise<boolean> {
  const tokens = await getUserTokens(userId);
  return tokens !== null;
}
