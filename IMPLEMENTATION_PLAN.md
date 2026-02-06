# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-06
**Verification Method:** Automated codebase analysis against specs/*

---

## Current Status Overview

### Completed Features
- **Database Schema** - 6 core tables (users, posts, tags, subreddits, searchTerms, postTags) with proper relationships, indexes, and cascade deletes
- **Authentication** - Auth.js v5 with credentials provider, middleware, login/signup pages (with password visibility toggle, auto-login after signup, callbackUrl redirect), user menu, server actions, Drizzle adapter, 7-day sessions
- **Server Actions** - Full CRUD for posts, tags, subreddits, search terms with validation (4 action files + auth actions + API key actions)
- **Reddit Data Fetching** - Via Arctic Shift API (public, no auth), rate limit awareness, exponential backoff, upsert deduplication, 48h default time window
- **UI Components** - 23 components total (12 UI primitives including Label + 11 app components: post-list, post-card, tag-filter, tag-badge, status-tabs, header with Settings button, user-menu, settings pages with subreddit/tag management, providers)
- **React Query Hooks** - 20 hooks for all CRUD operations with proper cache invalidation and optimistic updates for status changes (19 in index.ts + use-toast)
- **Zod Validations** - Schemas for subreddits, tags, search terms, post status, suggest terms, password, email
- **Unit Tests** - 19 test files (471 tests total) — see Phase 8/9/10/11 for breakdown
- **Encryption System** - AES-256-GCM encryption utilities (encrypt/decrypt with iv:authTag:ciphertext format)
- **Password Utilities** - bcrypt hashing with cost factor 12
- **User API Keys (BYOK)** - Groq API key management with encrypted storage, functional settings UI, LLM integration with user key fallback
- **LLM Suggestions** - /api/suggest-terms endpoint using Groq API (falls back to env var), server-side rate limiting (10 req/min/user), MISSING_API_KEY/INVALID_API_KEY error codes
- **Toast System** - Complete notification system
- **Pagination** - Complete pagination UI with Previous/Next buttons, page indicator, page size selector
- **Tag Color Rotation** - getNextTagColor integrated in tag creation
- **Settings Pages** - Unified /settings page with 4 sections (Account, API Keys, Subreddits, Tags) accessible via sidebar navigation
- **Dashboard UX** - Configuration banners for missing subreddits/search terms with links to settings pages, Suggest Terms disabled without Groq key
- **Project Setup** - Vitest, Playwright, MSW configured; all dependencies including auth packages
- **Seed Script** - Creates test user (test@example.com / TestPassword123!) with bcrypt-hashed password

### Specification Requirements Reference
- **Auth**: Auth.js v5, bcrypt cost 12, password 12+ chars with upper/lower/number/symbol, 7-day sessions
- **Encryption**: AES-256-GCM with format iv:authTag:ciphertext (base64)
- **Reddit Data**: Via Arctic Shift API (https://arctic-shift.photon-reddit.com) — public, no auth required, ~36h data delay
- **LLM**: User's own Groq key (BYOK) with fallback to env var

### Known Issues (Minor)
- `webapp/lib/hooks/use-toast.ts` line 8: `TOAST_REMOVE_DELAY = 1000000` (~16.7 minutes) appears unusually high
- `webapp/app/api/suggest-terms/route.ts`: LLM model `llama-3.3-70b-versatile` is hardcoded
- `webapp/middleware.ts`: Next.js 16 shows a deprecation warning about "middleware" file convention being renamed to "proxy" in future versions

---

## Phases 1-10 — All COMPLETE

See git history for details. Phases covered: Authentication Foundation, Settings Foundation, Arctic Shift Integration, User API Keys (BYOK), UI Completion, Minor Improvements, E2E Testing, Test Coverage Gaps, Spec Compliance Audit, Settings Unification & API Key Cache Fix.

---

## Phase 11: Spec Compliance — UX Polish & Error Handling — COMPLETE (7/7)

**Status: COMPLETE**
**Priority: HIGH — Closes 7 gaps between specs and implementation found by deep audit**

### 11.1 Signup Auto-Login — COMPLETE
- [x] **Auto-login after signup and redirect to dashboard**
  - Spec says: "Create session, redirect to dashboard" (authentication.md step 6)
  - Was redirecting to `/login?registered=true` requiring manual login
  - Now calls `signIn("credentials", ...)` on client side after successful signup
  - Falls back to login page redirect if auto-login fails
  - Redirects to `/` (dashboard) on success per ui-components.md

### 11.2 Login CallbackUrl — COMPLETE
- [x] **Respect callbackUrl parameter on login page**
  - Middleware sets `callbackUrl` when redirecting unauthenticated users to `/login`
  - Login page now reads `callbackUrl` from search params and redirects there after login
  - Defaults to `/` when no callbackUrl is present

### 11.3 Optimistic UI Updates — COMPLETE
- [x] **Add optimistic updates for post status changes**
  - Spec says: "Status changes reflect immediately - Optimistic UI updates on button click"
  - `useChangePostStatus` hook now uses `onMutate` to optimistically remove post from current list
  - Optimistically updates post counts (decrements old status, increments new status)
  - `onError` reverts cache to previous values on server error
  - `onSettled` always invalidates to ensure consistency with server
  - 2 new tests: optimistic removal + count update, error rollback

### 11.4 INVALID_API_KEY Error Code — COMPLETE
- [x] **Return proper error codes from suggest-terms API**
  - Missing key now returns `{ error: "...", code: "MISSING_API_KEY" }` per spec
  - Invalid key (401/auth errors from Groq) returns `{ error: "...", code: "INVALID_API_KEY" }`
  - SuggestTerms component handles error codes before checking suggestions
  - 2 new tests: 401 Unauthorized, authentication error detection

### 11.5 Settings Button in Header — COMPLETE
- [x] **Add standalone Settings button to header**
  - Spec wireframe shows: `[Fetch New] [Settings] [User]` — three elements
  - Added Settings icon button (gear icon) between Fetch New and UserMenu
  - Links to `/settings` using Next.js Link component
  - Uses `sr-only` label for accessibility

### 11.6 App Branding on Auth Pages — COMPLETE
- [x] **Add "Social Tracker" title to login and signup pages**
  - Both login and signup pages now display "Social Tracker" as h1 heading above the form card
  - Login fallback (Suspense boundary) also shows the branding
  - Matches spec wireframe layout

### 11.7 SuggestTerms Error Code Handling — COMPLETE
- [x] **Handle MISSING_API_KEY and INVALID_API_KEY codes in UI**
  - SuggestTerms component checks for `code` field in response before processing suggestions
  - Displays the error message from the API when error codes are present

---

## Summary

| Phase | Description | Tasks | Status | Dependencies | Priority |
|-------|-------------|-------|--------|--------------|----------|
| 1-8 | Core Features & Testing | 30 | **COMPLETE** | Various | Various |
| 9 | Spec Compliance Audit | 6 | **COMPLETE (6/6)** | All phases | HIGH |
| 10 | Settings Unification & API Key Cache Fix | 3 | **COMPLETE (3/3)** | Phase 4, 9 | HIGH |
| 11 | Spec Compliance — UX Polish & Error Handling | 7 | **COMPLETE (7/7)** | Phase 10 | HIGH |

**Total Remaining Tasks: 0**

Current test coverage: 471 tests across 19 files:
- `webapp/__tests__/validations.test.ts` (72 tests)
- `webapp/__tests__/reddit.test.ts` (27 tests)
- `webapp/__tests__/actions/subreddits.test.ts` (26 tests)
- `webapp/__tests__/actions/tags.test.ts` (34 tests)
- `webapp/__tests__/actions/posts.test.ts` (31 tests)
- `webapp/__tests__/actions/auth.test.ts` (20 tests)
- `webapp/__tests__/actions/api-keys.test.ts` (28 tests)
- `webapp/__tests__/encryption.test.ts` (24 tests)
- `webapp/__tests__/password.test.ts` (17 tests)
- `webapp/__tests__/auth.test.ts` (22 tests)
- `webapp/__tests__/middleware.test.ts` (18 tests)
- `webapp/__tests__/components/pagination.test.tsx` (23 tests)
- `webapp/__tests__/components/tag-badge.test.tsx` (10 tests)
- `webapp/__tests__/components/status-tabs.test.tsx` (9 tests)
- `webapp/__tests__/components/post-card.test.tsx` (32 tests)
- `webapp/__tests__/components/post-list.test.tsx` (6 tests)
- `webapp/__tests__/utils.test.ts` (12 tests)
- `webapp/__tests__/api/suggest-terms.test.ts` (24 tests — added INVALID_API_KEY tests)
- `webapp/__tests__/hooks/index.test.tsx` (36 tests — added optimistic update + rollback tests)

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
