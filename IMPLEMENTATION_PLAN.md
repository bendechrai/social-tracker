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
- **Unit Tests** - 12 test files (456 tests total) — see Phase 8 for breakdown
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

---

## Phase 2: Settings Foundation — COMPLETE (2/2)

**Priority: HIGH** — Required for user-configurable features
**Dependencies: Phase 1**

---

## Phase 3: Arctic Shift Integration — COMPLETE (2/2)

**Priority: HIGH** — Required for fetching Reddit data
**Dependencies: Phase 1**

---

## Phase 4: User API Keys (BYOK) — COMPLETE (3/3)

**Priority: MEDIUM** — Required for user-owned LLM access
**Dependencies: Phase 1**

---

## Phase 5: UI Completion — COMPLETE (1/1)

**Priority: MEDIUM**

---

## Phase 6: Minor Improvements — COMPLETE (3/3)

**Priority: LOW**

### 6.1 getNextTagColor utility — COMPLETE
- [x] **Implement tag color rotation**
  - Defined, tested, integrated in tag creation

### 6.2 Subreddit Existence Verification — COMPLETE
- [x] **Verify subreddit exists via Arctic Shift API when adding new subreddit**
  - Added `verifySubredditExists()` function to `webapp/lib/reddit.ts`
  - Queries Arctic Shift `posts/search` endpoint with `limit=1` to check if subreddit has any posts
  - Returns `true` if posts found (subreddit exists), `false` if empty (subreddit likely doesn't exist)
  - Returns `true` on API failure (graceful skip - users aren't blocked by API downtime)
  - Integrated into `addSubreddit()` in `webapp/app/actions/subreddits.ts`
  - Verification runs after name normalization but before duplicate check
  - User-friendly error: "Subreddit not found on Reddit"
  - Tests added:
    - `webapp/__tests__/reddit.test.ts`: 6 new tests (now 27 tests total)
    - `webapp/__tests__/actions/subreddits.test.ts`: 5 new tests (now 26 tests total)

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

Current test coverage: 456 tests across 19 files:
- `webapp/__tests__/validations.test.ts` (72 tests)
- `webapp/__tests__/reddit.test.ts` (27 tests)
- `webapp/__tests__/actions/subreddits.test.ts` (26 tests)
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
| 6 | Minor Improvements | 3 | **COMPLETE (3/3)** | Various | LOW |
| 7 | E2E Testing | 4 | **COMPLETE (4/4)** | All features | MEDIUM |
| 8 | Test Coverage Gaps | 7 | **COMPLETE (7/7)** | None | LOW |

**Total Remaining Tasks: 0**

### Completed Tasks Summary
- **Phase 1 Authentication** — Complete Auth.js implementation with login/signup pages, user menu, middleware, and real session-based auth
- **Phase 2 Settings Foundation** — Settings pages with layout, sidebar navigation, account settings with password change
- **Phase 3 Arctic Shift Integration** — Arctic Shift API client replaces Reddit OAuth. Free, public, no-auth Reddit data archive. `webapp/lib/reddit.ts` rewritten, all OAuth infrastructure removed, DB migration complete
- **Phase 4 User API Keys (BYOK)** — Complete API key management with server actions (save, get, delete, hint), functional UI in settings, and LLM integration with user key fallback
- **Phase 5 Pagination** — Complete pagination UI with Previous/Next buttons, page indicator, and page size selector
- **Phase 6 Minor Improvements** — Integrated color rotation in tag creation, subreddit existence verification via Arctic Shift API
- **Phase 7 E2E Testing** — Playwright test infrastructure with custom fixtures, authentication, post management, and settings tests
- **Phase 8 Test Coverage** — Comprehensive unit tests for all modules, components, hooks, and API routes (456 tests total)

### Critical Path
```
All phases (1-8) are COMPLETE.
No remaining tasks.
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
```
