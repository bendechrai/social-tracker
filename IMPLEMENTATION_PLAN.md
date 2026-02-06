# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-06
**Verification Method:** Automated codebase analysis against specs/*

---

## Current Status Overview

### Completed Features
- **Database Schema** - 6 core tables (users, posts, tags, subreddits, searchTerms, postTags) with proper relationships, indexes, and cascade deletes
- **Authentication** - Auth.js v5 with credentials provider, middleware, login/signup pages, user menu, server actions, Drizzle adapter, 7-day sessions
- **Server Actions** - Full CRUD for posts, tags, subreddits, search terms with validation (4 action files + auth actions + API key actions)
- **Reddit Data Fetching** - Via Arctic Shift API (public, no auth), rate limit awareness, exponential backoff, deduplication, 48h default time window
- **UI Components** - 24 components total (12 UI primitives including Label + 12 app components: post-list, post-card, tag-filter, tag-badge, status-tabs, header, user-menu, settings modal with subreddit/tag management, providers)
- **React Query Hooks** - 16 hooks for all CRUD operations with proper cache invalidation (15 in index.ts + use-toast)
- **Zod Validations** - Schemas for subreddits, tags, search terms, post status, suggest terms, password, email
- **Unit Tests** - 12 test files (331 tests total) — see Phase 8 for breakdown
- **Encryption System** - AES-256-GCM encryption utilities (encrypt/decrypt with iv:authTag:ciphertext format)
- **Password Utilities** - bcrypt hashing with cost factor 12
- **User API Keys (BYOK)** - Groq API key management with encrypted storage, functional settings UI, LLM integration with user key fallback
- **LLM Suggestions** - /api/suggest-terms endpoint using Groq API (falls back to env var)
- **Toast System** - Complete notification system
- **Pagination** - Complete pagination UI with Previous/Next buttons, page indicator, page size selector
- **Tag Color Rotation** - getNextTagColor integrated in tag creation
- **Settings Pages** - Account settings (password change), API Keys management
- **Project Setup** - Vitest, Playwright, MSW configured; all dependencies including auth packages

### Specification Requirements Reference
- **Auth**: Auth.js v5, bcrypt cost 12, password 12+ chars with upper/lower/number/symbol, 7-day sessions
- **Encryption**: AES-256-GCM with format iv:authTag:ciphertext (base64)
- **Reddit Data**: Via Arctic Shift API (https://arctic-shift.photon-reddit.com) — public, no auth required, ~36h data delay
- **LLM**: User's own Groq key (BYOK) with fallback to env var

### Known Issues (Minor)
- `webapp/lib/hooks/use-toast.ts` line 8: `TOAST_REMOVE_DELAY = 1000000` (~16.7 minutes) appears unusually high
- `webapp/app/api/suggest-terms/route.ts` line 42: LLM model `llama-3.3-70b-versatile` is hardcoded
- `webapp/middleware.ts`: Next.js 16 shows a deprecation warning about "middleware" file convention being renamed to "proxy" in future versions

### Files Removed (Intentional)
These files were removed as part of Phase 3 (Arctic Shift migration — Reddit OAuth no longer needed):
- `webapp/app/api/auth/reddit/route.ts` - Reddit OAuth initiation endpoint
- `webapp/app/api/auth/reddit/callback/route.ts` - Reddit OAuth callback endpoint
- `webapp/app/actions/reddit-connection.ts` - Reddit connection server actions
- `webapp/__tests__/actions/reddit-connection.test.ts` - Reddit connection tests
- `webapp/app/settings/connected-accounts/page.tsx` - Connected accounts settings page

### Database Schema Status
**Completed:**
- Sessions, accounts, verification_tokens tables (required by Auth.js)
- Users table authentication columns: password_hash, groq_api_key
- Users table Auth.js required columns: name, email_verified, image (added in migration 0001)
- Sessions table uses sessionToken as primary key (Auth.js requirement, changed in migration 0001)
- Reddit OAuth columns removed: reddit_access_token, reddit_refresh_token, reddit_token_expires_at, reddit_username (removed in migration 0002)
- Migration files: `drizzle/migrations/0000_orange_spyke.sql`, `drizzle/migrations/0001_whole_mole_man.sql`, `drizzle/migrations/0002_light_falcon.sql`

### Package Status
**Installed:**
- next-auth@beta (Auth.js v5)
- @auth/drizzle-adapter (Drizzle ORM adapter for Auth.js)
- bcrypt
- @types/bcrypt (dev dependency)
- @testing-library/user-event (dev dependency, for component tests)

---

## Phase 1: Authentication Foundation — COMPLETE (8/8)

**Priority: CRITICAL** — All other phases depend on this

<details>
<summary>Phase 1 details (completed)</summary>

- 1.1 Install Authentication Dependencies — COMPLETE
- 1.2 Database Schema for Authentication — COMPLETE
- 1.3 Encryption System — COMPLETE (`webapp/lib/encryption.ts`, 24 tests)
- 1.4 Password Utilities — COMPLETE (`webapp/lib/password.ts`, 17 tests; password/email Zod schemas)
- 1.5 Auth.js Configuration — COMPLETE (`webapp/lib/auth.ts`, `webapp/lib/auth-utils.ts`, 22 tests)
- 1.6 Authentication Middleware — COMPLETE (`webapp/middleware.ts`, 18 tests)
- 1.7 Authentication UI — COMPLETE (login page, signup page, user menu, auth server actions, 20 tests)
- 1.8 Update Existing Server Actions — COMPLETE (real Auth.js session-based auth replaces placeholder)

</details>

---

## Phase 2: Settings Foundation — COMPLETE (2/2)

**Priority: HIGH** — Required for user-configurable features
**Dependencies: Phase 1**

<details>
<summary>Phase 2 details (completed)</summary>

- 2.1 Settings Page Structure — COMPLETE (`webapp/app/settings/layout.tsx`, `webapp/app/settings/page.tsx`)
- 2.2 Account Settings — COMPLETE (`webapp/app/settings/account/page.tsx`, password change in `webapp/app/actions/auth.ts`)

**Files Created:**
- `webapp/app/settings/layout.tsx` - Settings layout with sidebar navigation (Account, API Keys)
- `webapp/app/settings/page.tsx` - Redirects to account settings
- `webapp/app/settings/account/page.tsx` - Account settings with password change form
- `webapp/app/settings/api-keys/page.tsx` - Placeholder updated in Phase 4

</details>

---

## Phase 3: Arctic Shift Integration — COMPLETE (2/2)

**Priority: HIGH** — Required for fetching Reddit data
**Dependencies: Phase 1**

### 3.1 Arctic Shift API Client — COMPLETE
- [x] **Implement Arctic Shift API client**
  - Rewrote `webapp/lib/reddit.ts` to use Arctic Shift API (`https://arctic-shift.photon-reddit.com/api/posts/search`)
  - No authentication required — free, public API
  - Supports query parameters: subreddit, query, after, sort, limit
  - Monitors `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers
  - Implements exponential backoff on 429 and 5xx responses
  - Extracts all required fields: reddit_id (with t3_ prefix), title, selftext, author, subreddit, permalink, url, created_utc, score, num_comments, is_self
  - Deduplicates posts across multiple search term queries (by reddit_id)
  - Default time window: 48 hours (accounts for ~36h data delay)
  - Makes one request per subreddit+term combination
  - Tests: `webapp/__tests__/reddit.test.ts` — 21 tests covering URL construction, field parsing, deduplication, sorting, error handling, rate limiting, time window

### 3.2 Remove Reddit OAuth Code — COMPLETE
- [x] **Remove Reddit OAuth infrastructure**
  - Removed files:
    - `webapp/app/api/auth/reddit/route.ts`
    - `webapp/app/api/auth/reddit/callback/route.ts`
    - `webapp/app/actions/reddit-connection.ts`
    - `webapp/__tests__/actions/reddit-connection.test.ts`
    - `webapp/app/settings/connected-accounts/page.tsx`
  - Removed Reddit OAuth columns from schema:
    - `reddit_access_token`, `reddit_refresh_token`, `reddit_token_expires_at`, `reddit_username`
    - Migration: `drizzle/migrations/0002_light_falcon.sql`
  - Updated `webapp/app/settings/layout.tsx` — removed Connected Accounts nav item
  - Updated `webapp/app/actions/posts.ts` — removed `isRedditConfigured` check (not needed for Arctic Shift)
  - Updated `webapp/__tests__/actions/posts.test.ts` — removed `mockIsRedditConfigured` references
  - Updated `webapp/mocks/handlers.ts` — now mocks Arctic Shift API instead of Reddit OAuth
  - No references to REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD remain in active code

---

## Phase 4: User API Keys (BYOK) — COMPLETE (3/3)

**Priority: MEDIUM** — Required for user-owned LLM access
**Dependencies: Phase 1**

<details>
<summary>Phase 4 details (completed)</summary>

- 4.1 API Key Storage — COMPLETE (`webapp/app/actions/api-keys.ts`, 28 tests)
- 4.2 API Keys UI — COMPLETE (`webapp/app/settings/api-keys/page.tsx`)
- 4.3 LLM Integration Update — COMPLETE (`webapp/app/api/suggest-terms/route.ts` uses user key with fallback)

</details>

---

## Phase 5: UI Completion — COMPLETE (1/1)

**Priority: MEDIUM**

<details>
<summary>Phase 5 details (completed)</summary>

- 5.1 Pagination UI — COMPLETE (`webapp/components/ui/pagination.tsx`, 23 tests)

</details>

---

## Phase 6: Minor Improvements

**Status: COMPLETE (2/2) + 1 optional task remaining**
**Priority: LOW**

<details>
<summary>Completed tasks</summary>

- 6.1 getNextTagColor utility — COMPLETE (defined, tested, integrated in tag creation)

</details>

### 6.2 Optional Enhancements
- [ ] **Subreddit existence verification**
  - Description: Verify subreddit exists via Arctic Shift API when adding new subreddit
  - Dependencies: Phase 3 (Arctic Shift Integration) — COMPLETE
  - Files to modify: `webapp/app/actions/subreddits.ts`, `webapp/lib/reddit.ts`
  - Acceptance Criteria:
    - [ ] API call to Arctic Shift `/api/subreddits/search` to verify subreddit exists before adding
    - [ ] User-friendly error message if subreddit doesn't exist
    - [ ] Graceful handling of rate limits (retry or skip verification)
  - **Test Requirements**:
    - Unit test: Valid subreddit passes verification
    - Unit test: Invalid subreddit returns appropriate error
    - Unit test: API failure skips verification gracefully

---

## Phase 7: End-to-End Testing

**Status: COMPLETE (4/4)**
**Priority: MEDIUM**
**Dependencies: All features implemented**

### 7.1 Playwright Test Infrastructure — COMPLETE
- [x] **Configure Playwright test helpers**
  - `webapp/e2e/fixtures.ts` — Custom test fixtures with `authenticatedPage`, auto-register/login, per-worker test user isolation
  - `webapp/e2e/helpers/auth.ts` — Auth helper utilities (assertLoggedIn, assertLoggedOut, logout, generateStrongPassword)
  - `webapp/playwright.config.ts` — Already configured (Chromium, dev server auto-start, HTML reporter)
  - `webapp/eslint.config.mjs` — Added `e2e/**` to global ignores (Playwright `use()` conflicts with React hooks rule)

### 7.2 Authentication E2E Tests — COMPLETE
- [x] **Write E2E tests for authentication flows** (`webapp/e2e/auth.spec.ts`)
  - Tests: signup page rendering, password strength feedback, password match/mismatch, successful signup, duplicate email error, login success/failure, protected route redirects, session persistence

### 7.3 Core Feature E2E Tests — COMPLETE
- [x] **Write E2E tests for post management** (`webapp/e2e/posts.spec.ts`)
  - Tests: status tabs display/switching, post card display, action buttons per status, tag filter dropdown, Reddit links, response notes for done posts

### 7.4 Settings E2E Tests — COMPLETE
- [x] **Write E2E tests for settings pages** (`webapp/e2e/settings.spec.ts`)
  - Tests: settings navigation, account password change form, wrong password rejection, API keys page

**Note:** E2E tests require a running PostgreSQL database and dev server. Run with `npm run test:e2e` after starting the database.

---

## Phase 8: Test Coverage Gaps

**Status: COMPLETE (7/7)**
**Priority: LOW**

Current test coverage: 445 tests across 19 files:
- `webapp/__tests__/validations.test.ts` (72 tests)
- `webapp/__tests__/reddit.test.ts` (21 tests)
- `webapp/__tests__/actions/subreddits.test.ts` (21 tests)
- `webapp/__tests__/actions/tags.test.ts` (34 tests)
- `webapp/__tests__/actions/posts.test.ts` (32 tests)
- `webapp/__tests__/actions/auth.test.ts` (20 tests)
- `webapp/__tests__/actions/api-keys.test.ts` (28 tests)
- `webapp/__tests__/encryption.test.ts` (24 tests)
- `webapp/__tests__/password.test.ts` (17 tests)
- `webapp/__tests__/auth.test.ts` (22 tests)
- `webapp/__tests__/middleware.test.ts` (18 tests)
- `webapp/__tests__/components/pagination.test.tsx` (23 tests)
- `webapp/__tests__/components/tag-badge.test.tsx` (10 tests)
- `webapp/__tests__/components/status-tabs.test.tsx` (9 tests)
- `webapp/__tests__/components/post-card.test.tsx` (27 tests)
- `webapp/__tests__/components/post-list.test.tsx` (6 tests)
- `webapp/__tests__/utils.test.ts` (12 tests)
- `webapp/__tests__/api/suggest-terms.test.ts` (19 tests)
- `webapp/__tests__/hooks/index.test.tsx` (26 tests)

### 8.1 Missing Unit Tests — COMPLETE (4/4)
- [x] **Add utils.ts unit tests** — COMPLETE (`webapp/__tests__/utils.test.ts`, 12 tests)
- [x] **Add API route tests** — COMPLETE (`webapp/__tests__/api/suggest-terms.test.ts`, 19 tests)
- [x] **Add encryption module tests** — COMPLETE (24 tests)
- [x] **Add password module tests** — COMPLETE (17 tests)

### 8.2 Component Tests — COMPLETE (2/2)
- [x] **Add pagination component tests** — COMPLETE (23 tests)
- [x] **Add remaining React component tests** — COMPLETE (tag-badge: 10 tests, status-tabs: 9 tests, post-card: 27 tests, post-list: 6 tests)

### 8.3 Hook Tests — COMPLETE (1/1)
- [x] **Add React Query hook tests** — COMPLETE (`webapp/__tests__/hooks/index.test.tsx`, 26 tests)

---

## Summary

| Phase | Description | Tasks | Status | Dependencies | Priority |
|-------|-------------|-------|--------|--------------|----------|
| 1 | Authentication Foundation | 8 | **COMPLETE (8/8)** | None | CRITICAL |
| 2 | Settings Foundation | 2 | **COMPLETE (2/2)** | Phase 1 | HIGH |
| 3 | Arctic Shift Integration | 2 | **COMPLETE (2/2)** | Phase 1 | HIGH |
| 4 | User API Keys (BYOK) | 3 | **COMPLETE (3/3)** | Phase 1 | MEDIUM |
| 5 | UI Completion (Pagination) | 1 | **COMPLETE (1/1)** | None | MEDIUM |
| 6 | Minor Improvements | 2+1 | **COMPLETE (2/2)** + 1 optional | Various | LOW |
| 7 | E2E Testing | 4 | **COMPLETE (4/4)** | All features | MEDIUM |
| 8 | Test Coverage Gaps | 7 | **COMPLETE (7/7)** | None | LOW |

**Total Remaining Tasks: 1** (Phase 6 optional: 1)

### Completed Tasks Summary
- **Phase 1 Authentication** — Complete Auth.js implementation with login/signup pages, user menu, middleware, and real session-based auth
- **Phase 2 Settings Foundation** — Settings pages with layout, sidebar navigation, account settings with password change
- **Phase 3 Arctic Shift Integration** — Arctic Shift API client replaces Reddit OAuth. Free, public, no-auth Reddit data archive. `webapp/lib/reddit.ts` rewritten, all OAuth infrastructure removed, DB migration complete
- **Phase 4 User API Keys (BYOK)** — Complete API key management with server actions (save, get, delete, hint), functional UI in settings, and LLM integration with user key fallback
- **Phase 5 Pagination** — Complete pagination UI with Previous/Next buttons, page indicator, and page size selector
- **Phase 6 getNextTagColor** — Integrated color rotation in tag creation

### Critical Path
```
All phases (1-8) are COMPLETE.
Only Phase 6.2 (Optional: Subreddit verification) remains — not on critical path.
```

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

### Files to Create (Summary)
```
No files remaining to be created — all phases are complete.
Optional Phase 6.2 would modify existing files only.
```
