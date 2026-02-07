# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-02-07 (Phase 21 Complete)
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
- **Post Ordering** - Posts ordered by Reddit creation time (newest first), not by DB insertion time
- **Unit Tests** - 27 test files (612 tests), no skipped or flaky tests
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

**Total Remaining Tasks: 0** — All phases complete

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
