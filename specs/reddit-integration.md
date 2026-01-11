# Reddit Integration

Connect to the Reddit API using per-user OAuth to fetch posts matching configured search criteria.

## Overview

Each user connects their own Reddit account via OAuth. Posts are fetched from configured subreddits matching search terms within a configurable time window. Users without a connected Reddit account cannot fetch posts.

## Authentication

### OAuth Flow (per-user)

Users connect their Reddit account in Settings. See `authentication.md` for full OAuth flow details.

Required scopes: `read`, `identity`

### App-Level Credentials

The application needs Reddit OAuth app credentials (not user credentials):

- `REDDIT_CLIENT_ID` - From reddit.com/prefs/apps
- `REDDIT_CLIENT_SECRET` - From reddit.com/prefs/apps

These are used for the OAuth flow, not for API calls. API calls use the user's access token.

### Token Management

- Access tokens stored encrypted in `users.reddit_access_token`
- Refresh tokens stored encrypted in `users.reddit_refresh_token`
- Expiry tracked in `users.reddit_token_expires_at`
- Auto-refresh when expired (before API call)

## Fetching Posts

- Search configured subreddits for posts matching search terms
- Default time window: posts from the last hour
- Time window is configurable per-fetch
- Use Reddit's search API: `GET /r/{subreddit}/search`
- Query parameters:
  - `q` - search query (the search term)
  - `restrict_sr` - restrict to subreddit (true)
  - `sort` - relevance or new (prefer "new")
  - `t` - time filter (hour, day, week)
  - `limit` - max results per request (max 100)

### Authorization Header

All API calls include the user's access token:
```
Authorization: Bearer {user_access_token}
```

### User-Agent

Must follow Reddit API rules:
```
User-Agent: web:socialtracker:1.0.0 (by /u/{reddit_username})
```

Use the connected user's Reddit username in the User-Agent.

## Rate Limiting

- Reddit allows 60 requests per minute for OAuth clients
- Implement rate limiting with exponential backoff
- Track request count and reset window per user
- Log warnings when approaching limits

## Data Extraction

For each post, extract:
- `reddit_id` - Reddit's unique identifier (t3_xxxxx)
- `title` - Post title
- `selftext` - Post body (may be empty for link posts)
- `author` - Reddit username
- `subreddit` - Subreddit name (without r/)
- `permalink` - Relative URL to post
- `url` - Link URL (for link posts) or permalink (for self posts)
- `created_utc` - Unix timestamp of post creation
- `score` - Current score (upvotes - downvotes)
- `num_comments` - Comment count
- `is_self` - Whether it's a self/text post

## Error Handling

- Retry transient failures (5xx, network errors) with backoff
- Log and skip permanently failed requests (4xx except 429)
- Handle Reddit API being temporarily unavailable
- If Reddit not connected, return helpful error message (don't crash)
- If token refresh fails, mark Reddit as disconnected and notify user

## Development Without Reddit Connection

The app should be fully functional for development and testing without a connected Reddit account:

- Use MSW (Mock Service Worker) to mock Reddit API responses in tests
- Seed script provides fake posts for UI development
- Fetch button shows helpful message if Reddit not connected: "Connect your Reddit account in Settings to fetch posts"
- All other features (tags, subreddits config, post management, UI) work independently

## Acceptance Criteria

1. **User OAuth flow works** - User can connect Reddit account via OAuth
2. **Posts are fetched** - Given connected account and configured subreddits/terms, matching posts are returned
3. **User isolation** - Each user's Reddit connection is independent
4. **Time window respected** - Only posts within the specified time window are returned
5. **Rate limits respected** - System does not exceed 60 requests/minute; backs off on 429 responses
6. **All fields extracted** - Every field listed in Data Extraction is populated (or explicitly null/empty)
7. **Errors don't crash** - Transient errors retry; permanent errors log and continue
8. **Multiple subreddits** - Can search across multiple subreddits in a single fetch operation
9. **Multiple search terms** - Can search for multiple terms, combining results without duplicates
10. **Token refresh works** - Expired tokens automatically refreshed before API calls
11. **Disconnect handled** - User without Reddit connection sees helpful message, not error
12. **User-Agent correct** - Includes connected user's Reddit username
