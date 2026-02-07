# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-07 (Phase 18 Complete - Pagination Page Size Fix)
**Verification Method:** Opus-level codebase analysis comparing every spec acceptance criterion against source code

---

## Current Status Overview

### Completed Features (Verified Correct)
- **Authentication** - Auth.js v5 with credentials provider, proxy-based middleware, login/signup pages (password visibility toggle, auto-login after signup, callbackUrl redirect), user menu, server actions, Drizzle adapter, 7-day JWT sessions
- **Server Actions** - CRUD for posts, tags, subreddits, search terms with validation (4 action files + auth actions + API key actions)
- **Reddit Data Fetching** - Via Arctic Shift API (public, no auth), rate limit awareness, exponential backoff, deduplication, 48h default time window, t3_ prefix
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
- **Unit Tests** - 27 test files (610 tests), no skipped or flaky tests
- **E2E Tests** - 3 spec files (auth, posts, settings) with Playwright
- **Seed Script** - Creates test user with sample data

### Known Issues (Non-blocking, documented)
- `TOAST_REMOVE_DELAY = 1000000` — standard shadcn/ui default, not a bug
- `llama-3.3-70b-versatile` hardcoded — matches spec
- Next.js 16 "middleware" → "proxy" deprecation — future migration
- shadcn/ui toast deprecated upstream in favor of Sonner — future migration
- No TODOs, FIXMEs, skipped tests, or placeholder code in production source

---

## Phases 1-14 — All COMPLETE

See git history for details. Covered: Authentication Foundation, Settings Foundation, Arctic Shift Integration, User API Keys (BYOK), UI Completion, Minor Improvements, E2E Testing, Test Coverage Gaps, Spec Compliance Audit, Settings Unification & API Key Cache Fix, UX Polish & Error Handling, Acceptance Criteria Test Coverage, Accessibility & Responsive Polish, Test Quality & Known Issues Audit.

---

## Phase 15: Shared Posts Architecture (Database Schema Refactor) — COMPLETE

**Status: COMPLETE**
**Priority: CRITICAL — Core architectural violation of specs/database-schema.md and specs/post-management.md**
**Dependencies: None (foundational change)**

The spec requires a three-table architecture for shared posts:
- `posts` — global, deduplicated by `reddit_id` (unique), contains only Reddit content
- `user_posts` — per-user state (`userId`, `postId`, `status`, `responseText`, `respondedAt`)
- `user_post_tags` — per-user tag associations (`userId`, `postId`, `tagId`)

**Implementation Summary:**
- Schema refactored: `posts` table is now global (no userId, unique reddit_id)
- New `user_posts` table with composite PK (user_id, post_id)
- New `user_post_tags` table with composite PK (user_id, post_id, tag_id) and FK to user_posts
- Server actions updated: posts.ts works with three-table model, tags.ts uses userPostTags
- Seed script updated for three-table model
- All 583 tests passing, migration regenerated from schema
- PostData interface preserved — UI components unchanged (hooks and components use the same PostData shape)

### Spec References
- database-schema.md acceptance criteria 4: "Posts are shared — Duplicate reddit_id for posts is rejected (global uniqueness, not per-user)"
- database-schema.md acceptance criteria 5: "User posts are per-user — Same post can have different status/response for different users"
- database-schema.md acceptance criteria 6: "Tag associations are per-user — user_post_tags references user_posts"
- database-schema.md acceptance criteria 9: "Indexes created — (user_id, status) index on user_posts, (subreddit) index on posts"
- post-management.md: "Posts are stored globally (shared across users)"
- reddit-integration.md acceptance criteria 5: "Posts stored globally — Fetched posts are stored in a shared table (deduplicated by reddit_id), not per-user"

### 15.1 Create new migration with three-table schema
- [x] Add `user_posts` table: composite PK `(user_id, post_id)`, columns: `user_id` (FK users, cascade), `post_id` (FK posts, cascade), `status` (varchar(20), default 'new'), `response_text` (text, nullable), `responded_at` (timestamp, nullable), `created_at` (default now), `updated_at` (default now). Index on `(user_id, status)`.
- [x] Add `user_post_tags` table: composite PK `(user_id, post_id, tag_id)`, columns: `user_id` (FK users, cascade), `post_id` (FK posts, cascade), `tag_id` (FK tags, cascade). FK `(user_id, post_id)` references `user_posts(user_id, post_id)` cascade.
- [x] Remove from `posts` table: `userId`, `status`, `responseText`, `respondedAt`, `updatedAt` columns
- [x] Change `posts.reddit_id` unique constraint from composite `(userId, redditId)` to global `(reddit_id)`
- [x] Change `posts` index from `(userId, status)` to `(subreddit)` per spec
- [x] Remove `post_tags` table (replaced by `user_post_tags`)
- [x] Update Drizzle relations for all affected tables
- [x] Export new TypeScript types: `UserPost`, `NewUserPost`, `UserPostTag`, `NewUserPostTag`

