# NSFW Content Handling

Blur NSFW post content by default with a user preference to show it.

## Overview

Reddit posts marked as NSFW (`over_18`) are blurred on the dashboard and post detail page. Users can toggle a global preference to show NSFW content unblurred, or reveal individual posts on click.

## Data

### Posts Table

Add an `is_nsfw` boolean column to the `posts` table (default `false`). Populated from Arctic Shift's `over_18` field during cron fetch.

### User Preference

Add a `show_nsfw` boolean column to the `users` table (default `false`).

## UI Behavior

### When `show_nsfw` is OFF (default)

- **Dashboard post card**: Title and body preview are blurred with a CSS blur filter. An "NSFW" badge is shown. Clicking the blurred area reveals the content for that card only (client-side toggle, not persisted).
- **Post detail page**: Title, body, and comments are blurred. A banner at the top says "This post is marked NSFW" with a "Show Content" button to reveal for the current visit.
- Tags, metadata (subreddit, author, score, time), and action buttons remain visible and unblurred.

### When `show_nsfw` is ON

- All NSFW content is shown normally, no blur.
- The "NSFW" badge still appears on cards and the detail page for awareness.

### Settings Page — Account

Add a "Show NSFW Content" toggle to the account settings page. Default off.

## Acceptance Criteria

1. **NSFW flag stored** — `posts.is_nsfw` column populated from Arctic Shift `over_18` field
2. **Blurred by default** — NSFW post content is blurred on dashboard and detail page when preference is off
3. **Per-post reveal** — User can click to reveal a single NSFW post without changing their global preference
4. **Global toggle** — `show_nsfw` preference in account settings controls default behavior
5. **NSFW badge** — NSFW posts always show an "NSFW" badge regardless of preference
6. **Metadata visible** — Subreddit, author, score, time, tags, and action buttons are never blurred
