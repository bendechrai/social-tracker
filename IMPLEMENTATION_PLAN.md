# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-08 (Phases 25-32 planned)
**Verification Method:** Opus-level codebase analysis comparing every spec acceptance criterion against source code

---

## Current Status Overview

### Completed Features (Verified Correct)
- **Authentication** - Auth.js v5 with credentials provider, proxy-based middleware, login/signup pages (password visibility toggle, auto-login after signup, callbackUrl redirect), user menu, server actions, Drizzle adapter, 7-day JWT sessions
- **Server Actions** - CRUD for posts, tags, subreddits, search terms with validation (4 action files + auth actions + API key actions)
- **Reddit Data Fetching** - Via Arctic Shift API (public, no auth), rate limit awareness, exponential backoff, deduplication, t3_ prefix, per-subreddit incremental fetching with 7-day backfill
- **UI Components** - 23 components total (12 UI primitives + 11 app components)
- **React Query Hooks** - 20 hooks with cache invalidation and optimistic updates
- **Zod Validations** - Schemas for subreddits, tags, search terms, post status, suggest terms, password, email
- **Encryption System** - AES-256-GCM encryption utilities
- **Password Utilities** - bcrypt hashing with cost factor 12
- **User API Keys (BYOK)** - Groq API key management with encrypted storage
- **LLM Suggestions** - /api/suggest-terms endpoint with rate limiting, error codes
- **Toast System** - Complete notification system
- **Tag Color Rotation** - getNextTagColor integrated in tag creation
- **Settings Pages** - 4 sections (Account, API Keys, Subreddits, Tags) with sidebar navigation
- **Dashboard UX** - Configuration banners, status tabs, tag filter, post cards
- **Pagination** - Previous/Next buttons, page indicator, page size selector
- **Post Ordering** - Posts ordered by Reddit creation time (newest first), not by DB insertion time
- **Unit Tests** - 27 test files (623 tests), no skipped or flaky tests
- **E2E Tests** - 3 spec files (auth, posts, settings) with Playwright
- **Seed Script** - Creates test user with sample data

### Known Issues (Non-blocking, documented)
- `TOAST_REMOVE_DELAY = 1000000` — standard shadcn/ui default, not a bug
- `llama-3.3-70b-versatile` hardcoded — matches spec
- Next.js 16 "middleware" → "proxy" deprecation — future migration
- shadcn/ui toast deprecated upstream in favor of Sonner — future migration
- No TODOs, FIXMEs, skipped tests, or placeholder code in production source

---

## Phases 1-20 — All COMPLETE

See git history for details. Key phases:
- **1-14**: Authentication, Settings, Arctic Shift Integration, BYOK, UI, E2E Testing, Spec Compliance
- **15**: Shared Posts Architecture (three-table model: posts, user_posts, user_post_tags)
- **16**: Untagged Filter
- **17**: Landing Page (Roadmap, Pricing, Creator)
- **18**: Pagination Page Size Fix
- **19**: Post Card Line Clamp (verified correct, no change needed)
- **20**: Suggest-Terms HTTP Status Codes

---

## Phase 21: Post Ordering Fix — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — Spec violation in ordering**
**Dependencies: None**

### Issues Fixed

**Bug: Post ordering used wrong column**
- `listPosts` was ordering by `userPosts.createdAt` (DB insertion time) instead of `posts.redditCreatedAt` (Reddit creation time)
- Spec requires: "Newest first — Posts ordered by Reddit creation time, descending" (post-management.md criterion 11)
- Root cause: Drizzle's relational query API (`db.query.X.findMany`) cannot order by columns from related tables in the `with` clause
- Fix: Replaced with two-step query — first get paginated postIds via query builder with `innerJoin` + `orderBy(desc(posts.redditCreatedAt))`, then load full data with tags via relational API, then re-sort to match paginated order

### Implementation Summary
- `webapp/app/actions/posts.ts`: Rewrote `listPosts` pagination query to use query builder with `innerJoin` for correct ordering by `posts.redditCreatedAt`
- `webapp/__tests__/actions/posts.test.ts`: Added ordering test, updated all `listPosts` test mocks for new query pattern
- `webapp/__tests__/actions/data-isolation.test.ts`: Updated mock to support `innerJoin` chain

### Spec References
- post-management.md acceptance criteria 11: "Newest first — Posts ordered by Reddit creation time, descending"

---

## Phase 22: Per-Subreddit Incremental Fetching — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — Spec violation in fetching strategy**
**Dependencies: None**
**Spec: `specs/reddit-integration.md` — Fetching Strategy section**

### Problem (Resolved)

The reddit-integration spec requires per-subreddit incremental fetching: for each subreddit, use the most recent `reddit_created_at` from the DB as the `after` parameter, or 7 days ago for initial backfill. Previously used a fixed 48-hour global time window.

### Completed (Phase 22)

- [x] **Add `getLastPostTimestampPerSubreddit` query helper**
  - New exported function in `webapp/app/actions/posts.ts` queries `posts` table grouped by `subreddit`, returns `Map<string, Date>` with max `reddit_created_at`. Accepts list of subreddit names. 4 unit tests added.

- [x] **Change `fetchRedditPosts` to accept per-subreddit timestamps instead of a global time window**
  - `fetchRedditPosts` now accepts `Map<string, number>` (subreddit → Unix after-timestamp). Removed `DEFAULT_TIME_WINDOW_HOURS`.

- [x] **Update `fetchNewPosts` to build per-subreddit timestamps with 7-day initial backfill**
  - `fetchNewPosts` now calls `getLastPostTimestampPerSubreddit` for the user's subreddits, builds a `Map<string, number>` where each subreddit maps to its last known post timestamp (Unix seconds), or 7 days ago if no posts exist. The fixed 48-hour window is fully removed. 2 new tests added verifying DB-timestamp usage for existing subreddits and 7-day backfill for new ones. All existing tests updated.

---

