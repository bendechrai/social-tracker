# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-07 (Phase 24 planned)
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

## Phase 24: Tag Search Term Constraints — IN PROGRESS

**Status: IN PROGRESS**
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

### In Progress

- [ ] **Add server-side validation to `removeSearchTerm` preventing removal of last term**
  - Files: `webapp/app/actions/tags.ts`
  - Spec: `specs/tag-system.md` acceptance criterion 10
  - Acceptance: `removeSearchTerm` returns `{ success: false, error: "Cannot remove the last search term" }` when the tag has exactly one term remaining
  - Tests: Add unit test deleting a tag's only term and verifying error; add test confirming deletion succeeds when 2+ terms exist

- [ ] **Add UI validation for tag creation requiring at least one search term**
  - Files: `webapp/components/settings/tag-settings.tsx`
  - Spec: `specs/tag-system.md` acceptance criterion 9
  - Acceptance: "Create" button is disabled when the terms input is empty; attempting to create shows an error message
  - Tests: Add component test rendering tag creation form with empty terms and verifying button is disabled or error shown

- [ ] **Add UI prevention for removing last search term from a tag**
  - Files: `webapp/components/settings/tag-settings.tsx`
  - Spec: `specs/tag-system.md` acceptance criterion 10
  - Acceptance: Remove button is disabled (or hidden) when a tag has exactly one search term; attempting removal shows an error
  - Tests: Add component test rendering a tag with one term and verifying remove button is disabled

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
| 24 | Tag Search Term Constraints | 4 | **IN PROGRESS** | None | HIGH |

**Total Remaining Tasks: 4** — Phase 24 in progress

### Environment Variables Required
```bash
# Core
DATABASE_URL=                    # PostgreSQL connection string

# Auth
AUTH_SECRET=                     # For Auth.js session signing (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=                  # 32-byte key for AES-256-GCM (generate with: openssl rand -base64 32)

# Optional
GROQ_API_KEY=                    # Fallback API key for LLM (optional if users provide their own)

# No Reddit credentials needed — data fetched via Arctic Shift API (public, no auth)
```
