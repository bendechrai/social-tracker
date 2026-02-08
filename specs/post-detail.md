# Post Detail Page

A dedicated page for viewing a Reddit post with its comments, managing post status, and having an AI-assisted conversation to help draft responses.

## Overview

When a user clicks on a post card from the dashboard, they navigate to `/dashboard/posts/:id` where they can see the full post content, Reddit comments, and an AI chat panel. The AI has full context of the post and its comments, helping the user understand the discussion and draft replies.

## Route

`/dashboard/posts/:id`

- `:id` is the `post_id` (UUID) from the `posts` table
- Protected route (requires authentication via proxy.ts)
- Returns 404 if the post doesn't exist or the user has no `user_posts` association

## Page Layout

### Header

Back arrow (chevron left) linking to `/dashboard`, page title (truncated post title), and UserMenu — matching the settings page pattern.

### Two-Column Layout

- **Left column** (~60%): Post content + comments
- **Right column** (~40%): AI chat panel
- On mobile: stacked vertically (content first, chat below)

### Left Column — Post Content

#### Post Header

- Title (full, not truncated)
- Metadata row: subreddit badge (`r/name`), author (`u/name`), score, comment count, relative time (e.g., "3 days ago")
- Tags: colored badges for each `user_post_tags` entry
- Link to Reddit: "View on Reddit" button opening the permalink in a new tab

#### Post Body

- Full body text (rendered as-is, not markdown — Reddit body is plaintext in Arctic Shift)
- If the post has a URL (link post), show it as a clickable link

#### Action Bar

- Status buttons: same as on the post card (Ignore, Done)
- If response text exists, show it in a readonly area below the actions
- "Copy Response" button if response text exists

#### Comments Section

- Heading: "Comments" with count
- Threaded/nested display of Reddit comments
- Each comment shows: author, body, score, relative time
- Comments sorted by score (highest first) within each level
- Indentation for reply depth (max visual depth of ~4 levels, flatten beyond that)

### Right Column — AI Chat

#### Chat Header

- "AI Assistant" heading
- "Clear Chat" button to start fresh (deletes persisted messages for this user+post)

#### Chat Messages

- Scrollable message list
- User messages: right-aligned
- AI messages: left-aligned, rendered as markdown
- Loading indicator while AI is responding (streaming)

#### Chat Input

- Text input at the bottom with send button
- Placeholder: "Ask about this post..."
- Disabled if no Groq API key is configured (show message: "Add a Groq API key in Settings to use AI chat")

#### Draft Reply Feature

- When AI generates a response that looks like a draft reply, show a "Use as Response" button on that message
- "Use as Response" saves the text to `user_posts.response_text`, copies to clipboard, and shows a toast confirmation
- User can also ask: "Draft a reply to this post" or similar prompts

## Comments Storage

### New Table: `comments`

Shared table (like `posts`), stored during cron fetch.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `reddit_id` | varchar(20) | Reddit comment ID (e.g., `t1_abc123`), unique |
| `post_reddit_id` | varchar(20) | Reddit ID of the parent post (e.g., `t3_xyz789`) |
| `parent_reddit_id` | varchar(20) | Reddit ID of parent comment (null for top-level) |
| `author` | varchar(100) | Comment author |
| `body` | text | Comment body text |
| `score` | integer | Comment score |
| `reddit_created_at` | timestamp | When the comment was created on Reddit |
| `created_at` | timestamp | When we stored it |

- Indexed on `post_reddit_id` for fast lookup by post
- Unique on `reddit_id` for deduplication
- No per-user state needed — comments are shared and read-only

### Comment Fetching

During the cron fetch cycle, after fetching posts for a subreddit:

1. For each post that was just fetched or updated, fetch its comments from Arctic Shift
2. Arctic Shift comments endpoint: `https://arctic-shift.photon-reddit.com/api/comments/search?link_id={post_id}`
3. Upsert comments into the `comments` table (deduplicate by `reddit_id`)
4. Limit to top ~50 comments per post to avoid excessive storage

Comments are only fetched for posts that are due for refresh (same schedule as posts). Not fetched on-demand.

## AI Chat

### New Table: `chat_messages`

Per-user, per-post chat history.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to users (cascade delete) |
| `post_id` | uuid | FK to posts (cascade delete) |
| `role` | varchar(20) | "user" or "assistant" |
| `content` | text | Message content |
| `created_at` | timestamp | When the message was sent |

- Indexed on `(user_id, post_id, created_at)` for efficient loading
- Cascade deletes via user_id (account deletion) and post_id

### AI Chat API

`POST /api/chat`

Request body:
```json
{
  "postId": "uuid",
  "message": "user's message"
}
```

Behavior:

1. Authenticate the user
2. Load the post content + comments from DB
3. Load existing chat history for this user+post
4. Build the system prompt with post context (title, body, subreddit, author, comments)
5. Append the new user message
6. Stream the response from Groq via `streamText` (using `@ai-sdk/groq`)
7. After streaming completes, persist both the user message and assistant response to `chat_messages`
8. Use the user's Groq API key (or env fallback), same pattern as suggest-terms

### System Prompt

```
You are an AI assistant helping a user engage with a Reddit post. You have full context of the post and its comments.

Post: {title}
Subreddit: r/{subreddit}
Author: u/{author}
Body: {body}

Comments:
{formatted comments with author, score, and nesting}

Help the user understand the discussion, identify key points, and draft thoughtful responses. When asked to draft a reply, write it in a natural Reddit comment style — conversational, helpful, and relevant to the discussion.
```

### Clear Chat

`DELETE /api/chat?postId={uuid}`

Deletes all `chat_messages` for the authenticated user and the given post.

## Status Management

Opening the post detail page does NOT change the post status. The user manually marks posts:

- **Ignore**: Sets status to "ignored"
- **Done**: Sets status to "done", optionally with response text

These use the existing `changePostStatus` action.

## Dashboard Post Card Changes

- Post card title and the card itself become clickable, linking to `/dashboard/posts/:id`
- Existing action buttons (Ignore, Done, View on Reddit) remain on the card for quick triage without opening the detail page

## Acceptance Criteria

1. **Post detail page loads** — `/dashboard/posts/:id` shows full post content, metadata, and tags
2. **Comments displayed** — Reddit comments shown in threaded format below the post
3. **Comments stored in DB** — Cron fetch stores comments alongside posts
4. **AI chat works** — User can send messages and receive streamed AI responses
5. **Chat persisted** — Chat history is saved and restored on revisit
6. **Clear chat works** — User can clear chat history for a post
7. **Draft reply** — AI can draft a reply; user can save as response text + copy to clipboard
8. **Status buttons work** — Ignore and Done buttons function on the detail page
9. **No auto-read** — Opening the page does not change post status
10. **Post card links to detail** — Clicking a post card on the dashboard navigates to the detail page
11. **Groq key required** — Chat is disabled with a helpful message if no API key is configured
12. **Responsive** — Two-column on desktop, stacked on mobile
13. **404 for invalid posts** — Returns 404 if post doesn't exist or user has no association