## Phase 23: Auto-Fetch Cron — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — New spec**
**Dependencies: Phase 22 (per-subreddit timestamps)**
**Spec: `specs/auto-fetch.md`**

### Overview

Replace the manual "Fetch New" button with an automatic cron-based fetch system. A `GET /api/cron/fetch-posts` endpoint fetches posts for all subreddits that have at least one subscriber and are due for refresh. Uses a `subreddit_fetch_status` table to track per-subreddit fetch state and a PostgreSQL advisory lock to prevent concurrent runs. Adding a new subreddit triggers an immediate fetch or links existing posts.

### Completed (Phase 23)

- [x] **Add `subreddit_fetch_status` table to Drizzle schema and generate migration**
  - Files: `webapp/drizzle/schema.ts`, `webapp/drizzle/migrations/0001_nebulous_mongoose.sql`
  - Table: `name` (PK, varchar 100), `last_fetched_at` (timestamp, nullable), `refresh_interval_minutes` (integer, default 60, not null), `created_at` (timestamp, default now, not null). Migration generated. typecheck, lint, tests (617), and build all pass.

- [x] **Create `fetchPostsForAllUsers` shared function that fetches posts for a subreddit and fans out to all subscribers**
  - Files: `webapp/app/actions/posts.ts`
  - Spec: `specs/auto-fetch.md` — Behavior steps 5a-5c
  - Function accepts subreddit name + FetchedPost[], queries all subscribers, upserts global posts, creates user_posts/user_post_tags per user with tag matching. 6 unit tests added (empty posts, no subscribers, two subscribers, per-user tag matching, dedup on conflict, no duplicate user_posts).

- [x] **Create `GET /api/cron/fetch-posts` route handler**
  - Files: `webapp/app/api/cron/fetch-posts/route.ts`
  - Spec: `specs/auto-fetch.md` — API Endpoint section
  - Route acquires advisory lock, queries distinct subreddits, checks fetch_status, fetches via Arctic Shift for due subreddits, calls fetchPostsForAllUsers, upserts last_fetched_at, releases lock. Returns `{ fetched: [...], skipped: N }` or `{ status: "skipped", reason: "already_running" }`.

- [x] **Add tests for the cron fetch endpoint advisory lock and fetch-status logic**
  - Files: `webapp/__tests__/api/cron-fetch-posts.test.ts`
  - 12 unit tests covering: lock held returns skipped, empty subreddits, new subreddits trigger fetch, not-due subreddits skipped, overdue subreddits fetched, fetch_status upserted, mixed due/not-due, lock released on success and error, posts passed to fan-out, incremental timestamps used.

- [x] **Update `addSubreddit` to link existing posts or trigger on-demand fetch**
  - Files: `webapp/app/actions/subreddits.ts`
  - Spec: `specs/auto-fetch.md` — On-Demand Trigger section
  - After saving the subreddit, checks if posts already exist in the `posts` table. If yes: `linkExistingPostsToUser` creates `user_posts` (status "new") and `user_post_tags` with tag matching. If no: dynamically imports and calls the cron `GET` handler for immediate 7-day backfill.

- [x] **Remove "Fetch New" button and related fetch UI from header/dashboard**
  - Files: `webapp/components/header.tsx`, `webapp/app/dashboard/page.tsx`, `webapp/lib/hooks/index.ts`
  - Spec: `specs/auto-fetch.md` — UI Changes: Remove section; `specs/post-management.md` — Trigger changed to cron
  - Header simplified: removed `onFetch`/`isFetching` props, fetch button, loading state, message display. Removed `"use client"` (no longer needs client state). Dashboard removed `useFetchNewPosts` hook usage, `handleFetch`, and fetch props. `useFetchNewPosts` hook removed from hooks index. Header tests rewritten (4 tests: title, settings link, user menu, no fetch button). Hook tests updated (removed `useFetchNewPosts` tests). E2E tests already didn't reference fetch button — no changes needed.

- [x] **Add fetch status display to subreddit settings list**
  - Files: `webapp/components/settings/subreddit-settings.tsx`, `webapp/app/actions/subreddits.ts`
  - Spec: `specs/auto-fetch.md` — UI Changes: Settings Page section
  - `listSubreddits` now joins `subreddit_fetch_status` by name, returning `fetchStatus` with `lastFetchedAt` and `refreshIntervalMinutes`. Component shows "Last fetched: X ago · Next fetch: in Y min" per row. No status row → "Pending/Pending". Null lastFetchedAt → "Never/Pending". Overdue → "Pending". 5 new component tests + 1 new action test. All 633 tests pass.

- [x] **Add unit tests for `addSubreddit` post-linking and on-demand fetch trigger**
  - Files: `webapp/__tests__/actions/subreddits.test.ts`, `webapp/__tests__/actions/data-isolation.test.ts`
  - 4 new tests: links existing posts to user, matches tags when linking, no duplicate user_posts if already linked, triggers cron when no existing posts. Updated data-isolation test mock for cron route.

- [x] **Update E2E tests for auto-fetch flow (no manual fetch button)**
  - Files: `webapp/e2e/posts.spec.ts`
  - Spec: `specs/auto-fetch.md` — Acceptance criteria 2, 9
  - Verified: E2E tests already did not reference "Fetch New" button. Posts use conditional checks (`if (count > 0)`) and work with seed data or auto-fetch. No code changes needed. All 633 unit tests pass, build passes.

---

## Phase 24: Tag Search Term Constraints — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — Spec violation in tag system**
**Dependencies: None**
**Spec: `specs/tag-system.md` — Acceptance criteria 9, 10**

### Problem

The tag-system spec requires two constraints that are not enforced:

1. **"At least one search term required"** (criterion 9): `createTag` accepts `initialTerms` as optional and allows creating tags with zero search terms. Neither the server action nor the UI validates this.
2. **"Cannot remove last term"** (criterion 10): `removeSearchTerm` deletes any term without checking if it's the tag's only remaining term. The UI does not disable the remove button when one term remains.

### Completed (Phase 24)

