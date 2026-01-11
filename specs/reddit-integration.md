# Reddit Integration

Connect to the Reddit API to fetch posts matching configured search criteria.

## Overview

The system authenticates with Reddit using OAuth2 "script" application type (for personal use / single-user v1). Posts are fetched from configured subreddits matching search terms within a configurable time window.

## Authentication

- Use Reddit OAuth2 with "script" app type
- Credentials stored in environment variables:
  - `REDDIT_CLIENT_ID`
  - `REDDIT_CLIENT_SECRET`
  - `REDDIT_USERNAME`
  - `REDDIT_PASSWORD`
- Token refresh handled automatically when expired
- User-Agent must follow Reddit API rules: `platform:app_id:version (by /u/username)`

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

## Rate Limiting

- Reddit allows 60 requests per minute for OAuth clients
- Implement rate limiting with exponential backoff
- Track request count and reset window
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
- Store failed fetch attempts for debugging

## Acceptance Criteria

1. **Authentication works** - System obtains and refreshes OAuth tokens without manual intervention
2. **Posts are fetched** - Given configured subreddits and search terms, matching posts are returned
3. **Time window respected** - Only posts within the specified time window are returned
4. **Rate limits respected** - System does not exceed 60 requests/minute; backs off on 429 responses
5. **All fields extracted** - Every field listed in Data Extraction is populated (or explicitly null/empty)
6. **Errors don't crash** - Transient errors retry; permanent errors log and continue
7. **Multiple subreddits** - Can search across multiple subreddits in a single fetch operation
8. **Multiple search terms** - Can search for multiple terms, combining results without duplicates
