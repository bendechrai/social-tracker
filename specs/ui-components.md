# UI Components

Web interface for managing and viewing Reddit posts using Next.js and shadcn/ui.

## Overview

Single-page application with tabbed navigation for post statuses, settings for tags and subreddits, and controls for fetching new posts.

## Technology

- Next.js 16 with App Router
- React 19
- shadcn/ui component library
- Tailwind CSS 4
- Server Actions for mutations
- React Query (TanStack Query) for client state

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Social Tracker                    [Fetch New] [Settings ⚙]│
├─────────────────────────────────────────────────────────────┤
│  [New (12)]  [Ignored (45)]  [Done (128)]     [Filter ▾]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Post Title Here                                     │   │
│  │ r/postgresql • u/someuser • 2 hours ago    [Yugabyte]│   │
│  │                                                     │   │
│  │ Post body preview text goes here, truncated if     │   │
│  │ too long...                                         │   │
│  │                                                     │   │
│  │ [Ignore]  [Mark Done]              [View on Reddit →]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Another Post Title                                  │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Main Components

### Header

- App title: "Social Tracker"
- Fetch New button: Triggers manual post fetch, shows loading state, displays count of new posts found
- Settings button: Opens settings panel/modal

### Tab Bar

- Three tabs: New, Ignored, Done
- Each tab shows count in parentheses
- Active tab visually distinct
- Clicking tab filters post list

### Tag Filter

- Dropdown or multi-select
- Shows all user's tags
- Filters posts to those with ANY selected tag
- "All" option to clear filter
- Persists selection across tab switches

### Post Card

Displays a single post with:

**Header row:**
- Post title (clickable, opens Reddit in new tab)
- Tag pills (colored badges) in top-right corner

**Meta row:**
- Subreddit: r/name
- Author: u/name
- Time: relative (e.g., "2 hours ago")
- Score and comment count (subtle)

**Body:**
- Post body text, truncated to ~3 lines with "..." if longer
- Expandable on click (optional v1: just truncate)

**Actions row (varies by status):**

For status=new:
- [Ignore] button
- [Mark Done] button

For status=ignored:
- [Mark as New] button

For status=done:
- [Mark as New] button
- Response text area (see below)

**Response field (done status only):**
- Text area for pasting response
- Auto-saves on blur or after typing pause (debounced)
- Shows "Saved" indicator briefly
- Shows responded_at timestamp if set

**Footer:**
- [View on Reddit →] link (always visible)

### Settings Panel

Modal or slide-over panel containing:

**Subreddits Section:**
- List of configured subreddits
- Add subreddit input + button
- Remove button per subreddit

**Tags Section:**
- List of tags with their search terms
- Expand/collapse per tag to show terms
- Add tag button → opens tag form
- Edit tag (name, color)
- Delete tag (with confirmation)
- Add term input per tag
- Remove term button

**Tag Form (for create/edit):**
- Name input
- Color picker (from palette)
- Search terms input (comma-separated or one-by-one)
- [Suggest Terms] button (triggers LLM, see llm-tag-suggestions.md)
- Save / Cancel buttons

## Empty States

- No posts in tab: "No [new/ignored/done] posts" with subtle illustration
- No tags configured: Prompt to create first tag in settings
- No subreddits configured: Prompt to add subreddits in settings

## Loading States

- Initial load: Skeleton cards
- Fetch new: Button shows spinner, disables
- Status change: Optimistic update, revert on error
- Settings save: Inline spinner, success/error feedback

## Error Handling

- API errors: Toast notification with error message
- Network errors: Retry prompt
- Validation errors: Inline field errors

## Responsive Design

- Mobile: Stack layout, full-width cards, bottom sheet for settings
- Tablet: Similar to desktop but tighter spacing
- Desktop: As shown in layout diagram

## Acceptance Criteria

1. **Tabs filter correctly** - Clicking tab shows only posts with that status
2. **Counts are accurate** - Tab counts match actual post counts per status
3. **Tag filter works** - Selecting tags filters to posts with those tags
4. **Status changes reflect immediately** - Optimistic UI updates on button click
5. **Response text saves** - Text area content persists to database
6. **Settings CRUD works** - Can add/edit/remove subreddits, tags, and terms
7. **Fetch shows feedback** - Loading state during fetch, count of new posts after
8. **Links open Reddit** - Post title and "View on Reddit" open correct URL in new tab
9. **Tag pills render** - Tags show as colored pills on post cards
10. **Empty states show** - Appropriate messages when no data
11. **Mobile responsive** - Usable on mobile devices
12. **Keyboard accessible** - Can navigate and interact via keyboard