- [x] **Add server-side validation to `createTag` requiring at least one search term**
  - Files: `webapp/app/actions/tags.ts`
  - Spec: `specs/tag-system.md` acceptance criterion 9
  - Acceptance: `createTag` returns `{ success: false, error: "At least one search term is required" }` when `initialTerms` is empty or missing
  - Tests: 2 new tests (missing terms, empty array); updated all existing `createTag` tests to pass terms

- [x] **Add server-side validation to `removeSearchTerm` preventing removal of last term**
  - Files: `webapp/app/actions/tags.ts`
  - Spec: `specs/tag-system.md` acceptance criterion 10
  - Acceptance: `removeSearchTerm` returns `{ success: false, error: "Cannot remove the last search term" }` when the tag has exactly one term remaining
  - Tests: 3 new tests (reject last term removal, allow removal with 2 terms, allow removal with 3+ terms); updated 2 existing tests with count mock

- [x] **Add UI validation for tag creation requiring at least one search term**
  - Files: `webapp/components/settings/tag-settings.tsx`
  - Spec: `specs/tag-system.md` acceptance criterion 9
  - Acceptance: "Create" button is disabled when the terms input is empty; attempting to create shows an error message
  - Tests: 2 new component tests (Create button disabled with name but no terms, enabled with both name and terms); updated 2 existing tests to include terms

- [x] **Add UI prevention for removing last search term from a tag**
  - Files: `webapp/components/settings/tag-settings.tsx`
  - Spec: `specs/tag-system.md` acceptance criterion 10
  - Acceptance: Remove button is disabled when a tag has exactly one search term; enabled when tag has multiple terms
  - Tests: 2 new component tests (remove button disabled with one term, enabled with multiple terms)

---

## Phase 25: Email Infrastructure & Notifications — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — New spec**
**Dependencies: None**
**Spec: `specs/email-notifications.md`**

### Overview

Set up nodemailer/SMTP email infrastructure and implement notification digests for new tagged posts. Adds `email_notifications` and `last_emailed_at` columns to users, unsubscribe endpoint, and cron integration.

### Completed (Phase 25)

- [x] **Add `email_notifications` and `last_emailed_at` columns to users table**
  - Files: `webapp/drizzle/schema.ts`, `webapp/drizzle/migrations/0002_closed_veda.sql`
  - Spec: `specs/email-notifications.md` — Database Changes
  - Acceptance: `users` table has `email_notifications` (boolean, default true) and `last_emailed_at` (timestamp, nullable) columns; migration applies cleanly
  - Tests: Typecheck passes; all 640 tests pass; build passes

### Completed (Phase 25)

- [x] **Create nodemailer SMTP transport utility**
  - Files: `webapp/lib/email.ts`
  - Spec: `specs/email-notifications.md` — Email Delivery
  - Acceptance: Exported `sendEmail` function creates nodemailer transport from `SMTP_*` env vars, accepts to/subject/html/text, returns success/failure
  - Tests: 10 unit tests with mocked nodemailer verifying transport creation, sendMail call, custom headers, port 465 secure mode, and error handling for all missing env vars

### Completed (Phase 25)

- [x] **Create signed token utility for unsubscribe/verification links**
  - Files: `webapp/lib/tokens.ts`
  - Spec: `specs/email-notifications.md` — Unsubscribe Tokens
  - Acceptance: `createSignedToken(userId, expiryMs)` and `verifySignedToken(token)` functions using HMAC with `ENCRYPTION_KEY`; returns `{ userId, expires }` or null
  - Tests: 10 unit tests covering roundtrip, UUID IDs, expired token rejection, signature/payload tampering, malformed tokens, missing ENCRYPTION_KEY

### Completed (Phase 25)

- [x] **Create `POST /api/unsubscribe` endpoint**
  - Files: `webapp/app/api/unsubscribe/route.ts`
  - Spec: `specs/email-notifications.md` — Unsubscribe Endpoint (POST)
  - Acceptance: Verifies signed token, sets `email_notifications = false` on user, returns 200; invalid token returns 400
  - Tests: 4 unit tests — valid unsubscribe, expired token, invalid token, missing token

### Completed (Phase 25)

- [x] **Create `GET /api/unsubscribe` confirmation page**
  - Files: `webapp/app/api/unsubscribe/route.ts`
  - Spec: `specs/email-notifications.md` — Unsubscribe Endpoint (GET)
  - Acceptance: Returns HTML page confirming unsubscribe with re-subscribe link to settings; does NOT auto-unsubscribe on GET
  - Tests: 3 unit tests — valid token returns HTML with POST form and settings link (no DB change), invalid token returns HTML error, missing token returns HTML error

### Completed (Phase 25)

- [x] **Add email notifications toggle to account settings**
  - Files: `webapp/app/settings/account/page.tsx`, `webapp/app/actions/users.ts`
  - Spec: `specs/email-notifications.md` — Settings UI
  - Acceptance: Toggle labeled "Email notifications" with description; calls server action to update `email_notifications` column; default on
  - Tests: 7 component tests (toggle render, description, load preference, default checked, toggle interaction, success toast, error revert) + 8 action tests (get/update preference, auth checks, error handling)

### Completed (Phase 25)

- [x] **Build notification email HTML/text template**
  - Files: `webapp/lib/email-templates.ts`
  - Spec: `specs/email-notifications.md` — Email Content
  - Acceptance: Function accepts tagged posts array + user info, returns `{ subject, html, text }` with tag-grouped posts, "and X more" overflow, unsubscribe footer, `List-Unsubscribe` headers
  - Tests: 17 unit tests verifying subject format (singular/plural), post grouping by tag, overflow text (>20 posts), plain text fallback (no HTML tags, full URLs), header generation (List-Unsubscribe, List-Unsubscribe-Post), HTML escaping, body truncation, null body handling, tag color badges

### Completed (Phase 25)

