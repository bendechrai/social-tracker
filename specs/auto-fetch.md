# Auto-Fetch

Automatic periodic fetching of Reddit posts for all monitored subreddits.

## Overview

A cron endpoint fetches new posts for all subreddits that have at least one subscriber and are due for a refresh. The same endpoint is called on-demand when a user adds a new-to-system subreddit. There is no manual "Fetch Now" button — fetching is fully automated.

## API Endpoint

`GET /api/cron/fetch-posts`

- No authentication required (the fetch is idempotent and low-cost)
- Called every minute by a Railway cron service
- Called on-demand by the "add subreddit" server action when the subreddit is new to the system

### Behavior

1. Acquire a semaphore (advisory lock or equivalent) to prevent concurrent executions
2. If the lock cannot be acquired, return immediately (another fetch is in progress)
3. Query all distinct subreddit names from the `subreddits` table (i.e., subreddits with at least one subscriber)
4. For each subreddit, check `subreddit_fetch_status`:
   - If no row exists: this is a new subreddit — fetch it (7-day backfill)
   - If `last_fetched_at + refresh_interval > now()`: skip (not due yet)
   - Otherwise: fetch it (incremental, since last known post)
5. For each fetched subreddit:
   - Upsert posts into the shared `posts` table (deduplicate by `reddit_id`)
   - For each user subscribed to this subreddit:
     - Create `user_posts` records for new posts (status "new")
     - Match posts against the user's search terms and create `user_post_tags`
   - Update `subreddit_fetch_status.last_fetched_at` to now
6. Return a summary: `{ fetched: ["subreddit1", "subreddit2"], skipped: 5 }`

### On-Demand Trigger

When a user adds a subreddit via the settings page:

1. Save the subreddit to the user's `subreddits` table as usual
2. If this subreddit name already has posts in the system (another user added it before):
   - Link existing posts to this user (create `user_posts` and `user_post_tags`)
   - No API fetch needed
3. If this is a brand-new subreddit name (no posts exist):
   - Call `GET /api/cron/fetch-posts` internally to trigger an immediate fetch
   - This will do the 7-day backfill for the new subreddit

## Database

### New Table: `subreddit_fetch_status`

Tracks fetch state per unique subreddit name (shared across users).

| Column | Type | Description |
|--------|------|-------------|
| `name` | varchar(100) | Subreddit name (primary key) |
| `last_fetched_at` | timestamp | When this subreddit was last successfully fetched |
| `refresh_interval_minutes` | integer | Minutes between fetches (default: 60) |
| `created_at` | timestamp | Row creation time |

- Keyed by subreddit `name` (not by user)
- `refresh_interval_minutes` defaults to 60 (1 hour), not configurable in the UI
- Row is created on first successful fetch

### Concurrency

Use a PostgreSQL advisory lock to prevent overlapping fetch runs:

```sql
SELECT pg_try_advisory_lock(1)  -- acquire
SELECT pg_advisory_unlock(1)    -- release
```

If the lock is already held, the endpoint returns immediately with `{ status: "skipped", reason: "already_running" }`.

## UI Changes

### Remove

- Remove the "Fetch Now" button from the header/posts page

### Settings Page — Subreddit List

Each subreddit row shows fetch status:

- **Last fetched**: relative time (e.g., "12 min ago") or "Never" if no fetch has occurred
- **Next fetch**: relative time (e.g., "in 48 min") computed from `last_fetched_at + refresh_interval_minutes`
- If a fetch is overdue (next fetch is in the past), show "Pending" instead of a negative time

These values come from `subreddit_fetch_status` joined by subreddit name. If no row exists for a subreddit, show "Pending" for both (fetch hasn't run yet).

## Deployment

### Railway Cron Service

A Railway cron service calls the endpoint every minute:

- Schedule: `* * * * *` (every minute)
- Command: `curl -s https://<app-url>/api/cron/fetch-posts`
- The endpoint itself decides what to fetch based on `subreddit_fetch_status`

### Local Development

A `cron` container in `docker-compose.yml` calls the endpoint every 60 seconds, mirroring the Railway cron service. This starts automatically with `docker compose up`.

Developers can also hit `GET /api/cron/fetch-posts` manually (via browser or curl) for immediate testing.

## Acceptance Criteria

1. **Hourly fetch per subreddit** — Each subreddit with subscribers is fetched roughly once per hour (controlled by `refresh_interval_minutes`)
2. **No manual fetch button** — The "Fetch Now" button is removed from the UI
3. **Immediate fetch for new subreddits** — Adding a brand-new subreddit triggers an immediate fetch
4. **Existing subreddit linking** — Adding a subreddit that already has posts links existing posts to the new user without re-fetching
5. **All subscribers get posts** — When a subreddit is fetched, `user_posts` and `user_post_tags` are created for every user subscribed to it
6. **Concurrent-safe** — Overlapping cron invocations do not cause duplicate work or errors
7. **Fetch status visible** — Settings page shows last fetched time and next fetch time per subreddit
8. **Works on Railway** — Cron service + endpoint pattern works in Railway's deployment model
9. **Works locally** — Endpoint is callable manually; on-demand trigger works in dev
10. **Idempotent** — Calling the endpoint multiple times produces the same result (no duplicate posts or user_posts)
