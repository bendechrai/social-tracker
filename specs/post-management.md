# Post Management

Core business logic for managing Reddit posts through their lifecycle.

## Overview

Posts flow through three statuses: new → ignored OR done. Users can move posts between statuses and record their responses for tracking purposes.

## Post Lifecycle

```
┌─────────┐
│   NEW   │ ← Initial state when fetched
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

1. For each configured subreddit
2. For each configured search term across all tags
3. Call Reddit API with time window (default: last hour)
4. For each returned post:
   - Check if already exists (by reddit_id for user)
   - If new: insert with status "new", attach matching tags
   - If exists: skip (do not update)
5. Return count of new posts added

### Change Status

Input: post_id, new_status, response_text (optional)

1. Validate post exists and belongs to user
2. Update status
3. If status is "done" and response_text provided:
   - Save response_text
   - Set responded_at to now
4. If status changed FROM "done":
   - Clear responded_at (keep response_text for reference)
5. Update updated_at timestamp

### List Posts

Input: user_id, status filter, tag filter (optional), pagination

1. Query posts for user
2. Filter by status (required)
3. Filter by tag (optional) - posts that have ANY of the specified tags
4. Include related tags for each post
5. Order by reddit_created_at descending (newest first)
6. Return paginated results with total count

### Get Post Detail

Input: post_id

1. Fetch post with all related tags
2. Return full post data including response_text

### Update Response Text

Input: post_id, response_text

1. Validate post exists and belongs to user
2. Update response_text
3. Update updated_at
4. Note: This does NOT change status - user can draft response before marking done

## Deduplication

Posts are deduplicated by (user_id, reddit_id). If the same post matches multiple search terms:
- Only one post record is created
- Multiple tags are attached via post_tags

When fetching:
- Always check existence before insert
- Use upsert pattern: insert on conflict do nothing

## Metrics (for future reporting)

Track implicitly via timestamps:
- Response time: responded_at - created_at (time from fetch to done)
- Posts per period: count by created_at ranges
- Status distribution: count by status

No separate metrics table needed - derive from posts table.

## Acceptance Criteria

1. **New posts start as "new"** - Fetched posts have status "new" by default
2. **Status transitions work** - Can change from new→ignored, new→done, ignored→new, done→new
3. **Response text persists** - Marking done with response_text stores it; text remains if status changed later
4. **responded_at set correctly** - Set when status becomes "done", cleared when leaving "done"
5. **Deduplication works** - Same reddit_id for same user is not duplicated
6. **Multi-tag attachment** - Post matching multiple search terms gets multiple tags
7. **Filtering works** - Can filter by status, by tag, by both
8. **Pagination works** - Large result sets are paginated with correct totals
9. **Newest first** - Posts ordered by Reddit creation time, descending
