# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-07
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
- **Unit Tests** - 23 test files (530 tests total) — see Phase 12 for latest additions
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

## Phases 1-11 — All COMPLETE

See git history for details. Phases covered: Authentication Foundation, Settings Foundation, Arctic Shift Integration, User API Keys (BYOK), UI Completion, Minor Improvements, E2E Testing, Test Coverage Gaps, Spec Compliance Audit, Settings Unification & API Key Cache Fix, UX Polish & Error Handling.

---

## Phase 12: Acceptance Criteria Test Coverage — COMPLETE (4/4)

**Status: COMPLETE**
**Priority: HIGH — Closes test coverage gaps for spec acceptance criteria**

Deep audit of all 10 spec files against test files revealed multiple acceptance criteria without test coverage. This phase adds tests for every untested criterion that can be unit-tested.

### 12.1 SuggestTerms Component Tests — COMPLETE (26 tests)
- [x] **`webapp/__tests__/components/suggest-terms.test.tsx`**
  - Covers llm-tag-suggestions.md acceptance criteria: UI shows suggestions, selection works, terms added, duplicates handled, loading state, disabled without Groq key, errors handled, empty input rejected
  - Uses MSW `server.use()` to intercept `/api/suggest-terms` calls
  - 26 tests: initial rendering (3), disabled states (5), loading state (2), suggestions display (3), selection interaction (2), adding terms (5), error handling (4), rate limiting (1), API call (1)

### 12.2 UserMenu Component Tests — COMPLETE (9 tests)
- [x] **`webapp/__tests__/components/user-menu.test.tsx`**
  - Covers authentication.md: "Logout works — user can sign out, session destroyed"
  - Covers ui-components.md: "Logout works — user can sign out from user menu"
  - 9 tests: loading state (1), unauthenticated state (3), authenticated state with dropdown menu (5 including sign out call verification)

### 12.3 Header Component Tests — COMPLETE (14 tests)
- [x] **`webapp/__tests__/components/header.test.tsx`**
  - Covers ui-components.md: "Fetch shows feedback — loading state during fetch, count of new posts after"
  - 14 tests: rendering (4 - title, fetch button, settings link, user menu), loading state (3), success feedback (4 - count display, custom message, zero count, message auto-clear), error feedback (2), re-enable after fetch (1)

### 12.4 Data Isolation Tests — COMPLETE (10 tests)
- [x] **`webapp/__tests__/actions/data-isolation.test.ts`**
  - Covers authentication.md: "Data isolated — users only see their own tags, subreddits, posts"
  - Covers user-api-keys.md: "Keys isolated — User A cannot access User B's keys"
  - 10 tests: subreddit isolation (3 - list scoping, insert userId, duplicate check scoping), tag isolation (2 - list scoping, insert userId), post isolation (3 - list scoping, counts scoping, multi-user scoping), API key isolation (2 - save scoping, query scoping)

### 12.5 Password Test Timeout Fix — COMPLETE
- [x] **Fixed flaky bcrypt test timeouts**
  - `webapp/__tests__/password.test.ts`: Added 15s timeout to tests doing multiple bcrypt hashes (cost factor 12 can be slow under load)

---

## Summary

| Phase | Description | Tasks | Status | Dependencies | Priority |
|-------|-------------|-------|--------|--------------|----------|
| 1-8 | Core Features & Testing | 30 | **COMPLETE** | Various | Various |
| 9 | Spec Compliance Audit | 6 | **COMPLETE (6/6)** | All phases | HIGH |
| 10 | Settings Unification & API Key Cache Fix | 3 | **COMPLETE (3/3)** | Phase 4, 9 | HIGH |
| 11 | Spec Compliance — UX Polish & Error Handling | 7 | **COMPLETE (7/7)** | Phase 10 | HIGH |
| 12 | Acceptance Criteria Test Coverage | 4 | **COMPLETE (4/4)** | Phase 11 | HIGH |

**Total Remaining Tasks: 0**

Current test coverage: 530 tests across 23 files:
- `webapp/__tests__/validations.test.ts` (72 tests)
- `webapp/__tests__/reddit.test.ts` (27 tests)
- `webapp/__tests__/actions/subreddits.test.ts` (26 tests)
- `webapp/__tests__/actions/tags.test.ts` (34 tests)
- `webapp/__tests__/actions/posts.test.ts` (31 tests)
- `webapp/__tests__/actions/auth.test.ts` (20 tests)
- `webapp/__tests__/actions/api-keys.test.ts` (28 tests)
- `webapp/__tests__/actions/data-isolation.test.ts` (10 tests — NEW)
- `webapp/__tests__/encryption.test.ts` (24 tests)
- `webapp/__tests__/password.test.ts` (17 tests)
- `webapp/__tests__/auth.test.ts` (22 tests)
- `webapp/__tests__/middleware.test.ts` (18 tests)
- `webapp/__tests__/components/pagination.test.tsx` (23 tests)
- `webapp/__tests__/components/tag-badge.test.tsx` (10 tests)
- `webapp/__tests__/components/status-tabs.test.tsx` (9 tests)
- `webapp/__tests__/components/post-card.test.tsx` (32 tests)
- `webapp/__tests__/components/post-list.test.tsx` (6 tests)
- `webapp/__tests__/components/suggest-terms.test.tsx` (26 tests — NEW)
- `webapp/__tests__/components/user-menu.test.tsx` (9 tests — NEW)
- `webapp/__tests__/components/header.test.tsx` (14 tests — NEW)
- `webapp/__tests__/utils.test.ts` (12 tests)
- `webapp/__tests__/api/suggest-terms.test.ts` (24 tests)
- `webapp/__tests__/hooks/index.test.tsx` (36 tests)

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