- [x] **Add `sendNotificationEmails` function to cron fetch cycle**
  - Files: `webapp/app/actions/posts.ts`, `webapp/app/api/cron/fetch-posts/route.ts`
  - Spec: `specs/email-notifications.md` — Trigger logic
  - Acceptance: After fetch cycle, queries eligible users (notifications on, last_emailed_at > 4hr or null, email_verified not null), sends digest for users with new tagged posts, updates `last_emailed_at`; skips users with no new tagged posts without updating timestamp
  - Tests: 7 unit tests (eligible user gets email, no tagged posts skipped, ineligible filtered, unverified filtered, correct template shape, failed email no timestamp, multi-user outcomes) + 4 cron tests (calls sendNotificationEmails, includes email results, no call when empty/not-due)

- [x] **Add proxy.ts exclusion for `/api/unsubscribe`**
  - Files: `webapp/proxy.ts`
  - Spec: `specs/email-notifications.md` — Unsubscribe Endpoint
  - Acceptance: `/api/unsubscribe` is accessible without authentication
  - Tests: 2 middleware tests (no 401 for /api/unsubscribe, matcher contains api/unsubscribe)

---

## Phase 26: Welcome Email & Email Verification — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — New spec**
**Dependencies: Phase 25 (email infrastructure, signed tokens)**
**Spec: `specs/welcome-email.md`**

### Overview

Send a welcome email with quick-start tips and verification link on signup. Add verification endpoint, resend mechanism, dashboard banner for unverified users, and gate notification emails behind verification.

### Completed (Phase 26)

- [x] **Build welcome email HTML/text template**
  - Files: `webapp/lib/email-templates.ts`
  - Spec: `specs/welcome-email.md` — Email Content
  - Acceptance: Function returns `{ subject, html, text }` with "Welcome to Social Tracker" subject, greeting, 3 quick-start tips, "Get Started" CTA, and "Verify Email" button with signed token link
  - Tests: 9 unit tests verifying subject, greeting/intro, all 3 tips in HTML and plain text, Get Started CTA, verify link with signed token, 7-day token expiry, plain text without HTML tags, footer

### Completed (Phase 26)

- [x] **Send welcome email from signup action (fire-and-forget)**
  - Files: `webapp/app/actions/auth.ts`
  - Spec: `specs/welcome-email.md` — Trigger
  - Acceptance: After successful user creation, sends welcome email asynchronously (does not block signup response); signup succeeds even if email fails
  - Tests: 2 new tests — email send called after user creation with correct userId/email, signup succeeds when email throws

### Completed (Phase 26)

- [x] **Create `GET /api/verify-email` endpoint**
  - Files: `webapp/app/api/verify-email/route.ts`
  - Spec: `specs/welcome-email.md` — Verification Endpoint
  - Acceptance: Verifies signed token (7-day expiry), sets `users.emailVerified` to now, redirects to `/dashboard?verified=true`; expired/invalid token redirects to `/dashboard?verify_error=true`
  - Tests: 5 unit tests — valid verification, expired token, invalid token, missing token, already-verified user (idempotent)

- [x] **Add proxy.ts exclusion for `/api/verify-email`**
  - Files: `webapp/proxy.ts`
  - Spec: `specs/welcome-email.md` — Public route
  - Acceptance: `/api/verify-email` is accessible without authentication
  - Tests: 2 middleware tests — /api/verify-email excluded from API auth (no 401), matcher contains api/verify-email

### Completed (Phase 26)

- [x] **Create `POST /api/resend-verification` endpoint**
  - Files: `webapp/app/api/resend-verification/route.ts`, `webapp/lib/email-templates.ts`
  - Spec: `specs/welcome-email.md` — Resend Verification
  - Acceptance: Authenticated endpoint; sends verification-only email (not full welcome) via new `buildVerificationEmail` template; returns 200; already-verified users get `{ success: true, alreadyVerified: true }` without sending email
  - Tests: 4 unit tests (successful resend, already-verified user skip, unauthenticated 401, user not found 404) + 6 template tests (subject, verify link, 7-day token expiry, no welcome content, expiry note, plain text fallback)

- [x] **Add resend verification button to account settings for unverified users**
  - Files: `webapp/app/settings/account/page.tsx`, `webapp/app/actions/users.ts`
  - Spec: `specs/welcome-email.md` — Resend Verification
  - Acceptance: If `emailVerified` is null, show "Resend verification email" button with explanation text; button calls `POST /api/resend-verification`; hidden when verified. New `getEmailVerified` server action added.
  - Tests: 2 component tests (button visible when unverified, hidden when verified) + 4 action tests (getEmailVerified: verified true, not verified false, user not found false, unauthenticated throws)

- [x] **Add verification banner to dashboard for unverified users**
  - Files: `webapp/app/dashboard/page.tsx`
  - Spec: `specs/welcome-email.md` — Dashboard Banner
  - Acceptance: If `emailVerified` is null, show dismissible amber banner: "Please verify your email to receive notifications. Check your inbox or [resend verification email]."; dismissible for session (client-side state); hidden once verified; resend link calls `POST /api/resend-verification`
  - Tests: 3 component tests (banner visible when unverified, hidden when verified, dismissible behavior)

---

## Phase 27: Password Reset — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — New spec**
**Dependencies: Phase 25 (email infrastructure)**
**Spec: `specs/password-reset.md`**

### Overview

Allow users to reset their password via a tokenized email link. Add `passwordChangedAt` column to users, forgot/reset password pages, two API endpoints, and session invalidation after password change.

### Completed (Phase 27)

- [x] **Add `passwordChangedAt` column to users table**
  - Files: `webapp/drizzle/schema.ts`, `webapp/drizzle/migrations/0003_breezy_preak.sql`
  - Spec: `specs/password-reset.md` — Database Change
  - Acceptance: `users` table has `passwordChangedAt` (timestamp, nullable, default null); migration applies cleanly
  - Tests: Typecheck passes; all 749 tests pass; build passes