**Tests (derived from acceptance criteria):**
- Schema matches spec: all tables, columns, types, constraints verified
- `posts.reddit_id` has global unique constraint (not per-user)
- `user_posts` PK is `(user_id, post_id)`
- `user_post_tags` PK is `(user_id, post_id, tag_id)` with FK to `user_posts`
- Cascade delete: deleting user cascades to `user_posts` and `user_post_tags`
- Cascade delete: deleting post cascades to `user_posts` and `user_post_tags`
- Cascade delete: deleting tag cascades to `user_post_tags`
- Index exists on `user_posts(user_id, status)`
- Index exists on `posts(subreddit)`

### 15.2 Update server actions for three-table model
- [x] `fetchNewPosts` (`webapp/app/actions/posts.ts`):
  - Upsert into global `posts` table (conflict on `reddit_id` globally, not per-user)
  - Store ALL fetched posts in `posts` table (not just matching ones — per spec: "All posts from monitored subreddits are stored in the shared posts table, regardless of whether they match any search terms")
  - Create `user_posts` record only for posts matching search terms (conflict on `(user_id, post_id)` do nothing)
  - Create `user_post_tags` entries for matching tags
- [x] `listPosts`: query `user_posts` joined to `posts`, filter by `user_posts.status`, join `user_post_tags` for tag data
- [x] `getPost`: fetch from `posts` + `user_posts` + `user_post_tags`
- [x] `changePostStatus`: update `user_posts.status`, handle `responded_at` logic on `user_posts`
- [x] `updateResponseText`: update `user_posts.response_text`
- [x] `getPostCounts`: count from `user_posts` grouped by status

**Tests (derived from acceptance criteria):**
- `fetchNewPosts` stores ALL subreddit posts in global `posts` table (not just matching)
- `fetchNewPosts` creates `user_posts` only for matching posts
- `fetchNewPosts` creates `user_post_tags` for each matched tag
- Global deduplication: same `reddit_id` is not duplicated in `posts`
- Per-user deduplication: `user_posts(user_id, post_id)` conflict handled
- Two users monitoring same subreddit share the same `posts` row
- Two users can have different statuses for the same post
- `changePostStatus` updates `user_posts` not `posts`
- `respondedAt` set on done, cleared on non-done (on `user_posts`)
- `listPosts` filters by `user_posts.status` and joins `posts` for content
- `getPostCounts` reads from `user_posts`

### 15.3 Update React Query hooks and UI components
- [x] Update hook return types to match new `user_posts` + `posts` joined structure
- [x] Verify dashboard, post-card, post-list still work with updated data shapes
- [x] Update any components that reference `post.status` (now from `user_posts`)

### 15.4 Update seed script
- [x] `webapp/drizzle/seed.ts`: update to create posts in `posts` (global), then `user_posts` and `user_post_tags` for the seed user

### 15.5 Update existing tests
- [x] Update all post-related action tests to mock `user_posts` and `user_post_tags` tables
- [x] Update data isolation tests for new three-table model
- [x] Update hook tests if return types changed
- [x] Verify all 583 existing tests still pass

---

## Phase 16: Untagged Filter — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — Missing feature required by specs/post-management.md and specs/ui-components.md**
**Dependencies: Phase 15 (uses user_post_tags table)**

The spec requires an "Untagged" filter option that shows posts with zero tag associations.

**Implementation Summary:**
- Backend: `listPosts` accepts `"untagged"` sentinel in `tagIds` array; queries for `user_posts` with zero `user_post_tags` entries; union with specific tag matches when both selected
- Frontend: TagFilter component renders "Untagged" checkbox before user tags, unchecked by default, sentinel flows through existing selectedTagIds → usePosts → listPosts
- Dashboard: No changes needed — sentinel value flows through existing state management
- Tests: 12 new tests (2 backend in posts.test.ts, 10 frontend in tag-filter.test.tsx), all 595 tests passing

### Spec References
- post-management.md acceptance criteria 8: "Untagged filter works — Can show/hide posts with no tag associations"
- post-management.md acceptance criteria 9: "Filtering works — Can filter by status, by tag (including Untagged), by both"
- ui-components.md line 161: "Shows all user's tags plus an 'Untagged' option"
- ui-components.md line 163: "'Untagged' option: shows posts with zero tag associations in user_post_tags for this user"
- ui-components.md line 164: "'Untagged' is unchecked by default — only tagged posts shown unless user opts in"
- ui-components.md acceptance criteria 9: "Tag filter works — Selecting tags filters to posts with those tags; 'Untagged' option shows posts with no tag associations"

