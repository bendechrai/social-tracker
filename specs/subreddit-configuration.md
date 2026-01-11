# Subreddit Configuration

Manage which subreddits to monitor for posts.

## Overview

Users configure which subreddits to search. All configured subreddits are searched for all search terms (no per-tag subreddit assignment in v1).

## Operations

### Add Subreddit

Input: user_id, name

1. Normalize name (remove r/ prefix if present, lowercase)
2. Validate format (alphanumeric, underscores, 3-21 chars)
3. Check uniqueness for user
4. Create subreddit record
5. Return created subreddit

Validation rules:
- No r/ prefix stored (strip if provided)
- Lowercase only
- 3-21 characters
- Alphanumeric and underscores only
- Must not already exist for user

### Remove Subreddit

Input: subreddit_id

1. Validate subreddit belongs to user
2. Delete subreddit record
3. Note: Existing posts from this subreddit remain

### List Subreddits

Input: user_id

1. Fetch all subreddits for user
2. Order alphabetically by name
3. Return list

### Validate Subreddit Exists

Optional enhancement: Before adding, verify subreddit exists on Reddit.

1. Call Reddit API: `GET /r/{name}/about`
2. If 404: reject with "Subreddit not found"
3. If 403: subreddit is private, warn but allow
4. If 200: subreddit exists, proceed

This prevents typos from silently failing to find posts.

## Common Subreddits for Tech Monitoring

Suggestions to show users:
- postgresql
- postgres
- database
- databases
- programming
- node
- javascript
- typescript
- devops
- kubernetes
- dataengineering
- SQL

## Acceptance Criteria

1. **Add works** - Can add a valid subreddit name
2. **Normalization works** - "r/PostgreSQL" becomes "postgresql"
3. **Validation rejects invalid** - Names with special chars rejected
4. **Uniqueness enforced** - Duplicate names for same user rejected
5. **Remove works** - Can remove a subreddit
6. **Posts remain** - Removing subreddit doesn't delete posts from it
7. **List ordered** - Subreddits returned alphabetically
8. **Existence check** - (If implemented) Invalid subreddit names rejected with helpful message