- [x] **Create `POST /api/auth/reset-password` request-reset endpoint**
  - Files: `webapp/app/api/auth/reset-password/route.ts`
  - Spec: `specs/password-reset.md` — Request Reset API
  - Acceptance: Validates email, generates SHA-256-hashed token stored in `verificationTokens` (1hr expiry), sends reset email fire-and-forget, returns 200 regardless of email existence; rate limits 1 per email per 15 min by checking existing tokens
  - Tests: 7 unit tests — valid request, non-existent email returns 200, rate limit (token exists within 15min), token stored as SHA-256 hash, existing tokens deleted before new one, invalid email 400, missing email 400

- [x] **Build password reset email template**
  - Files: `webapp/lib/email-templates.ts`
  - Spec: `specs/password-reset.md` — Reset Email
  - Acceptance: `buildPasswordResetEmail` returns `{ subject, html, text }` with "Social Tracker — Reset Your Password" subject, reset button link, 1-hour expiry note, security note, plain text fallback
  - Tests: 6 unit tests — subject, reset link with token, 1-hour expiry note, security note, plain text fallback, footer

### Completed (Phase 27 cont.)

- [x] **Create `POST /api/auth/execute-reset` endpoint**
  - Files: `webapp/app/api/auth/execute-reset/route.ts`
  - Spec: `specs/password-reset.md` — Execute Reset API
  - Acceptance: Validates password against `passwordSchema`, verifies SHA-256 hashed token in `verificationTokens`, updates password hash and sets `passwordChangedAt`, deletes used token, returns 200; invalid/expired token returns 400
  - Tests: 7 unit tests — valid reset, expired token, invalid token, password validation failure, passwords don't match, token deleted after use, missing token

- [x] **Create `/forgot-password` page**
  - Files: `webapp/app/forgot-password/page.tsx`
  - Spec: `specs/password-reset.md` — Forgot Password Page
  - Acceptance: Public route; email input + "Send Reset Link" button; always shows generic success message; link back to login
  - Tests: 8 component tests — form render, login link, button disabled/enabled states, success message after submission, API call verification, API failure error, network failure error

- [x] **Create `/reset-password` page**
  - Files: `webapp/app/reset-password/page.tsx`
  - Spec: `specs/password-reset.md` — Reset Password Page
  - Acceptance: Reads `?token` from URL; invalid/missing token shows error with link to `/forgot-password`; valid token shows password form with requirement checklist; on success redirects to `/login?reset=true`
  - Tests: 13 component tests — missing token error, link to forgot-password, no form without token, form with checklist, button disabled/enabled, passwords match/mismatch indicators, API call, success redirect, API error, network error, forgot-password link in form

- [x] **Add "Forgot password?" link and reset success message to login page**
  - Files: `webapp/app/login/page.tsx`
  - Spec: `specs/password-reset.md` — Login Page Update
  - Acceptance: "Forgot password?" link below login form linking to `/forgot-password`; if `?reset=true` in URL, show success message
  - Tests: 3 component tests (link presence, success message with query param, no message without param)

- [x] **Add proxy.ts exclusions for `/forgot-password` and `/reset-password`**
  - Files: `webapp/proxy.ts`, `webapp/__tests__/middleware.test.ts`
  - Spec: `specs/password-reset.md` — Route Protection
  - Acceptance: `/forgot-password` and `/reset-password` are accessible without authentication; matcher pattern excludes both routes
  - Tests: 2 new middleware tests verifying matcher pattern contains `forgot-password` and `reset-password`

- [x] **Add JWT callback session invalidation on password change**
  - Files: `webapp/lib/auth.ts`, `webapp/lib/auth-utils.ts`
  - Spec: `specs/password-reset.md` — Session Invalidation
  - Acceptance: JWT callback checks `passwordChangedAt` against token `iat` on refresh (not initial sign-in); if password was changed after token issued, clears token fields to invalidate session
  - Tests: 6 unit tests — persists user on sign-in, unchanged when no passwordChangedAt, invalidated when passwordChangedAt > iat, valid when passwordChangedAt < iat, no DB check on sign-in, unchanged when user not found

- [x] **Update `changePassword` action to set `passwordChangedAt`**
  - Files: `webapp/app/actions/auth.ts`
  - Spec: `specs/password-reset.md` — Change Password Action Update
  - Acceptance: Existing `changePassword` also sets `passwordChangedAt = new Date()` when updating the password
  - Tests: Existing changePassword test updated to verify `passwordChangedAt` is set

---

## Phase 28: Account Deletion — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — New spec**
**Dependencies: None**
**Spec: `specs/account-deletion.md`**

### Overview

Allow users to permanently delete their account and all associated data. Email confirmation required. Shared data (posts, subreddit_fetch_status) is preserved.

### Completed (Phase 28)

- [x] **Create `deleteAccount` server action**
  - Files: `webapp/app/actions/auth.ts`
  - Spec: `specs/account-deletion.md` — Server Action
  - Acceptance: Validates `confirmationEmail` matches authenticated user's email (case-insensitive); deletes user row (cascade handles sessions, accounts, subreddits, tags, user_posts); signs out user with `redirect: false`; returns success
  - Tests: 5 unit tests — unauthenticated rejected, session without user id rejected, email mismatch rejected, case-insensitive email match, successful deletion with signOut

- [x] **Add "Delete Account" section to account settings page**
  - Files: `webapp/app/settings/account/page.tsx`
  - Spec: `specs/account-deletion.md` — UI
  - Acceptance: "Delete Account" section at bottom with destructive border, warning text, email confirmation input with placeholder, destructive "Delete Account" button disabled until email matches; on success redirects to `/` via `router.push`
  - Tests: 4 component tests — section renders with warning and input, button disabled by default, button enabled when email matches, redirect to `/` after successful deletion

---

## Phase 29: NSFW Content Handling — COMPLETE

**Status: COMPLETE**
**Priority: MODERATE — New spec**
**Dependencies: None**
**Spec: `specs/nsfw.md`**

### Overview

Blur NSFW post content by default with user preference to show it. Adds `is_nsfw` to posts table and `show_nsfw` to users table.

