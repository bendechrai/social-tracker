# Post Management

Core business logic for managing Reddit posts through their lifecycle.

## Overview

Posts are stored globally (shared across users) and each user has their own relationship to posts via `user_posts`. Users triage posts through statuses (new → ignored OR done) and can record response notes. Tag associations are per-user via `user_post_tags`.

## Post Lifecycle

```
┌─────────┐
│   NEW   │ ← Initial state when associated with user
└────┬────┘
     │
     ├──────────────────┐
     ▼                  ▼
┌─────────┐       ┌─────────┐
│ IGNORED │       │  DONE   │
└────┬────┘       └────┬────┘
     │                  │
     └────────┬─────────┘
              ▼
        (can return to NEW)
```

## Status Definitions

- **new** - Fresh post that needs attention. Default for all fetched posts.
- **ignored** - User decided not to respond. Useful for tracking what was reviewed.
- **done** - User has responded (externally on Reddit). Response text can be recorded.

## Operations

### Fetch New Posts

Trigger: Manual via UI or scheduled (future)

1. For each configured subreddit, fetch all recent posts from Arctic Shift (one API call per subreddit, no search term filtering at the API level)
2. For each returned post:
   - Upsert into shared `posts` table (deduplicate by `reddit_id` globally)
   - Match against user's search terms locally (case-insensitive substring match on title + body)
   - Create `user_posts` record with status "new" (if not already associated with this user)
   - Create `user_post_tags` entries for matching tags
3. Return count of new posts added for this user

All posts from monitored subreddits are stored in the shared `posts` table, regardless of whether they match any search terms. This enables future features like RAG, smart search, and trend detection. Per-user associations (`user_posts`, `user_post_tags`) are only created when a post matches the user's tags or when the user explicitly interacts with it.

### Change Status

Input: post_id, new_status, response_text (optional)

1. Validate user_post exists for this user and post
2. Update status on user_posts
3. If status is "done" and response_text provided:
   - Save response_text
   - Set responded_at to now
4. If status changed FROM "done":
   - Clear responded_at (keep response_text for reference)
5. Update updated_at timestamp

### List Posts

Input: user_id, status filter, tag filter (optional, includes "Untagged" option), pagination

1. Query user_posts for user, joining to posts for content
2. Filter by status (required)
3. Filter by tag (optional):
   - Specific tags: posts that have ANY of the selected tags in user_post_tags
   - "Untagged" filter: posts with zero entries in user_post_tags for this user
   - "Untagged" is unchecked by default — only tagged posts shown unless user opts in
4. Include related tags for each post (from user_post_tags)
5. Order by reddit_created_at descending (newest first)
6. Return paginated results with total count

### Get Post Detail

Input: user_id, post_id

1. Fetch post content from posts table
2. Fetch user-specific state from user_posts
3. Fetch user-specific tags from user_post_tags
4. Return combined data including response_text

### Update Response Text

Input: user_id, post_id, response_text

1. Validate user_post exists for this user
2. Update response_text on user_posts
3. Update updated_at
4. Note: This does NOT change status - user can draft response before marking done

## Deduplication

Posts are deduplicated globally by `reddit_id` in the shared `posts` table. If multiple users monitor the same subreddit:
- Only one post record exists in `posts`
- Each user gets their own `user_posts` record with independent status
- Each user gets their own `user_post_tags` based on their personal tags and search terms

When fetching:
- Upsert into `posts`: insert on conflict (reddit_id) do nothing
- Upsert into `user_posts`: insert on conflict (user_id, post_id) do nothing

## Metrics (for future reporting)

Track implicitly via timestamps:
- Response time: responded_at - user_posts.created_at (time from association to done)
- Posts per period: count by created_at ranges
- Status distribution: count by status

No separate metrics table needed - derive from user_posts table.

## Acceptance Criteria

1. **New posts start as "new"** - User_posts records have status "new" by default
2. **Status transitions work** - Can change from new→ignored, new→done, ignored→new, done→new
3. **Response text persists** - Marking done with response_text stores it; text remains if status changed later
4. **responded_at set correctly** - Set when status becomes "done", cleared when leaving "done"
5. **Global deduplication works** - Same reddit_id is not duplicated in posts table
6. **Per-user state is independent** - Two users can have different statuses for the same post
7. **Multi-tag attachment** - Post matching multiple search terms gets multiple tags per user
8. **Untagged filter works** - Can show/hide posts with no tag associations
9. **Filtering works** - Can filter by status, by tag (including Untagged), by both
10. **Pagination works** - Large result sets are paginated with correct totals
11. **Newest first** - Posts ordered by Reddit creation time, descending