### 16.1 Backend: Add "Untagged" filter support to `listPosts`
- [x] Accept a special sentinel value (`"untagged"`) in the `tagIds` array parameter
- [x] When "untagged" is in `tagIds`: query for `user_posts` that have zero rows in `user_post_tags`
- [x] When both specific tags AND "untagged" are selected: return posts matching ANY selected tag OR posts with zero tags (union)
- [x] Default behavior (no tag filter): show all posts regardless of tag status

### 16.2 Frontend: Add "Untagged" option to TagFilter component
- [x] `webapp/components/tag-filter.tsx`: Add "Untagged" checkbox item before the separator and user's tags
- [x] "Untagged" option is unchecked by default
- [x] Selecting "Untagged" passes the sentinel value through to the API
- [x] "Clear all filters" also clears the Untagged selection

### 16.3 Update dashboard page
- [x] Dashboard page: No changes needed — `"untagged"` sentinel flows through existing `selectedTagIds` → `usePosts` hook → `listPosts` action

---

## Phase 17: Landing Page — Roadmap, Pricing & Creator Sections — COMPLETE

**Status: COMPLETE**
**Priority: HIGH — Missing sections required by specs/landing-page.md**
**Dependencies: None**

**Implementation Summary:**
- Hero: Added creator byline with name ("Ben Dechrai") and GitHub avatar photo via `next/image`
- Roadmap: "What's coming" section with 3 cards — More platforms (HN, Twitter/X, Discord, SO), AI response research, Team accounts
- Pricing: Two-card section — Individuals ($0+, donation-based) and Teams & Enterprise (coming soon)
- Footer: Updated from "a real human" to "Ben Dechrai"
- next.config.ts: Added `github.com` to `images.remotePatterns` for avatar
- Tests: 14 new tests in landing-page.test.tsx, all 609 tests passing

### Spec References
- landing-page.md acceptance criteria 7: "Creator visible — Page includes creator name and photo"
- landing-page.md acceptance criteria 8: "Roadmap visible — Upcoming platforms and features are mentioned"
- landing-page.md acceptance criteria 9: "Pricing clear — Individual donation model and future team plans are communicated"

### 17.1 Add Roadmap section
- [x] `webapp/app/(marketing)/page.tsx`: Add "What's Coming" section after features
- [x] Three roadmap items per spec: More platforms (HN, Twitter/X, Discord, SO), AI response research, Team accounts

### 17.2 Add Pricing section
- [x] Add pricing section: Individuals (donation-based, $0+), Teams & Enterprise (coming soon)

### 17.3 Update Hero with creator attribution
- [x] Add creator byline with name and photo per spec: "Creator byline with name and photo"
- [x] Personal origin story one-liner (preserved existing text)

### 17.4 Update Footer
- [x] Personal attribution: "Made with care by Ben Dechrai"

---

## Phase 18: Pagination Page Size Fix — COMPLETE

**Status: COMPLETE**
**Priority: MODERATE — UI inconsistency between dashboard default and pagination options**
**Dependencies: None**

**Implementation Summary:**
- Changed default `pageSizeOptions` from `[10, 25, 50]` to `[10, 20, 25, 50]` in pagination component
- Dashboard's default `pageSize=20` is now a selectable option in the dropdown
- Added test verifying default options include 20, all 610 tests passing

### 18.1 Fix page size options
- [x] Change `webapp/components/ui/pagination.tsx` default `pageSizeOptions` to `[10, 20, 25, 50]`

---

## Phase 19: Post Card Line Clamp — NOT STARTED

**Status: NOT STARTED**
**Priority: LOW — Minor spec deviation in post body truncation**
**Dependencies: None**

### Spec Reference
- ui-components.md line 183: "Post body text, truncated to ~3 lines"

### 19.1 Verify line clamp matches spec
- [ ] `webapp/components/post-card.tsx` line 142: currently uses `line-clamp-3` — this actually MATCHES the spec ("~3 lines"). The earlier audit incorrectly flagged this.
- [ ] **NO CHANGE NEEDED** — confirmed spec says "~3 lines" and implementation uses `line-clamp-3`

**Status: VERIFIED CORRECT — No action required**

---

## Phase 20: Suggest-Terms HTTP Status Codes — NOT STARTED

**Status: NOT STARTED**
**Priority: LOW — Error responses return 200 OK instead of semantic HTTP status codes**
**Dependencies: None**

### 20.1 Return proper HTTP status for MISSING_API_KEY
- [ ] `webapp/app/api/suggest-terms/route.ts`: When no API key is found, return 422 instead of 200
- [ ] When API key is invalid, return 401 instead of 200

**Tests:**
- MISSING_API_KEY response has HTTP 422 status
- INVALID_API_KEY response has HTTP 401 status
- Successful response still returns HTTP 200
- Frontend `suggest-terms` component handles non-200 responses correctly

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
| 20 | Suggest-Terms HTTP Status | 1 | **NOT STARTED** | None | LOW |

**Total Remaining Tasks: 1** (phase 20)

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