### Completed (Phase 29)

- [x] **Add `is_nsfw` column to posts table and `show_nsfw` column to users table**
  - Files: `webapp/drizzle/schema.ts`, `webapp/drizzle/migrations/0004_colorful_kingpin.sql`
  - Spec: `specs/nsfw.md` — Data
  - Acceptance: `posts.is_nsfw` (boolean, default false) and `users.show_nsfw` (boolean, default false) columns exist; migration applies cleanly
  - Tests: Typecheck passes; all 810 tests pass; build passes

- [x] **Populate `is_nsfw` from Arctic Shift `over_18` field during fetch**
  - Files: `webapp/lib/reddit.ts`, `webapp/app/actions/posts.ts`
  - Spec: `specs/nsfw.md` — Data (populated during cron fetch)
  - Acceptance: `fetchRedditPosts` maps `over_18` to `isNsfw` on fetched posts; `fetchPostsForAllUsers` stores `is_nsfw` in posts table
  - Tests: 3 new tests — over_18 true maps to isNsfw true, over_18 false maps to isNsfw false, fetchPostsForAllUsers passes isNsfw to DB insert

- [x] **Add NSFW blur overlay to post card on dashboard**
  - Files: `webapp/components/post-card.tsx`, `webapp/components/post-list.tsx`, `webapp/app/dashboard/page.tsx`, `webapp/app/actions/posts.ts`, `webapp/app/actions/users.ts`
  - Spec: `specs/nsfw.md` — UI Behavior (Dashboard post card)
  - Acceptance: When `is_nsfw` is true and `show_nsfw` is off, title and body preview are blurred with CSS filter; "NSFW" badge always shown; click-to-reveal per card (client-side toggle); metadata/actions remain visible
  - Tests: 6 new NSFW tests (blur when NSFW + off, no blur when on, badge always shown, no badge on non-NSFW, click reveals, metadata visible). All existing tests updated for new props. 819 total tests pass.

- [x] **Add "Show NSFW Content" toggle to account settings**
  - Files: `webapp/app/settings/account/page.tsx`, `webapp/app/actions/users.ts`
  - Spec: `specs/nsfw.md` — Settings Page
  - Acceptance: Toggle labeled "Show NSFW Content" in account settings; default off; updates `show_nsfw` column
  - Tests: 6 component tests (render, default unchecked, checked when true, toggle calls action, success toast, error revert) + 8 action tests (getShowNsfw: true/false/default/auth, updateShowNsfw: enable/disable/auth/error). All 833 tests pass.

---

## Phase 30: Post Detail Page — IN PROGRESS

**Status: IN PROGRESS**
**Priority: HIGH — New spec**
**Dependencies: Phase 29 (NSFW handling for detail page blur)**
**Spec: `specs/post-detail.md`**

### Overview

Dedicated page for viewing a Reddit post with comments and AI chat. Adds `comments` and `chat_messages` tables, comment fetching in cron, AI chat API, and two-column layout.

### Completed (Phase 30)

- [x] **Add `comments` table to Drizzle schema and generate migration**
  - Files: `webapp/drizzle/schema.ts`, `webapp/drizzle/migrations/0005_flowery_molecule_man.sql`
  - Spec: `specs/post-detail.md` — Comments Storage
  - Acceptance: `comments` table with `id` (uuid PK), `reddit_id` (varchar 20, unique), `post_reddit_id` (varchar 20, indexed), `parent_reddit_id` (varchar 20, nullable), `author` (varchar 100), `body` (text), `score` (integer), `reddit_created_at` (timestamp), `created_at` (timestamp); migration applies cleanly
  - Tests: Typecheck passes; all 833 tests pass; build passes

- [x] **Add `chat_messages` table to Drizzle schema and generate migration**
  - Files: `webapp/drizzle/schema.ts`, `webapp/drizzle/migrations/0006_aberrant_whiplash.sql`
  - Spec: `specs/post-detail.md` — AI Chat table
  - Acceptance: `chat_messages` table with `id` (uuid PK), `user_id` (uuid FK cascade), `post_id` (uuid FK cascade), `role` (varchar 20), `content` (text), `created_at` (timestamp); indexed on `(user_id, post_id, created_at)`; relations added to users and posts
  - Tests: Typecheck passes; all 833 tests pass; build passes

### Backlog (Phase 30)

- [x] **Fetch comments from Arctic Shift during cron cycle**
  - Files: `webapp/lib/reddit.ts`, `webapp/app/actions/posts.ts`, `webapp/app/api/cron/fetch-posts/route.ts`
  - Spec: `specs/post-detail.md` — Comment Fetching
  - Acceptance: After fetching posts for a subreddit, fetch top ~50 comments per post from Arctic Shift comments endpoint (`/api/comments/search?link_id={post_id}`); upsert into `comments` table by `reddit_id`
  - Tests: 6 fetchRedditComments tests (parse, prefix strip, limit 50, API error, missing data, top-level parent), 3 upsertComments tests (empty, insert, dedup), 3 cron integration tests (comments fetched per post, no comments for empty posts, comments passed to upsert). All 845 tests pass.

- [x] **Create `getPost` server action for post detail data**
  - Files: `webapp/app/actions/posts.ts`
  - Spec: `specs/post-detail.md` — Route (data loading)
  - Acceptance: Returns full post content + user_post status/tags + threaded comments (sorted by score) for authenticated user; returns null if post doesn't exist or user has no association
  - Tests: 5 unit tests — non-existent post returns error, no user association returns error, valid post with tags and empty comments, threaded comments sorted by score, comments flattened beyond max depth 4. All 848 tests pass.

- [ ] **Create `/dashboard/posts/[id]` page layout** ← NEXT
  - Files: `webapp/app/dashboard/posts/[id]/page.tsx`
  - Spec: `specs/post-detail.md` — Page Layout
  - Acceptance: Two-column layout (60/40); left: post header (title, metadata, tags, "View on Reddit"), body, action bar (Ignore/Done), comments section (threaded, max 4 depth); right: AI chat panel; responsive (stacked on mobile); 404 for invalid posts
  - Tests: Component test for layout render with mock data; 404 test

