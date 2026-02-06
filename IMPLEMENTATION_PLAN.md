# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-06
**Verification Method:** Automated codebase analysis against specs/*

---

## Current Status Overview

### Completed Features
- **Database Schema** - 6 core tables (users, posts, tags, subreddits, searchTerms, postTags) with proper relationships, indexes, and cascade deletes
- **Authentication** - Auth.js v5 with credentials provider, middleware, login/signup pages (with password visibility toggle), user menu, server actions, Drizzle adapter, 7-day sessions
- **Server Actions** - Full CRUD for posts, tags, subreddits, search terms with validation (4 action files + auth actions + API key actions)
- **Reddit Data Fetching** - Via Arctic Shift API (public, no auth), rate limit awareness, exponential backoff, upsert deduplication, 48h default time window
- **UI Components** - 23 components total (12 UI primitives including Label + 11 app components: post-list, post-card, tag-filter, tag-badge, status-tabs, header, user-menu, settings pages with subreddit/tag management, providers)
- **React Query Hooks** - 20 hooks for all CRUD operations with proper cache invalidation (19 in index.ts + use-toast: added useGroqApiKeyHint, useSaveGroqApiKey, useDeleteGroqApiKey)
- **Zod Validations** - Schemas for subreddits, tags, search terms, post status, suggest terms, password, email
- **Unit Tests** - 19 test files (467 tests total) — see Phase 8/9/10 for breakdown
- **Encryption System** - AES-256-GCM encryption utilities (encrypt/decrypt with iv:authTag:ciphertext format)
- **Password Utilities** - bcrypt hashing with cost factor 12
- **User API Keys (BYOK)** - Groq API key management with encrypted storage, functional settings UI, LLM integration with user key fallback
- **LLM Suggestions** - /api/suggest-terms endpoint using Groq API (falls back to env var), server-side rate limiting (10 req/min/user)
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

## Phases 1-8 — All COMPLETE

See git history for details. Phases covered: Authentication Foundation, Settings Foundation, Arctic Shift Integration, User API Keys (BYOK), UI Completion, Minor Improvements, E2E Testing, Test Coverage Gaps.

---

## Phase 9: Spec Compliance Audit — COMPLETE (6/6)

**Status: COMPLETE**
**Priority: HIGH — Closes gaps between specs and implementation**

### 9.1 Seed Script Password Hashing — COMPLETE
- [x] **Fix seed script to hash password with bcrypt and use correct email**
  - Seed script now uses `test@example.com` (per spec, was `dev@example.com`)
  - Password `TestPassword123!` is hashed with bcrypt before storage
  - Seeded user can now log in via credentials auth

### 9.2 Password Visibility Toggle — COMPLETE
- [x] **Add show/hide toggle to all password fields**
  - Login page: password field with Eye/EyeOff toggle
  - Signup page: password and confirm password fields with independent toggles
  - Account settings: current, new, and confirm password fields with independent toggles
  - Uses `tabIndex={-1}` to avoid disrupting form tab navigation
  - Accessible with `aria-label` for screen readers

### 9.3 Suggest Terms Button Disabled Without API Key — COMPLETE
- [x] **Disable Suggest Terms button when no Groq API key is configured**
  - Added `useHasGroqApiKey` hook (queries `hasGroqApiKey` server action)
  - `SuggestTerms` component accepts `hasGroqKey` prop, disables button when false
  - Shows tooltip: "Add your Groq API key in Settings to enable suggestions"
  - Shows inline message directing to Settings → API Keys when no key configured
  - Props threaded through `SettingsPanel` → `TagSettings` → `SuggestTerms`

### 9.4 Server-Side Rate Limiting — COMPLETE
- [x] **Add rate limiting to /api/suggest-terms (10 req/min per user)**
  - In-memory rate limiter with sliding window (1-minute window, 10 requests max)
  - Returns 429 with error message when exceeded
  - Unauthenticated users bypass rate limiting (can only use env var key)
  - Rate limiter state exported for test cleanup between test cases
  - 3 new tests: within limit, exceeded limit, unauthenticated bypass

### 9.5 Dashboard Configuration Banner — COMPLETE
- [x] **Add banner for missing subreddits or search terms**
  - Shows "No subreddits configured" banner with Settings link when no subreddits
  - Shows "No tags or search terms configured" banner when subreddits exist but no tags
  - Only shown after initial data load (not during loading skeleton)
  - Settings button opens the settings modal for quick configuration

### 9.6 Upsert Deduplication Pattern — COMPLETE
- [x] **Switch post deduplication from query-then-insert to upsert**
  - Uses `db.insert().values().onConflictDoNothing({ target: [posts.userId, posts.redditId] }).returning()`
  - Returns empty array when post already exists (conflict), skips tag assignment
  - Race-condition safe: no gap between check and insert
  - Updated test mock to support `onConflictDoNothing` chain
  - Updated deduplication test to verify upsert behavior (insert is called, returns empty)

---

## Phase 10: Settings Unification & API Key Cache Fix — COMPLETE (3/3)

**Status: COMPLETE**
**Priority: HIGH — Unifies settings interface and fixes cache invalidation bug**

### 10.1 Unified Settings Page — COMPLETE
- [x] **Consolidate all settings into /settings with sidebar navigation**
  - Created `/settings/subreddits` page using SubredditSettings component
  - Created `/settings/tags` page using TagSettings component with Groq key integration
  - Updated `layout.tsx` with 4 nav items: Account, API Keys, Subreddits, Tags
  - Removed `SettingsPanel` modal component (was splitting settings across modal + pages)
  - All 4 settings sections now accessible from single /settings page, matching spec requirement

### 10.2 React Query Hooks for API Keys — COMPLETE
- [x] **Add React Query hooks with proper cache invalidation**
  - Added `useSaveGroqApiKey` hook that invalidates `hasGroqApiKey` cache on success
  - Added `useDeleteGroqApiKey` hook that invalidates `hasGroqApiKey` cache on success
  - Added `useGroqApiKeyHint` hook for fetching encrypted key hint
  - Refactored API keys page to use React Query hooks instead of direct server actions
  - Fixes bug: saving/deleting keys on settings page now immediately updates dashboard Suggest Terms button state

### 10.3 Dashboard Simplification — COMPLETE
- [x] **Remove settings modal from dashboard**
  - Dashboard config banners now link to `/settings/subreddits` and `/settings/tags`
  - UserMenu Settings item navigates to `/settings` instead of opening modal
  - Settings modal removed from dashboard component tree
  - Added 6 new hook tests for Groq API key operations with cache invalidation verification

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
| 9 | Spec Compliance Audit | 6 | **COMPLETE (6/6)** | All phases | HIGH |
| 10 | Settings Unification & API Key Cache Fix | 3 | **COMPLETE (3/3)** | Phase 4, 9 | HIGH |

**Total Remaining Tasks: 0**

Current test coverage: 467 tests across 19 files:
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
- `webapp/__tests__/components/post-card.test.tsx` (32 tests - includes post-card post-card)
- `webapp/__tests__/components/post-list.test.tsx` (6 tests)
- `webapp/__tests__/utils.test.ts` (12 tests)
- `webapp/__tests__/api/suggest-terms.test.ts` (22 tests)
- `webapp/__tests__/hooks/index.test.tsx` (34 tests - added useGroqApiKeyHint, useSaveGroqApiKey, useDeleteGroqApiKey with cache invalidation)

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
