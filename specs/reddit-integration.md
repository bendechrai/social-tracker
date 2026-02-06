# Reddit Integration

Fetch Reddit posts via the Arctic Shift API — a free, public, no-auth-required archive of Reddit data.

## Overview

Posts are fetched from configured subreddits matching search terms within a configurable time window. No per-user Reddit account or OAuth is required. The Arctic Shift API provides historical Reddit data with approximately a 36-hour delay from when posts are created.

## Data Source

**Arctic Shift** — https://arctic-shift.photon-reddit.com

- Free, public API — no API key or authentication required
- Archives all public Reddit posts and comments (since 2005)
- Data delay: ~36 hours before posts appear (not real-time)
- Rate limited — respect `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers
- No uptime or performance guarantees (community service)

Reference: https://github.com/ArcticisFox/arctic_shift

## Fetching Posts

Search configured subreddits for posts matching search terms.

### Endpoint

`GET https://arctic-shift.photon-reddit.com/api/posts/search`

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `subreddit` | string | Subreddit name (without r/) |
| `query` | string | Keyword search across title and selftext |
| `after` | date | Only posts created after this date (ISO 8601 or Unix timestamp) |
| `before` | date | Only posts created before this date |
| `sort` | string | `asc` or `desc` by `created_utc` (default: desc) |
| `limit` | number | 1–100 results (default 25), or `"auto"` for 100–1000 |

### Example Request

```
GET https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=postgresql&query=yugabyte&after=2025-01-01&limit=100&sort=desc
```

### Fetching Strategy

For each configured subreddit + search term combination:

1. Build the query URL with subreddit, search term, and time window
2. Set `after` to the configured time window start (e.g., 48 hours ago, accounting for data delay)
3. Set `limit` to 100 (max per request) or `"auto"` for larger result sets
4. Send GET request (no auth headers needed)
5. Parse response and extract post data
6. Deduplicate across multiple search terms (by reddit_id)

### Time Window

- Default: posts from the last 48 hours (accounts for ~36h data delay)
- Configurable per-fetch
- Use `after` and `before` parameters for date range

### Multiple Subreddits

Arctic Shift's search endpoint takes a single subreddit at a time. To search across multiple subreddits:
- Make one request per subreddit+term combination
- Deduplicate results by `reddit_id`
- Combine and sort by `created_utc`

## Rate Limiting

- Monitor `X-RateLimit-Remaining` response header
- Back off when remaining requests are low
- Check `X-RateLimit-Reset` for when the limit resets
- Implement exponential backoff on 429 responses
- Be considerate — this is a free community service

## Data Extraction

The Arctic Shift API returns Reddit post objects. For each post, extract:

- `reddit_id` — Reddit's unique identifier (the `id` field, prefix with `t3_` for full name)
- `title` — Post title
- `selftext` — Post body (may be empty for link posts)
- `author` — Reddit username
- `subreddit` — Subreddit name (without r/)
- `permalink` — Relative URL to post
- `url` — Link URL (for link posts) or permalink (for self posts)
- `created_utc` — Unix timestamp of post creation
- `score` — Current score (upvotes - downvotes)
- `num_comments` — Comment count
- `is_self` — Whether it's a self/text post

Note: Some fields like `score` and `num_comments` may reflect values from when the post was archived, not live values.

## Error Handling

- Retry transient failures (5xx, network errors) with exponential backoff
- Log and skip permanently failed requests (4xx except 429)
- Handle Arctic Shift API being temporarily unavailable gracefully
- Return helpful error message if the API is down
- No authentication errors to handle (no auth required)

## Development Without Arctic Shift

The app should be fully functional for development and testing without calling the real API:

- Use MSW (Mock Service Worker) to mock Arctic Shift API responses in tests
- Seed script provides fake posts for UI development
- Fetch button works for all authenticated users (no Reddit account needed)
- All other features (tags, subreddits config, post management, UI) work independently

## Acceptance Criteria

1. **Posts are fetched** — Given configured subreddits and search terms, matching posts are returned from Arctic Shift
2. **No auth required** — Fetching works for any authenticated app user without Reddit credentials
3. **User isolation** — Each user's fetched posts are stored independently
4. **Time window respected** — Only posts within the specified time window are returned
5. **Rate limits respected** — System monitors rate limit headers and backs off appropriately
6. **All fields extracted** — Every field listed in Data Extraction is populated (or explicitly null/empty)
7. **Errors don't crash** — Transient errors retry; permanent errors log and continue
8. **Multiple subreddits** — Can search across multiple subreddits in a single fetch operation
9. **Multiple search terms** — Can search for multiple terms, combining results without duplicates
10. **Data delay documented** — Users understand data has ~36h delay (not real-time)