- [ ] **Add NSFW blur to post detail page**
  - Files: `webapp/app/dashboard/posts/[id]/page.tsx`
  - Spec: `specs/nsfw.md` — UI Behavior (Post detail page)
  - Acceptance: When `is_nsfw` true and `show_nsfw` off, title/body/comments blurred with banner "This post is marked NSFW" + "Show Content" button; metadata and actions remain visible
  - Tests: Component test for blur behavior, reveal button

- [ ] **Create `POST /api/chat` endpoint for AI chat**
  - Files: `webapp/app/api/chat/route.ts`
  - Spec: `specs/post-detail.md` — AI Chat API
  - Acceptance: Authenticated; loads post + comments + chat history; builds system prompt with post context; streams response from Groq via `streamText` using user's API key (or env fallback); persists user message and assistant response to `chat_messages`
  - Tests: Unit tests for: valid chat message, missing API key error, post not found error, chat history loaded correctly

- [ ] **Create `DELETE /api/chat` endpoint for clearing chat**
  - Files: `webapp/app/api/chat/route.ts`
  - Spec: `specs/post-detail.md` — Clear Chat
  - Acceptance: Deletes all `chat_messages` for authenticated user + given postId; returns 200
  - Tests: Unit test for successful clear, unauthorized rejected

- [ ] **Build AI chat panel component**
  - Files: `webapp/components/chat-panel.tsx`
  - Spec: `specs/post-detail.md` — Right Column (AI Chat)
  - Acceptance: Scrollable message list (user right-aligned, AI left-aligned as markdown), chat input with send button, "Clear Chat" button, loading indicator during streaming, disabled state with message when no Groq key, "Use as Response" button on AI messages to save to `user_posts.response_text` + copy to clipboard
  - Tests: Component tests for: message rendering, disabled without API key, clear chat button, send button

- [ ] **Make post cards clickable to navigate to detail page**
  - Files: `webapp/components/post-card.tsx`
  - Spec: `specs/post-detail.md` — Dashboard Post Card Changes
  - Acceptance: Post card title and card itself link to `/dashboard/posts/:id`; existing action buttons (Ignore, Done, View on Reddit) remain on card
  - Tests: Component test for link presence, click navigation

---

## Phase 31: Welcome Wizard — BACKLOG

**Status: BACKLOG**
**Priority: MODERATE — New spec**
**Dependencies: None**
**Spec: `specs/welcome-wizard.md`**

### Overview

Step-by-step onboarding wizard for new users with overlay prompts on actual settings pages. Data-driven: shows when user has zero subreddits.

### Backlog (Phase 31)

- [ ] **Create `OnboardingOverlay` reusable component**
  - Files: `webapp/components/onboarding-overlay.tsx`
  - Spec: `specs/welcome-wizard.md` — Overlay Component
  - Acceptance: Renders as a non-blocking card/banner; accepts heading, description, step number, total steps, action buttons; shows step progress indicator (e.g., "Step 2 of 4"); only renders when `?onboarding=N` matches expected step
  - Tests: Component tests for: renders with correct heading/description, progress indicator, conditional rendering based on query param

- [ ] **Add Step 1 welcome overlay to dashboard page**
  - Files: `webapp/app/dashboard/page.tsx`
  - Spec: `specs/welcome-wizard.md` — Step 1
  - Acceptance: When user has zero subreddits, show overlay with "Welcome to Social Tracker" heading and "Get Started" button navigating to `/settings/subreddits?onboarding=2`; overlay does not show if user has subreddits
  - Tests: Component test for overlay shown with zero subreddits, hidden with subreddits

- [ ] **Add Step 2 overlay to subreddit settings page**
  - Files: `webapp/app/settings/subreddits/page.tsx`
  - Spec: `specs/welcome-wizard.md` — Step 2
  - Acceptance: When `?onboarding=2`, show banner explaining subreddits; after adding a subreddit, show "Next" button to `/settings/api-keys?onboarding=3`; form remains interactive under overlay
  - Tests: Component test for overlay visibility, Next button after subreddit added

- [ ] **Add Step 3 overlay to API keys settings page**
  - Files: `webapp/app/settings/api-keys/page.tsx`
  - Spec: `specs/welcome-wizard.md` — Step 3
  - Acceptance: When `?onboarding=3`, show skippable overlay about Groq API key; "Skip" and "Next" buttons both navigate to `/settings/tags?onboarding=4`
  - Tests: Component test for overlay, skip and next buttons

- [ ] **Add Step 4 overlay to tag settings page**
  - Files: `webapp/app/settings/tags/page.tsx`
  - Spec: `specs/welcome-wizard.md` — Step 4
  - Acceptance: When `?onboarding=4`, show skippable overlay explaining tags with example; "Skip" and "Done" buttons navigate to `/dashboard`
  - Tests: Component test for overlay, tag explanation content, skip and done buttons

---

## Phase 32: Arcjet Security — BACKLOG

**Status: BACKLOG**
**Priority: HIGH — New spec**
**Dependencies: Phases 25-27, 30 (all routes that need protection must exist first)**
**Spec: `specs/arcjet-security.md`**

### Overview

Application-wide security using Arcjet for rate limiting, bot detection, email validation, and attack protection. Replaces hand-rolled rate limiters.

### Backlog (Phase 32)

- [ ] **Install `@arcjet/next` and create shared Arcjet client**
  - Files: `webapp/lib/arcjet.ts`, `webapp/package.json`
  - Spec: `specs/arcjet-security.md` — Shared Client
  - Acceptance: Base client configured with `ARCJET_KEY` env var and global Shield rule in LIVE mode
  - Tests: Unit test verifying client creation with env var

