# Email Notifications

Notify users by email when new posts matching their tags are detected.

## Overview

After the cron fetch cycle tags new posts, users who have new tagged posts are emailed a digest. Emails are rate-limited to one per user per 4 hours. Users can opt out in settings or via Gmail's one-click unsubscribe.

## Email Delivery

### Mailgun via SMTP

Use Node.js `nodemailer` package with Mailgun's SMTP credentials. No Mailgun-specific SDK needed.

Environment variables:
- `SMTP_HOST` — e.g., `smtp.mailgun.org`
- `SMTP_PORT` — e.g., `587`
- `SMTP_USER` — Mailgun SMTP username
- `SMTP_PASS` — Mailgun SMTP password
- `SMTP_FROM` — sender address, e.g., `notifications@social-tracker.example.com`

## Trigger

Runs at the end of the existing cron fetch cycle (`GET /api/cron/fetch-posts`), after all posts have been fetched and tagged.

### Logic

1. Query all users where `email_notifications` is `true` (default)
2. For each user, check if `last_emailed_at` is null or older than 4 hours
3. If eligible, query `user_post_tags` joined with `user_posts` for posts created since `last_emailed_at` (or last 4 hours if null), with status "new"
4. If there are tagged new posts, send an email
5. Update `last_emailed_at` on the user to now
6. If no tagged new posts, skip (do not update `last_emailed_at`)

### Post Limit

Include up to **20 posts** in each email. If more than 20 new tagged posts exist, include the 20 most recent and note "and X more" in the email.

## Email Content

### Subject

`Social Tracker: {count} new tagged post(s)`

### Body (HTML)

- Greeting: "Hi,"
- Summary: "You have {count} new posts matching your tags:"
- For each post (grouped by tag):
  - Tag name (colored badge)
  - Post title (linked to `/dashboard/posts/:id` in the app)
  - Subreddit and author
  - Snippet of body (first 150 chars, truncated)
- If truncated: "and {remaining} more — view all in Social Tracker"
- Footer: "You're receiving this because you have email notifications enabled. [Manage preferences](app-url/settings/account)"

### Plain Text Fallback

Same content without HTML formatting, links as full URLs.

## Database Changes

### Users Table

Add two columns:

- `email_notifications` — boolean, default `true`
- `last_emailed_at` — timestamp, nullable

### Unsubscribe Tokens

No separate table needed. Use a signed JWT or HMAC token encoding the user ID. The token is included in the unsubscribe URL and verified on the server without a database lookup.

## Gmail One-Click Unsubscribe (RFC 8058)

Every email includes these headers:

```
List-Unsubscribe: <https://{app-url}/api/unsubscribe?token={signed-token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

### Unsubscribe Endpoint

`POST /api/unsubscribe?token={signed-token}`

- No authentication required (the signed token is the credential)
- Excluded from proxy.ts auth (add `/api/unsubscribe` to public routes)
- Verifies the token signature, extracts user ID
- Sets `email_notifications = false` on the user
- Returns 200 OK
- Must be honored within 48 hours (we do it immediately)

`GET /api/unsubscribe?token={signed-token}`

- Same token verification
- Shows a simple HTML page confirming unsubscribe with a button to re-subscribe (links to settings)
- Does NOT auto-unsubscribe on GET (per RFC 8058 — only POST triggers unsubscribe)

## Settings UI

### Account Settings

Add an "Email Notifications" toggle:

- Label: "Email notifications"
- Description: "Receive email digests when new posts match your tags (at most every 4 hours)"
- Default: on
- Uses existing account settings page

## Acceptance Criteria

1. **Email sent after cron fetch** — Users with new tagged posts receive an email after the fetch cycle
2. **Rate limited** — No more than one email per user per 4 hours
3. **Only tagged posts** — Untagged posts do not trigger emails
4. **Only new posts** — Posts already emailed about are not re-included
5. **Post limit** — Maximum 20 posts per email with overflow count
6. **Links to app** — Post titles link to `/dashboard/posts/:id`
7. **Opt-out in settings** — Toggle in account settings disables emails
8. **Gmail one-click unsubscribe** — `List-Unsubscribe` and `List-Unsubscribe-Post` headers included
9. **Unsubscribe endpoint** — POST to `/api/unsubscribe` with valid token sets preference to off
10. **Plain text fallback** — Email includes both HTML and plain text parts
11. **SMTP via nodemailer** — Uses standard SMTP transport, not Mailgun SDK
12. **No email if no posts** — Users with no new tagged posts are not emailed and their timestamp is not updated
