# Implementation Plan - Social Media Tracker

This document outlines the implementation status and remaining tasks for completing the social media tracker application. Tasks are organized by priority and dependency order.

**Last Verified:** 2026-01-11
**Verification Method:** Automated codebase analysis against specs/*

---

## Current Status Overview

### Completed Features ✓
- **Database Schema** - 6 core tables (users, posts, tags, subreddits, searchTerms, postTags) with proper relationships, indexes, and cascade deletes
- **Server Actions** - Full CRUD for posts, tags, subreddits, search terms with validation (4 action files)
- **Reddit API Client** - Using app-level credentials (password grant), rate limiting (60/min), exponential backoff, token caching, deduplication
- **UI Components** - 22 components total (11 UI primitives + 11 app components: post-list, post-card, tag-filter, tag-badge, status-tabs, header, settings modal with subreddit/tag management, providers)
- **React Query Hooks** - 16 hooks for all CRUD operations with proper cache invalidation (15 in index.ts + use-toast)
- **Zod Validations** - Schemas for subreddits, tags, search terms, post status, suggest terms
- **Unit Tests** - 5 test files (152 tests total): validations.test.ts (43), reddit.test.ts (21), subreddits.test.ts (15), tags.test.ts (44), posts.test.ts (29)
- **LLM Suggestions** - /api/suggest-terms endpoint using Groq API (falls back to env var)
- **Toast System** - Complete notification system
- **Project Setup** - Vitest, Playwright, MSW configured; all dependencies except auth packages

### Specification Requirements Reference
- **Auth**: Auth.js v5, bcrypt cost 12, password 12+ chars with upper/lower/number/symbol, 7-day sessions
- **Encryption**: AES-256-GCM with format iv:authTag:ciphertext (base64)
- **Reddit OAuth**: Scopes read, identity; encrypted token storage (per-user, NOT app-level)
- **LLM**: User's own Groq key (BYOK) with fallback to env var

### Current Authentication State
The application currently uses a placeholder authentication system:
- `webapp/app/actions/users.ts` has `getOrCreateDefaultUser()` creating "dev@example.com"
- `getCurrentUserId()` always returns the default user ID
- NO real authentication - this is a CRITICAL blocker for production use

### Known Issues (Minor)
- `webapp/lib/hooks/use-toast.ts` line 8: `TOAST_REMOVE_DELAY = 1000000` (~16.7 minutes) appears unusually high
- `webapp/lib/reddit.ts`: Several hardcoded values (rate limits, retry delays) could be made configurable
- `webapp/app/api/suggest-terms/route.ts` line 42: LLM model `llama-3.3-70b-versatile` is hardcoded

### Missing Files Summary (Verified)
The following files DO NOT exist and need to be created:
- `webapp/lib/encryption.ts` - AES-256-GCM encryption utilities
- `webapp/lib/password.ts` - bcrypt password hashing
- `webapp/lib/auth.ts` - Auth.js configuration
- `webapp/middleware.ts` - Route protection
- `webapp/app/login/page.tsx` - Login page
- `webapp/app/signup/page.tsx` - Signup page
- `webapp/app/settings/` - Entire directory (settings is modal only, no dedicated pages)
- `webapp/app/actions/auth.ts` - Authentication server actions
- `webapp/app/actions/api-keys.ts` - API key management
- `webapp/app/actions/reddit-connection.ts` - Reddit OAuth connection
- `webapp/app/api/auth/*` - All auth API routes
- `webapp/components/user-menu.tsx` - User dropdown menu
- `webapp/components/ui/pagination.tsx` - Pagination controls
- `webapp/__tests__/hooks/*` - No hook tests exist
- `webapp/__tests__/components/*` - No component tests exist
- `webapp/__tests__/api/*` - No API route tests exist
- `webapp/__tests__/utils.test.ts` - No utils tests
- `webapp/__tests__/encryption.test.ts` - No encryption tests
- `webapp/__tests__/password.test.ts` - No password tests

### Missing Database Schema (Verified)
- Sessions, accounts, verification_tokens tables (required by Auth.js)
- Users table missing columns: password_hash, reddit_access_token, reddit_refresh_token, reddit_token_expires_at, reddit_username, groq_api_key

### Missing Packages (Verified)
- next-auth NOT installed
- bcrypt NOT installed
- @types/bcrypt NOT installed

---

## Phase 1: Authentication Foundation

**Status: NOT STARTED**
**Priority: CRITICAL** - All other phases depend on this

Authentication is the foundational layer that all other features depend on.

### 1.1 Install Authentication Dependencies
- [ ] **Add auth packages to package.json**
  - Description: Install next-auth (Auth.js v5) and bcrypt packages
  - Dependencies: None
  - Files to modify: `webapp/package.json`
  - Commands: `npm install next-auth@beta bcrypt && npm install -D @types/bcrypt`
  - Acceptance Criteria:
    - [ ] next-auth@beta installed
    - [ ] bcrypt installed
    - [ ] @types/bcrypt installed as dev dependency
  - **Test Requirements**:
    - Verify packages are in package.json
    - Verify imports work without errors

### 1.2 Database Schema for Authentication
- [ ] **Add authentication columns to users table**
  - Description: Extend the users table with password_hash column and OAuth token columns for Reddit integration
  - Dependencies: None
  - Files to modify: `webapp/drizzle/schema.ts`, create migration in `webapp/drizzle/`
  - Acceptance Criteria:
    - [ ] users table has `password_hash` column (text, nullable for OAuth-only users)
    - [ ] users table has `reddit_access_token` column (text, nullable, for encrypted token)
    - [ ] users table has `reddit_refresh_token` column (text, nullable, for encrypted token)
    - [ ] users table has `reddit_token_expires_at` column (timestamp, nullable)
    - [ ] users table has `reddit_username` column (text, nullable)
    - [ ] users table has `groq_api_key` column (text, nullable, for encrypted key)
    - [ ] Migration runs successfully without data loss
  - **Test Requirements**:
    - Unit test: Verify schema exports include new columns
    - Integration test: Migration applies cleanly to test database

- [ ] **Create Auth.js required tables**
  - Description: Add sessions, accounts, and verification_tokens tables required by Auth.js v5
  - Dependencies: None
  - Files to create/modify: `webapp/drizzle/schema.ts`, create migration
  - Acceptance Criteria:
    - [ ] `sessions` table exists with: id, sessionToken, userId, expires
    - [ ] `accounts` table exists with: id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
    - [ ] `verification_tokens` table exists with: identifier, token, expires
    - [ ] Foreign key relationships properly defined with cascade deletes
    - [ ] Migration runs successfully
  - **Test Requirements**:
    - Unit test: Verify all Auth.js tables are exported from schema
    - Integration test: Verify foreign key constraints work correctly

### 1.3 Encryption System
- [ ] **Implement AES-256-GCM encryption utilities**
  - Description: Create encryption module for sensitive data (tokens, API keys)
  - Dependencies: None
  - Files to create: `webapp/lib/encryption.ts`
  - Acceptance Criteria:
    - [ ] `encrypt(plaintext: string): string` function implemented
    - [ ] `decrypt(ciphertext: string): string` function implemented
    - [ ] Uses AES-256-GCM algorithm
    - [ ] Output format is `iv:authTag:ciphertext` (base64 encoded)
    - [ ] Uses `ENCRYPTION_KEY` environment variable (32 bytes for AES-256)
    - [ ] Throws meaningful errors for invalid input or missing key
  - **Test Requirements**:
    - Unit test: encrypt/decrypt round-trip returns original plaintext
    - Unit test: Different plaintexts produce different ciphertexts (IV uniqueness)
    - Unit test: Tampered ciphertext throws authentication error
    - Unit test: Missing ENCRYPTION_KEY throws descriptive error
    - Unit test: Invalid ciphertext format throws descriptive error

### 1.4 Password Utilities
- [ ] **Implement password hashing utilities**
  - Description: Create password hashing and verification functions using bcrypt
  - Dependencies: 1.1 (bcrypt package)
  - Files to create: `webapp/lib/password.ts`
  - Acceptance Criteria:
    - [ ] `hashPassword(password: string): Promise<string>` function implemented
    - [ ] `verifyPassword(password: string, hash: string): Promise<boolean>` function implemented
    - [ ] Uses bcrypt with cost factor 12 (per spec)
    - [ ] Hash output is valid bcrypt format
  - **Test Requirements**:
    - Unit test: hashPassword produces valid bcrypt hash
    - Unit test: verifyPassword returns true for correct password
    - Unit test: verifyPassword returns false for incorrect password
    - Unit test: Different passwords produce different hashes

- [ ] **Implement password validation schema**
  - Description: Create Zod schema for password requirements per specification
  - Dependencies: None
  - Files to modify: `webapp/lib/validations.ts`
  - Acceptance Criteria:
    - [ ] Password schema requires minimum 12 characters
    - [ ] Password schema requires at least one uppercase letter
    - [ ] Password schema requires at least one lowercase letter
    - [ ] Password schema requires at least one number
    - [ ] Password schema requires at least one symbol
    - [ ] Validation error messages are user-friendly and specific
  - **Test Requirements**:
    - Unit test: Valid password passes validation
    - Unit test: Password <12 chars fails with appropriate message
    - Unit test: Password without uppercase fails
    - Unit test: Password without lowercase fails
    - Unit test: Password without number fails
    - Unit test: Password without symbol fails

### 1.5 Auth.js Configuration
- [ ] **Set up Auth.js v5 (NextAuth) configuration**
  - Description: Configure Auth.js with credentials provider and session management
  - Dependencies: 1.2 (database schema), 1.3 (encryption), 1.4 (password utils)
  - Files to create: `webapp/lib/auth.ts`, `webapp/app/api/auth/[...nextauth]/route.ts`
  - Acceptance Criteria:
    - [ ] Auth.js v5 configured with Drizzle adapter
    - [ ] Credentials provider configured for email/password login
    - [ ] Session strategy set to JWT with 7-day expiry (per spec)
    - [ ] Session callback includes user id and email
    - [ ] `AUTH_SECRET` environment variable used
    - [ ] Export `auth`, `signIn`, `signOut` from lib/auth.ts
    - [ ] Authorize callback verifies password using bcrypt
  - **Test Requirements**:
    - Unit test: Credentials provider rejects invalid email format
    - Unit test: Credentials provider rejects wrong password
    - Unit test: Credentials provider accepts valid credentials
    - Integration test: Session contains expected user data

### 1.6 Authentication Middleware
- [ ] **Create authentication middleware**
  - Description: Protect routes that require authentication
  - Dependencies: 1.5 (Auth.js configuration)
  - Files to create: `webapp/middleware.ts`
  - Acceptance Criteria:
    - [ ] Middleware runs on protected routes (/, /settings/*, API routes except /api/auth/*)
    - [ ] Unauthenticated users redirected to /login
    - [ ] Public routes (/login, /signup, /api/auth/*) accessible without auth
    - [ ] API routes return 401 JSON response for unauthenticated requests
    - [ ] Middleware matcher configured correctly
  - **Test Requirements**:
    - Integration test: Unauthenticated request to / redirects to /login
    - Integration test: Unauthenticated request to /api/posts returns 401
    - Integration test: Request to /login succeeds without auth
    - Integration test: Authenticated request to / succeeds

### 1.7 Authentication UI
- [ ] **Create signup page**
  - Description: User registration page with email and password
  - Dependencies: 1.5 (Auth.js), 1.4 (password validation)
  - Files to create: `webapp/app/signup/page.tsx`, `webapp/app/actions/auth.ts`
  - Acceptance Criteria:
    - [ ] Form with email, password, and password confirmation fields
    - [ ] Client-side validation showing password requirements
    - [ ] Server action to create user with hashed password
    - [ ] Error handling for duplicate email (user-friendly message)
    - [ ] Success redirects to login page
    - [ ] Link to login page for existing users
    - [ ] Loading state during form submission
  - **Test Requirements**:
    - Unit test: Server action rejects mismatched passwords
    - Unit test: Server action rejects duplicate email
    - Unit test: Server action creates user with hashed password
    - E2E test: Full signup flow (Phase 7)

- [ ] **Create login page**
  - Description: User login page with email and password
  - Dependencies: 1.5 (Auth.js)
  - Files to create: `webapp/app/login/page.tsx`
  - Acceptance Criteria:
    - [ ] Form with email and password fields
    - [ ] Uses Auth.js signIn function
    - [ ] Error handling for invalid credentials (generic message for security)
    - [ ] Success redirects to dashboard (/)
    - [ ] Link to signup page for new users
    - [ ] Loading state during form submission
  - **Test Requirements**:
    - Unit test: Form validates required fields
    - E2E test: Full login flow (Phase 7)

- [ ] **Add user menu to header**
  - Description: Dropdown menu showing logged-in user info with sign out option
  - Dependencies: 1.5 (Auth.js), 1.7 login/signup pages
  - Files to create: `webapp/components/user-menu.tsx`
  - Files to modify: `webapp/components/header.tsx`
  - Acceptance Criteria:
    - [ ] Shows user email when logged in
    - [ ] Dropdown with "Settings" and "Sign out" options
    - [ ] Sign out clears session and redirects to login
    - [ ] Shows "Sign in" / "Sign up" links when not logged in
    - [ ] Accessible keyboard navigation
  - **Test Requirements**:
    - Unit test: Renders user email when session exists
    - Unit test: Renders sign in link when no session
    - E2E test: Sign out flow (Phase 7)

### 1.8 Update Existing Server Actions
- [ ] **Replace placeholder user system with real authentication**
  - Description: Update all server actions to use authenticated user instead of default user
  - Dependencies: 1.5 (Auth.js), 1.6 (Middleware)
  - Files to modify: `webapp/app/actions/users.ts`, `webapp/app/actions/posts.ts`, `webapp/app/actions/tags.ts`, `webapp/app/actions/subreddits.ts`
  - Acceptance Criteria:
    - [ ] Remove `getOrCreateDefaultUser()` function
    - [ ] Update `getCurrentUserId()` to get user from Auth.js session
    - [ ] All server actions properly use authenticated user ID
    - [ ] Actions return appropriate error when not authenticated
  - **Test Requirements**:
    - Unit test: Server actions reject unauthenticated requests
    - Unit test: Server actions use correct user ID from session
    - Integration test: CRUD operations work with authenticated user

---

## Phase 2: Settings Foundation

**Status: NOT STARTED**
**Priority: HIGH** - Required for user-configurable features
**Dependencies: Phase 1 (Authentication)**

Note: Currently settings functionality exists only as a modal. This phase creates dedicated settings pages.

### 2.1 Settings Page Structure
- [ ] **Create settings page layout**
  - Description: Settings page with navigation for Account, Connected Accounts, API Keys sections
  - Dependencies: Phase 1 (Authentication)
  - Files to create: `webapp/app/settings/page.tsx`, `webapp/app/settings/layout.tsx`
  - Acceptance Criteria:
    - [ ] Settings page accessible at /settings
    - [ ] Protected route (requires authentication via middleware)
    - [ ] Sidebar or tab navigation for different sections
    - [ ] Responsive layout (sidebar collapses on mobile)
    - [ ] Breadcrumb navigation
  - **Test Requirements**:
    - E2E test: Navigation between settings sections (Phase 7)

### 2.2 Account Settings
- [ ] **Implement password change functionality**
  - Description: Allow users to change their password
  - Dependencies: 2.1 (Settings page), 1.4 (password utilities)
  - Files to create: `webapp/app/settings/account/page.tsx`
  - Files to modify: `webapp/app/actions/auth.ts`
  - Acceptance Criteria:
    - [ ] Form with current password, new password, confirm new password
    - [ ] Validates current password before allowing change
    - [ ] New password must meet password requirements (shown to user)
    - [ ] Success toast notification on password change
    - [ ] Error handling for incorrect current password
    - [ ] Form clears after successful change
  - **Test Requirements**:
    - Unit test: Server action rejects incorrect current password
    - Unit test: Server action rejects invalid new password
    - Unit test: Server action updates password hash in database
    - E2E test: Full password change flow (Phase 7)

---

## Phase 3: Reddit OAuth Integration

**Status: NOT STARTED**
**Priority: HIGH** - Required for per-user Reddit access
**Dependencies: Phase 1 (Authentication)**

Note: Currently the app uses app-level password grant authentication (REDDIT_USERNAME/REDDIT_PASSWORD env vars). This phase implements per-user OAuth as specified.

### 3.1 Reddit OAuth Flow
- [ ] **Implement Reddit OAuth initiation**
  - Description: Generate OAuth URL and redirect user to Reddit for authorization
  - Dependencies: Phase 1 (Authentication)
  - Files to create: `webapp/app/api/auth/reddit/route.ts`
  - Acceptance Criteria:
    - [ ] Generates proper Reddit OAuth URL with required scopes (read, identity)
    - [ ] Includes state parameter for CSRF protection (stored in session/cookie)
    - [ ] Uses REDDIT_CLIENT_ID env var
    - [ ] Redirect URI matches registered Reddit app callback URL
    - [ ] Returns redirect response to Reddit authorization page
  - **Test Requirements**:
    - Unit test: Generated URL contains correct scopes
    - Unit test: State parameter is cryptographically random
    - Integration test: Redirect URL is properly formatted

- [ ] **Implement Reddit OAuth callback route**
  - Description: Handle OAuth callback from Reddit after user authorization
  - Dependencies: 3.1 (OAuth initiation), 1.3 (Encryption)
  - Files to create: `webapp/app/api/auth/reddit/callback/route.ts`
  - Acceptance Criteria:
    - [ ] Validates state parameter matches (CSRF protection)
    - [ ] Receives authorization code from Reddit
    - [ ] Exchanges code for access and refresh tokens
    - [ ] Encrypts tokens using encryption module before storage
    - [ ] Stores encrypted tokens in users table
    - [ ] Stores token expiration time
    - [ ] Redirects to settings page on success with success message
    - [ ] Error handling for OAuth failures (user denied, invalid code, etc.)
  - **Test Requirements**:
    - Unit test: Invalid state parameter returns error
    - Unit test: Token exchange failure handled gracefully
    - Integration test: Tokens are encrypted before database storage
    - Integration test: Successful flow updates user record

- [ ] **Refactor Reddit API client for per-user tokens**
  - Description: Update Reddit API calls to use user's OAuth tokens instead of app-level credentials
  - Dependencies: 3.1 (OAuth flow complete), 1.3 (Encryption)
  - Files to modify: `webapp/lib/reddit.ts`
  - Acceptance Criteria:
    - [ ] New function signature accepts userId to fetch user's tokens
    - [ ] Decrypt tokens before use
    - [ ] Implement automatic token refresh when access token expired
    - [ ] Update refresh token in database after refresh
    - [ ] Update all Reddit API call functions to use per-user auth
    - [ ] Graceful error handling when user has no connected Reddit account
    - [ ] Maintain backward compatibility during transition (optional fallback to env vars for development)
  - **Test Requirements**:
    - Unit test: Token refresh logic works correctly
    - Unit test: Expired token triggers refresh
    - Unit test: Missing user tokens throws descriptive error
    - Integration test: API calls work with decrypted user tokens

### 3.2 Reddit Connection UI
- [ ] **Create Connected Accounts settings section**
  - Description: UI to connect/disconnect Reddit account
  - Dependencies: 3.1 (OAuth flow), 2.1 (Settings page)
  - Files to create: `webapp/app/settings/connected-accounts/page.tsx`
  - Files to create: `webapp/app/actions/reddit-connection.ts`
  - Acceptance Criteria:
    - [ ] Shows Reddit connection status (connected/not connected)
    - [ ] If connected, shows Reddit username (fetched via identity scope)
    - [ ] Shows when token expires
    - [ ] "Connect Reddit" button initiates OAuth flow
    - [ ] "Disconnect" button removes stored tokens from database
    - [ ] Confirmation dialog before disconnect
    - [ ] Success/error toast notifications
  - **Test Requirements**:
    - Unit test: Disconnect action removes tokens from database
    - E2E test: Connect and disconnect flows (Phase 7)

---

## Phase 4: User API Keys (BYOK)

**Status: NOT STARTED**
**Priority: MEDIUM** - Required for user-owned LLM access
**Dependencies: Phase 1 (Authentication)**

### 4.1 API Key Storage
- [ ] **Implement Groq API key storage**
  - Description: Server actions to save and retrieve encrypted Groq API key
  - Dependencies: Phase 1 (Auth), 1.3 (Encryption), 1.2 (groq_api_key column)
  - Files to create: `webapp/app/actions/api-keys.ts`
  - Acceptance Criteria:
    - [ ] `saveGroqApiKey(key: string)` server action
    - [ ] Validates API key format (basic validation)
    - [ ] Encrypts key before storing in database
    - [ ] `getGroqApiKey()` server action returns decrypted key (for internal use only)
    - [ ] `hasGroqApiKey()` server action returns boolean (for UI)
    - [ ] `deleteGroqApiKey()` server action removes key
    - [ ] Only accessible to authenticated user for their own key
  - **Test Requirements**:
    - Unit test: saveGroqApiKey encrypts before storage
    - Unit test: getGroqApiKey decrypts correctly
    - Unit test: deleteGroqApiKey removes key from database
    - Unit test: Actions require authentication

### 4.2 API Keys UI
- [ ] **Create API Keys settings section**
  - Description: UI to manage user's Groq API key
  - Dependencies: 4.1 (API key storage), 2.1 (Settings page)
  - Files to create: `webapp/app/settings/api-keys/page.tsx`
  - Acceptance Criteria:
    - [ ] Shows if Groq API key is configured (without revealing the key)
    - [ ] Input field to add/update API key (password type, masked)
    - [ ] "Save" button to store key
    - [ ] "Remove" button to delete key (shown only if key exists)
    - [ ] Confirmation dialog before removal
    - [ ] Success/error toast notifications
    - [ ] Help text explaining what the API key is used for
    - [ ] Link to Groq API key generation page
  - **Test Requirements**:
    - E2E test: Add and remove API key flows (Phase 7)

### 4.3 LLM Integration Update
- [ ] **Update LLM suggestions to use per-user API key**
  - Description: Modify tag suggestion feature to use user's Groq API key if available
  - Dependencies: 4.1 (API key storage)
  - Files to modify: `webapp/app/api/suggest-terms/route.ts`
  - Files to create (if needed): `webapp/lib/llm.ts`
  - Acceptance Criteria:
    - [ ] Check for user's Groq API key first (decrypt and use)
    - [ ] Fall back to env var GROQ_API_KEY if user has no key
    - [ ] Clear error message if no API key available (neither user nor env)
    - [ ] Tag suggestions work identically with user-provided key
    - [ ] No key leakage in error messages or logs
  - **Test Requirements**:
    - Unit test: User key used when available
    - Unit test: Fallback to env var when no user key
    - Unit test: Appropriate error when no keys available
    - Integration test: Suggestions work with user-provided key

---

## Phase 5: UI Completion

**Status: NOT STARTED**
**Priority: MEDIUM** - Improves user experience
**Dependencies: None (backend already supports pagination)**

### 5.1 Pagination UI
- [ ] **Implement pagination controls component**
  - Description: UI controls for paginating post lists (backend already supports pagination via page/limit params)
  - Dependencies: None (backend ready)
  - Files to create: `webapp/components/ui/pagination.tsx`
  - Files to modify: `webapp/components/post-list.tsx`, `webapp/lib/hooks/index.ts`
  - Acceptance Criteria:
    - [ ] Previous/Next page buttons
    - [ ] Current page indicator (e.g., "Page 2 of 10")
    - [ ] Total pages display (calculated from total count)
    - [ ] Page size selector dropdown (10, 25, 50 options)
    - [ ] Disabled state for first/last page buttons appropriately
    - [ ] Keyboard accessible (arrow keys, enter)
    - [ ] Updates URL query params for shareable/bookmarkable pagination state
    - [ ] React Query hooks pass pagination params to server actions
  - **Test Requirements**:
    - Unit test: Pagination component renders correct page numbers
    - Unit test: Disabled states work correctly at boundaries
    - Unit test: Page size change resets to page 1
    - E2E test: Pagination navigation works (Phase 7)

---

## Phase 6: Minor Improvements

**Status: PARTIAL**
**Priority: LOW** - Quality of life improvements

### 6.1 Code Integration
- [x] **getNextTagColor utility defined and tested**
  - Note: Utility exists in `webapp/lib/validations.ts` line 70 and has unit tests in `webapp/__tests__/validations.test.ts`
  - Status: COMPLETE

- [ ] **Integrate getNextTagColor in tag creation**
  - Description: The getNextTagColor() utility is defined and tested but NOT USED anywhere in actual application code (server actions or components); integrate it where appropriate
  - Dependencies: None
  - Files to modify: `webapp/app/actions/tags.ts`, potentially `webapp/components/settings/tag-settings.tsx`
  - Acceptance Criteria:
    - [ ] getNextTagColor() called when creating new tags without explicit color
    - [ ] New tags automatically assigned next available color from palette
    - [ ] Color rotation works correctly (cycles through palette)
  - **Test Requirements**:
    - Integration test: Created tag has auto-assigned color
    - Unit test: Sequential tag creation produces different colors

### 6.2 Optional Enhancements
- [ ] **Subreddit existence verification**
  - Description: Verify subreddit exists via Reddit API when adding new subreddit
  - Dependencies: Phase 3 (Reddit OAuth) - requires authenticated Reddit API access
  - Files to modify: `webapp/app/actions/subreddits.ts`, `webapp/lib/reddit.ts`
  - Acceptance Criteria:
    - [ ] API call to Reddit to verify subreddit exists before adding
    - [ ] User-friendly error message if subreddit doesn't exist
    - [ ] Graceful handling of rate limits (retry or skip verification)
    - [ ] Works without Reddit connection (skip verification with warning)
  - **Test Requirements**:
    - Unit test: Valid subreddit passes verification
    - Unit test: Invalid subreddit returns appropriate error
    - Unit test: Verification skipped gracefully when no Reddit connection

---

## Phase 7: End-to-End Testing

**Status: NOT STARTED**
**Priority: MEDIUM** - Quality assurance
**Dependencies: All features implemented**

Note: Playwright is configured but `webapp/e2e/` directory only contains `.gitkeep` (empty)

### 7.1 Playwright Test Infrastructure
- [ ] **Configure Playwright test helpers**
  - Description: Set up Playwright with proper configuration and test utilities
  - Dependencies: All features implemented
  - Files to modify: `webapp/playwright.config.ts`
  - Files to create: `webapp/e2e/fixtures.ts`, `webapp/e2e/helpers/auth.ts`
  - Acceptance Criteria:
    - [ ] Playwright configured to run against dev/test server
    - [ ] Test database seeding strategy implemented (separate test DB or transactions)
    - [ ] Authentication helper utilities for tests (login as test user)
    - [ ] Page object models for common pages (optional but recommended)
    - [ ] CI configuration for running E2E tests
  - **Test Requirements**:
    - Verify test setup works with `npx playwright test --project=setup`

### 7.2 Authentication E2E Tests
- [ ] **Write E2E tests for authentication flows**
  - Description: Test signup, login, logout, and protected routes
  - Dependencies: 7.1 (Playwright setup), Phase 1 (Authentication)
  - Files to create: `webapp/e2e/auth.spec.ts`
  - Acceptance Criteria:
    - [ ] Test successful signup with valid credentials
    - [ ] Test signup validation errors (weak password, duplicate email)
    - [ ] Test successful login
    - [ ] Test login with invalid credentials shows error
    - [ ] Test logout clears session
    - [ ] Test protected route redirect to login when unauthenticated
    - [ ] Test session persistence across page reloads

### 7.3 Core Feature E2E Tests
- [ ] **Write E2E tests for post management**
  - Description: Test post listing, filtering, status changes, tagging
  - Dependencies: 7.1 (Playwright setup)
  - Files to create: `webapp/e2e/posts.spec.ts`
  - Acceptance Criteria:
    - [ ] Test post list displays correctly with data
    - [ ] Test tag filtering shows only matching posts
    - [ ] Test status tab filtering (new, ignored, done)
    - [ ] Test status transitions (new -> ignored, new -> done)
    - [ ] Test pagination navigation (if implemented)
    - [ ] Test multi-tag assignment to a post
    - [ ] Test removing tags from a post

- [ ] **Write E2E tests for subreddit management**
  - Description: Test adding, editing, removing subreddits
  - Dependencies: 7.1 (Playwright setup)
  - Files to create: `webapp/e2e/subreddits.spec.ts`
  - Acceptance Criteria:
    - [ ] Test adding new subreddit via settings
    - [ ] Test subreddit name normalization (r/ prefix handling)
    - [ ] Test duplicate subreddit prevention shows error
    - [ ] Test removing subreddit with confirmation
    - [ ] Test subreddit list updates after changes

- [ ] **Write E2E tests for tag management**
  - Description: Test tag CRUD operations
  - Dependencies: 7.1 (Playwright setup)
  - Files to create: `webapp/e2e/tags.spec.ts`
  - Acceptance Criteria:
    - [ ] Test creating new tag with name and color
    - [ ] Test editing tag name
    - [ ] Test editing tag color
    - [ ] Test deleting tag with confirmation
    - [ ] Test tag color picker interaction

### 7.4 Settings E2E Tests
- [ ] **Write E2E tests for settings pages**
  - Description: Test account settings, connected accounts, API keys
  - Dependencies: 7.1 (Playwright setup), Phases 2-4 (Settings features)
  - Files to create: `webapp/e2e/settings.spec.ts`
  - Acceptance Criteria:
    - [ ] Test password change flow (success and error cases)
    - [ ] Test Reddit connect button initiates OAuth (mock OAuth flow)
    - [ ] Test Reddit disconnect with confirmation
    - [ ] Test Groq API key add with masked input
    - [ ] Test Groq API key remove with confirmation

---

## Phase 8: Test Coverage Gaps

**Status: PARTIAL** (server action tests complete, other categories not started)
**Priority: LOW** - Additional quality assurance

Note: Current test coverage includes 152 tests across 5 files:
- `webapp/__tests__/validations.test.ts` (43 tests)
- `webapp/__tests__/reddit.test.ts` (21 tests)
- `webapp/__tests__/actions/subreddits.test.ts` (15 tests)
- `webapp/__tests__/actions/tags.test.ts` (44 tests)
- `webapp/__tests__/actions/posts.test.ts` (29 tests)

**Verified Missing:** No .test.tsx files exist (no component tests). No hook tests exist.

Missing test categories: hooks, components, API routes, utils, encryption, password utilities.

### 8.1 Missing Unit Tests
- [ ] **Add utils.ts unit tests**
  - Description: Test utility functions in lib/utils.ts
  - Files to create: `webapp/__tests__/utils.test.ts`
  - Acceptance Criteria:
    - [ ] Test all exported utility functions
    - [ ] Test edge cases and error conditions

- [ ] **Add API route tests**
  - Description: Test /api/suggest-terms endpoint
  - Files to create: `webapp/__tests__/api/suggest-terms.test.ts`
  - Acceptance Criteria:
    - [ ] Test successful suggestion generation
    - [ ] Test validation errors
    - [ ] Test missing API key handling
    - [ ] Test rate limiting behavior

- [ ] **Add encryption module tests**
  - Description: Test encryption utilities (once implemented in Phase 1.3)
  - Files to create: `webapp/__tests__/encryption.test.ts`
  - Acceptance Criteria:
    - [ ] Test encrypt/decrypt round-trip
    - [ ] Test IV uniqueness
    - [ ] Test tamper detection
    - [ ] Test error handling for missing key

- [ ] **Add password module tests**
  - Description: Test password utilities (once implemented in Phase 1.4)
  - Files to create: `webapp/__tests__/password.test.ts`
  - Acceptance Criteria:
    - [ ] Test hash generation
    - [ ] Test password verification
    - [ ] Test bcrypt cost factor

### 8.2 Component Tests
- [ ] **Add React component tests**
  - Description: Test UI components with React Testing Library
  - Files to create: `webapp/__tests__/components/` directory with test files
  - Acceptance Criteria:
    - [ ] Test post-card rendering and interactions
    - [ ] Test tag-filter selection behavior
    - [ ] Test status-tabs switching
    - [ ] Test settings panels CRUD operations
    - [ ] Test toast notifications

### 8.3 Hook Tests
- [ ] **Add React Query hook tests**
  - Description: Test custom hooks with mock providers
  - Files to create: `webapp/__tests__/hooks/` directory with test files
  - Acceptance Criteria:
    - [ ] Test query hooks return correct data
    - [ ] Test mutation hooks trigger cache invalidation
    - [ ] Test loading and error states

---

## Summary

| Phase | Description | Tasks | Status | Dependencies | Priority |
|-------|-------------|-------|--------|--------------|----------|
| 1 | Authentication Foundation | 11 | NOT STARTED | None | **CRITICAL** |
| 2 | Settings Foundation | 2 | NOT STARTED | Phase 1 | HIGH |
| 3 | Reddit OAuth Integration | 4 | NOT STARTED | Phase 1 | HIGH |
| 4 | User API Keys (BYOK) | 3 | NOT STARTED | Phase 1 | MEDIUM |
| 5 | UI Completion (Pagination) | 1 | NOT STARTED | None | LOW |
| 6 | Minor Improvements | 2 | PARTIAL (1/2) | Various | LOW |
| 7 | E2E Testing | 6 | NOT STARTED | All features | MEDIUM |
| 8 | Test Coverage Gaps | 6 | PARTIAL | None | LOW |

**Total Remaining Tasks: 35**

### Acceptance Criteria Test Coverage (by spec)
| Spec | Criteria | Tested | Gap |
|------|----------|--------|-----|
| authentication.md | 16 | 0 | 16 |
| user-api-keys.md | 12 | 0 | 12 |
| tag-system.md | 8 | 7 | 1 |
| post-management.md | 9 | 8 | 1 |
| subreddit-configuration.md | 8 | 7 | 1 |
| reddit-integration.md | 12 | 5 | 7 |
| llm-tag-suggestions.md | 12 | 0 | 12 |
| ui-components.md | 24 | 0 | 24 |

**Completed Tasks (from analysis):**
- Database schema (6 core tables)
- Server actions (4 files: posts, tags, subreddits, users placeholder)
- UI Components (22 components)
- React Query hooks (16 hooks)
- Zod validations (5 schemas + getNextTagColor utility - defined but not integrated)
- Unit tests (5 test files, 152 tests total)
- LLM suggestions endpoint
- Toast system
- Project configuration

### Critical Path
```
Phase 1 (Authentication) - CRITICAL BLOCKER
    |
    +---> Phase 2 (Settings Foundation)
    |         |
    |         +---> Phase 7.4 (Settings E2E Tests)
    |
    +---> Phase 3 (Reddit OAuth)
    |         |
    |         +---> Phase 6.2 (Subreddit Verification - optional)
    |
    +---> Phase 4 (User API Keys)
    |
    +---> Phase 7.2 (Auth E2E Tests)

Phase 5 (Pagination) ---> Independent, can start anytime

Phase 6.1 (getNextTagColor) ---> Independent, can start anytime

Phase 7.1 (Playwright Setup) ---> Prerequisite for all E2E tests
Phase 7.3 (Core E2E Tests) ---> Can start after 7.1

Phase 8 (Test Coverage Gaps) ---> Independent, can start anytime
```

### Quick Wins (No Dependencies)
These tasks can be completed immediately without waiting for Phase 1:
1. **Phase 6.1** - Integrate getNextTagColor in tag creation (~30 min)
2. **Phase 5.1** - Implement pagination controls (~2-4 hours)
3. **Phase 8.1** - Add utils.ts unit tests (~1 hour)
4. **Phase 8.1** - Add API route tests for suggest-terms (~2 hours)

### Recommended Implementation Order
1. **Phase 1.1-1.4** - Install deps, schema, encryption, password utils (parallel work possible)
2. **Phase 1.5-1.8** - Auth.js config, middleware, UI, update actions (sequential)
3. **Phase 5** - Pagination (independent, can be done in parallel with Phase 2-4)
4. **Phase 6.1** - getNextTagColor integration (quick win)
5. **Phase 2** - Settings foundation
6. **Phase 3** - Reddit OAuth (can parallel with Phase 4)
7. **Phase 4** - User API Keys
8. **Phase 8** - Additional unit/component/hook tests (can be done incrementally)
9. **Phase 7** - E2E Testing (after all features)
10. **Phase 6.2** - Subreddit verification (optional, after Phase 3)

### Environment Variables Required
```bash
# Existing (already in use)
DATABASE_URL=                    # PostgreSQL connection string
REDDIT_CLIENT_ID=                # Reddit app client ID
REDDIT_CLIENT_SECRET=            # Reddit app client secret

# New - Required for Phase 1
AUTH_SECRET=                     # For Auth.js session signing (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=                  # 32-byte key for AES-256-GCM (generate with: openssl rand -base64 32)

# Existing - Will remain as fallback
GROQ_API_KEY=                    # Fallback API key for LLM (optional if users provide their own)

# Currently used but to be deprecated after Phase 3
REDDIT_USERNAME=                 # Remove after per-user OAuth implemented
REDDIT_PASSWORD=                 # Remove after per-user OAuth implemented
```

### Files to Create (Summary)
```
webapp/
├── lib/
│   ├── auth.ts                           # Phase 1.5
│   ├── encryption.ts                     # Phase 1.3
│   ├── password.ts                       # Phase 1.4
│   └── llm.ts                            # Phase 4.3 (optional refactor)
├── middleware.ts                         # Phase 1.6
├── app/
│   ├── login/
│   │   └── page.tsx                      # Phase 1.7
│   ├── signup/
│   │   └── page.tsx                      # Phase 1.7
│   ├── settings/
│   │   ├── layout.tsx                    # Phase 2.1
│   │   ├── page.tsx                      # Phase 2.1
│   │   ├── account/
│   │   │   └── page.tsx                  # Phase 2.2
│   │   ├── connected-accounts/
│   │   │   └── page.tsx                  # Phase 3.2
│   │   └── api-keys/
│   │       └── page.tsx                  # Phase 4.2
│   ├── actions/
│   │   ├── auth.ts                       # Phase 1.7
│   │   ├── api-keys.ts                   # Phase 4.1
│   │   └── reddit-connection.ts          # Phase 3.2
│   └── api/
│       └── auth/
│           ├── [...nextauth]/
│           │   └── route.ts              # Phase 1.5
│           └── reddit/
│               ├── route.ts              # Phase 3.1
│               └── callback/
│                   └── route.ts          # Phase 3.1
├── components/
│   ├── user-menu.tsx                     # Phase 1.7
│   └── ui/
│       └── pagination.tsx                # Phase 5.1
├── __tests__/
│   ├── utils.test.ts                     # Phase 8.1
│   ├── encryption.test.ts                # Phase 8.1
│   ├── password.test.ts                  # Phase 8.1
│   ├── api/
│   │   └── suggest-terms.test.ts         # Phase 8.1
│   ├── components/                       # Phase 8.2
│   │   └── *.test.tsx
│   └── hooks/                            # Phase 8.3
│       └── *.test.ts
└── e2e/
    ├── fixtures.ts                       # Phase 7.1
    ├── helpers/
    │   └── auth.ts                       # Phase 7.1
    ├── auth.spec.ts                      # Phase 7.2
    ├── posts.spec.ts                     # Phase 7.3
    ├── subreddits.spec.ts                # Phase 7.3
    ├── tags.spec.ts                      # Phase 7.3
    └── settings.spec.ts                  # Phase 7.4
```

### Files to Modify (Summary)
```
webapp/
├── package.json                          # Phase 1.1 (add auth deps)
├── drizzle/
│   └── schema.ts                         # Phase 1.2 (auth columns + tables)
├── lib/
│   ├── validations.ts                    # Phase 1.4 (password schema)
│   └── reddit.ts                         # Phase 3.1 (per-user tokens)
├── components/
│   ├── header.tsx                        # Phase 1.7 (user menu)
│   ├── post-list.tsx                     # Phase 5.1 (pagination)
│   └── settings/
│       └── tag-settings.tsx              # Phase 6.1 (getNextTagColor)
├── lib/hooks/
│   └── index.ts                          # Phase 5.1 (pagination params)
└── app/
    ├── actions/
    │   ├── users.ts                      # Phase 1.8 (replace placeholder)
    │   ├── posts.ts                      # Phase 1.8 (use real auth)
    │   ├── tags.ts                       # Phase 1.8, 6.1 (auth + getNextTagColor)
    │   └── subreddits.ts                 # Phase 1.8, 6.2 (auth + verification)
    └── api/
        └── suggest-terms/
            └── route.ts                  # Phase 4.3 (user API key)
```