- [ ] **Add Arcjet `protectSignup` to signup flow**
  - Files: `webapp/app/actions/auth.ts` (or `webapp/app/api/auth/signup/route.ts` if refactored)
  - Spec: `specs/arcjet-security.md` — Signup rules
  - Acceptance: Email validation (block DISPOSABLE, INVALID, NO_MX_RECORDS), bot detection, rate limit (5 per 10min per IP)
  - Tests: Unit test for rate limit denial (429), bot denial (403), email validation denial

- [ ] **Add Arcjet protection to login credentials authorize**
  - Files: `webapp/lib/auth.ts` or `webapp/lib/auth-utils.ts`
  - Spec: `specs/arcjet-security.md` — Login rules
  - Acceptance: Shield + bot detection + rate limit (10 per 5min per IP) on credentials authorize
  - Tests: Unit test for rate limit and bot denial

- [ ] **Add Arcjet protection to password reset endpoint**
  - Files: `webapp/app/api/auth/reset-password/route.ts`
  - Spec: `specs/arcjet-security.md` — Password Reset rules
  - Acceptance: Shield + bot detection + email validation + rate limit (3 per 15min per IP)
  - Tests: Unit test for rate limit denial

- [ ] **Replace in-memory rate limiter on suggest-terms with Arcjet**
  - Files: `webapp/app/api/suggest-terms/route.ts`
  - Spec: `specs/arcjet-security.md` — Suggest Terms rules
  - Acceptance: Shield + rate limit (10 per min per user ID); remove `rateLimitMap` and `checkRateLimit`
  - Tests: Existing suggest-terms tests updated; new test for Arcjet rate limit denial

- [ ] **Add Arcjet protection to AI chat endpoint**
  - Files: `webapp/app/api/chat/route.ts`
  - Spec: `specs/arcjet-security.md` — AI Chat rules
  - Acceptance: Shield + rate limit (20 per min per user ID)
  - Tests: Unit test for rate limit denial

- [ ] **Add Arcjet protection to cron fetch endpoint**
  - Files: `webapp/app/api/cron/fetch-posts/route.ts`
  - Spec: `specs/arcjet-security.md` — Cron Fetch rules
  - Acceptance: Shield + rate limit (2 per min per IP)
  - Tests: Unit test for rate limit denial

- [ ] **Add Arcjet protection to unsubscribe endpoint**
  - Files: `webapp/app/api/unsubscribe/route.ts`
  - Spec: `specs/arcjet-security.md` — Unsubscribe rules
  - Acceptance: Shield + rate limit (5 per min per IP)
  - Tests: Unit test for rate limit denial

- [ ] **Add Arcjet protection to verify-email endpoint**
  - Files: `webapp/app/api/verify-email/route.ts`
  - Spec: `specs/arcjet-security.md` — Verify Email rules
  - Acceptance: Shield + rate limit (5 per min per IP)
  - Tests: Unit test for rate limit denial

- [ ] **Add Arcjet protection to resend-verification endpoint**
  - Files: `webapp/app/api/resend-verification/route.ts`
  - Spec: `specs/arcjet-security.md` — Resend Verification rules
  - Acceptance: Shield + rate limit (1 per 5min per user ID)
  - Tests: Unit test for rate limit denial

---

## Summary

| Phase | Description | Tasks | Status | Dependencies | Priority |
|-------|-------------|-------|--------|--------------|----------|
| 1-14 | All Previous Phases | 55 | **COMPLETE** | Various | Various |
| 15 | Shared Posts Architecture | 5 | **COMPLETE** | None | CRITICAL |
| 16 | Untagged Filter | 3 | **COMPLETE** | Phase 15 | HIGH |
| 17 | Landing Page Sections | 4 | **COMPLETE** | None | HIGH |
| 18 | Pagination Page Size Fix | 1 | **COMPLETE** | None | MODERATE |
| 19 | Post Card Line Clamp | 0 | **VERIFIED CORRECT** | — | — |
| 20 | Suggest-Terms HTTP Status | 1 | **COMPLETE** | None | LOW |
| 21 | Post Ordering & Data Delay | 2 | **COMPLETE** | None | HIGH |
| 22 | Per-Subreddit Incremental Fetching | 3 | **COMPLETE** | None | HIGH |
| 23 | Auto-Fetch Cron | 9 | **COMPLETE** | Phase 22 | HIGH |
| 24 | Tag Search Term Constraints | 4 | **COMPLETE** | None | HIGH |
| 25 | Email Infrastructure & Notifications | 9 | **COMPLETE** | None | HIGH |
| 26 | Welcome Email & Verification | 7 | **COMPLETE** | Phase 25 | HIGH |
| 27 | Password Reset | 8 | **COMPLETE** | Phase 25 | HIGH |
| 28 | Account Deletion | 2 | **COMPLETE** | None | HIGH |
| 29 | NSFW Content Handling | 4 | **COMPLETE** | None | MODERATE |
| 30 | Post Detail Page | 10 | **IN PROGRESS** | Phase 29 | HIGH |
| 31 | Welcome Wizard | 5 | **BACKLOG** | None | MODERATE |
| 32 | Arcjet Security | 10 | **BACKLOG** | Phases 25-27, 30 | HIGH |

**Total Remaining Tasks: 48**

### Environment Variables Required
```bash
# Core
DATABASE_URL=                    # PostgreSQL connection string

# Auth
AUTH_SECRET=                     # For Auth.js session signing (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=                  # 32-byte key for AES-256-GCM (generate with: openssl rand -base64 32)

# Optional
GROQ_API_KEY=                    # Fallback API key for LLM (optional if users provide their own)

# Email (required for Phases 25-27)
SMTP_HOST=                       # e.g., smtp.mailgun.org
SMTP_PORT=                       # e.g., 587
SMTP_USER=                       # Mailgun SMTP username
SMTP_PASS=                       # Mailgun SMTP password
SMTP_FROM=                       # e.g., notifications@social-tracker.example.com

# Security (required for Phase 32)
ARCJET_KEY=                      # Site key from app.arcjet.com

# No Reddit credentials needed — data fetched via Arctic Shift API (public, no auth)
```
