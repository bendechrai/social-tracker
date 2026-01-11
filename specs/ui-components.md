# UI Components

Web interface for managing and viewing Reddit posts using Next.js and shadcn/ui.

## Overview

Multi-page application with authentication, tabbed navigation for post statuses, settings for tags, subreddits, and account management.

## Technology

- Next.js 16 with App Router
- React 19
- shadcn/ui component library
- Tailwind CSS 4
- Server Actions for mutations
- React Query (TanStack Query) for client state
- Auth.js for authentication

## Pages

### Public Pages (no auth required)

- `/login` - Login page
- `/signup` - Registration page

### Protected Pages (auth required)

- `/` - Dashboard (main app)
- `/settings` - User settings (could also be modal)

## Authentication Pages

### Login Page (`/login`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     Social Tracker                          │
│                                                             │
│              ┌───────────────────────────┐                  │
│              │                           │                  │
│              │  Email                    │                  │
│              │  ┌─────────────────────┐  │                  │
│              │  │                     │  │                  │
│              │  └─────────────────────┘  │                  │
│              │                           │                  │
│              │  Password                 │                  │
│              │  ┌─────────────────────┐  │                  │
│              │  │                     │  │                  │
│              │  └─────────────────────┘  │                  │
│              │                           │                  │
│              │  [      Sign in       ]   │                  │
│              │                           │                  │
│              │  Don't have an account?   │                  │
│              │  Sign up                  │                  │
│              │                           │                  │
│              └───────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Features:
- Email input field
- Password input field (with show/hide toggle)
- "Sign in" button
- Link to signup page
- Error display for invalid credentials
- Redirects to `/` on success

### Signup Page (`/signup`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     Social Tracker                          │
│                                                             │
│              ┌───────────────────────────┐                  │
│              │                           │                  │
│              │  Email                    │                  │
│              │  ┌─────────────────────┐  │                  │
│              │  │                     │  │                  │
│              │  └─────────────────────┘  │                  │
│              │                           │                  │
│              │  Password                 │                  │
│              │  ┌─────────────────────┐  │                  │
│              │  │                     │  │                  │
│              │  └─────────────────────┘  │                  │
│              │  ⓘ 12+ chars, upper,     │                  │
│              │    lower, number, symbol  │                  │
│              │                           │                  │
│              │  Confirm Password         │                  │
│              │  ┌─────────────────────┐  │                  │
│              │  │                     │  │                  │
│              │  └─────────────────────┘  │                  │
│              │                           │                  │
│              │  [   Create account   ]   │                  │
│              │                           │                  │
│              │  Already have an account? │                  │
│              │  Sign in                  │                  │
│              │                           │                  │
│              └───────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Features:
- Email input field
- Password input field with requirements hint
- Confirm password field
- Real-time password validation feedback
- "Create account" button
- Link to login page
- Inline validation errors
- Redirects to `/` on success

## Dashboard Layout (authenticated)

```
┌─────────────────────────────────────────────────────────────┐
│  Social Tracker            [Fetch New] [Settings ⚙] [User ▾]│
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
└─────────────────────────────────────────────────────────────┘
```

## Main Components

### Header

- App title: "Social Tracker"
- Fetch New button: Triggers manual post fetch, shows loading state, displays count of new posts found
  - Disabled with tooltip if Reddit not connected: "Connect Reddit in Settings"
- Settings button: Opens settings panel/page
- User menu (dropdown):
  - User email display
  - "Settings" link
  - "Sign out" button

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

### Settings Panel/Page

Modal, slide-over, or dedicated page containing multiple sections:

**Account Section:**
- Email (display only, not editable for v1)
- Change password form:
  - Current password input
  - New password input (with requirements)
  - Confirm new password input
  - "Update password" button

**Connected Accounts Section:**
- Reddit connection status:
  - If not connected: "Connect Reddit" button
  - If connected: "Connected as u/{username}" with "Disconnect" button
- Help text explaining why Reddit connection is needed

**API Keys Section:**
- Groq API Key:
  - If not set: Input field with "Save" button
  - If set: Masked display (showing last 4 chars) with "Update" / "Remove" buttons
  - Help text with link to https://console.groq.com/
  - Note: "Required for AI-powered tag suggestions"

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
- "Suggest Terms" button (disabled if no Groq key)

**Tag Form (for create/edit):**
- Name input
- Color picker (from palette)
- Search terms input (comma-separated or one-by-one)
- [Suggest Terms] button (triggers LLM, see llm-tag-suggestions.md)
  - Disabled with tooltip if no Groq API key
- Save / Cancel buttons

## Empty States

- No posts in tab: "No [new/ignored/done] posts" with subtle illustration
- No tags configured: Prompt to create first tag in settings
- No subreddits configured: Prompt to add subreddits in settings
- Reddit not connected: Banner/callout suggesting to connect Reddit in Settings

## Loading States

- Initial load: Skeleton cards
- Fetch new: Button shows spinner, disables
- Status change: Optimistic update, revert on error
- Settings save: Inline spinner, success/error feedback
- Auth actions: Button shows spinner

## Error Handling

- API errors: Toast notification with error message
- Network errors: Retry prompt
- Validation errors: Inline field errors
- Auth errors: Displayed on login/signup forms

## Responsive Design

- Mobile: Stack layout, full-width cards, bottom sheet for settings
- Tablet: Similar to desktop but tighter spacing
- Desktop: As shown in layout diagram

## Acceptance Criteria

1. **Login works** - User can log in with valid credentials
2. **Signup works** - User can create account with valid email/password
3. **Invalid credentials rejected** - Login shows error for wrong email/password
4. **Password validation** - Signup shows inline errors for weak passwords
5. **Logout works** - User can sign out from user menu
6. **Protected routes redirect** - Unauthenticated users sent to login
7. **Tabs filter correctly** - Clicking tab shows only posts with that status
8. **Counts are accurate** - Tab counts match actual post counts per status
9. **Tag filter works** - Selecting tags filters to posts with those tags
10. **Status changes reflect immediately** - Optimistic UI updates on button click
11. **Response text saves** - Text area content persists to database
12. **Settings CRUD works** - Can add/edit/remove subreddits, tags, and terms
13. **Reddit connect works** - Can initiate OAuth flow and see connected status
14. **Reddit disconnect works** - Can disconnect Reddit account
15. **Groq key CRUD works** - Can add/update/remove Groq API key
16. **Change password works** - Can update password with valid current password
17. **Fetch shows feedback** - Loading state during fetch, count of new posts after
18. **Fetch disabled without Reddit** - Button disabled with tooltip if not connected
19. **Suggest disabled without Groq** - Button disabled with tooltip if no API key
20. **Links open Reddit** - Post title and "View on Reddit" open correct URL in new tab
21. **Tag pills render** - Tags show as colored pills on post cards
22. **Empty states show** - Appropriate messages when no data
23. **Mobile responsive** - Usable on mobile devices
24. **Keyboard accessible** - Can navigate and interact via keyboard
