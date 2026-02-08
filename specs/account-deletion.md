# Account Deletion

Users can permanently delete their account and all associated data ("right to forget").

## Overview

A "Delete Account" option on the settings page allows a user to permanently remove their account. The user must type their email address to confirm. All user-specific data is deleted; shared data (posts, subreddit fetch status) is retained for other users.

## UI

### Settings Page

A "Delete Account" section at the bottom of the settings page with:

- A heading: "Delete Account"
- A warning message explaining that this action is permanent and all data will be lost
- A text input with placeholder: "Type your email to confirm"
- A "Delete Account" button (destructive styling) — disabled until the input matches the user's email exactly

### Confirmation Flow

1. User types their email into the confirmation input
2. Button becomes enabled when the input matches their email
3. User clicks "Delete Account"
4. Server action deletes all user data (see below)
5. Session is invalidated (sign out)
6. User is redirected to the landing page (`/`)

## Server Action

`deleteAccount(confirmationEmail: string)`

1. Get the current user's session
2. Validate `confirmationEmail` matches the authenticated user's email
3. Delete the user row from `users` — all related data cascades automatically via foreign keys:
   - `sessions` (cascade)
   - `accounts` (cascade)
   - `subreddits` (cascade)
   - `tags` (cascade) → `search_terms` (cascade)
   - `user_posts` (cascade) → `user_post_tags` (cascade)
4. Sign out the user (invalidate session/JWT)
5. Return success

### Data Retained

The following shared tables are **not** affected by account deletion:

- `posts` — shared post data, referenced by other users
- `subreddit_fetch_status` — shared fetch state per subreddit

### Re-registration

The same email can be used to create a new account immediately after deletion. There is no cooldown or block.

## Acceptance Criteria

1. **Delete option on settings page** — "Delete Account" section visible at the bottom of settings
2. **Email confirmation required** — User must type their exact email to enable the delete button
3. **All user data deleted** — User row and all cascading data removed from the database
4. **Shared data preserved** — Posts and subreddit fetch status are not deleted
5. **Session invalidated** — User is signed out after deletion
6. **Redirect to landing page** — User lands on `/` after deletion
7. **Re-registration allowed** — Same email can sign up again immediately
8. **No partial deletion** — Deletion is atomic (all or nothing via cascade)
