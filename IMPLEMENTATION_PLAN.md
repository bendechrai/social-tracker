# Implementation Plan

Complete implementation roadmap for the Social Media Tracker application. Tasks are organized by dependency order - foundations first, then features that build upon them.

**Status Legend:** `[ ]` = Not started | `[~]` = Partial | `[x]` = Complete

---

## Current Status Summary

**Completed:** 0/45 tasks

**Current State (verified via code analysis):**
- Fresh Next.js 16 + React 19 project with default boilerplate
- Tailwind CSS 4 configured
- TypeScript configured (missing `noUncheckedIndexedAccess`)
- Basic package.json with only dev/build/start/lint scripts
- No application dependencies installed (drizzle, react-query, zod, ai SDK)
- No dev dependencies installed (vitest, playwright, msw, testing-library)
- No database schema, migrations, or seed data
- No lib utilities (db client, reddit client, validations)
- No server actions
- No API routes
- No UI components (no shadcn/ui)
- No tests (unit or e2e)

**Next Steps (Priority Order):**
1. Phase 1.1-1.2: Install all dependencies
2. Phase 1.3-1.8: Configure TypeScript, scripts, and tooling
3. Phase 1.9: Initialize shadcn/ui
4. Phase 2.1-2.4: Create database layer
5. Continue through remaining phases in order

---

## Phase 1: Project Setup & Configuration

Foundation layer that enables all subsequent development.

### 1.1 Install Production Dependencies

- [ ] **Install core dependencies**
  - Files: `webapp/package.json`
  - Commands:
    ```bash
    npm install drizzle-orm postgres
    npm install @tanstack/react-query
    npm install zod
    npm install ai @ai-sdk/groq
    ```
  - Dependencies: None
  - Tests:
    - All packages appear in package.json dependencies
    - `npm ls` shows no peer dependency errors

### 1.2 Install Development Dependencies

- [ ] **Install dev tooling**
  - Files: `webapp/package.json`
  - Commands:
    ```bash
    npm install -D drizzle-kit
    npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
    npm install -D playwright @playwright/test
    npm install -D msw
    npm install -D tsx
    ```
  - Dependencies: None
  - Tests:
    - All packages appear in package.json devDependencies
    - No installation errors

### 1.3 Configure TypeScript Strict Mode

- [ ] **Add noUncheckedIndexedAccess to tsconfig.json**
  - Files: `webapp/tsconfig.json`
  - Changes: Add `"noUncheckedIndexedAccess": true` to compilerOptions
  - Dependencies: None
  - Tests:
    - `npm run typecheck` passes
    - Accessing array elements requires undefined check

### 1.4 Add Package.json Scripts

- [ ] **Add all required npm scripts**
  - Files: `webapp/package.json`
  - Scripts to add:
    - `"typecheck": "tsc --noEmit"`
    - `"test": "vitest run"`
    - `"test:watch": "vitest"`
    - `"test:e2e": "playwright test"`
    - `"test:e2e:ui": "playwright test --ui"`
    - `"db:generate": "drizzle-kit generate"`
    - `"db:migrate": "drizzle-kit migrate"`
    - `"db:push": "drizzle-kit push"`
    - `"db:studio": "drizzle-kit studio"`
    - `"db:seed": "tsx drizzle/seed.ts"`
  - Dependencies: 1.1, 1.2
  - Tests:
    - Each script can be invoked without "script not found" error

### 1.5 Create Drizzle Configuration

- [ ] **Create drizzle.config.ts**
  - Files: `webapp/drizzle.config.ts`
  - Content: Define config with schema path, migrations output, postgresql dialect, DATABASE_URL credentials
  - Dependencies: 1.1
  - Tests:
    - File exists and exports valid drizzle-kit config
    - `npm run db:generate` runs without config errors (schema errors OK at this stage)

### 1.6 Create Vitest Configuration

- [ ] **Create vitest.config.ts and vitest.setup.ts**
  - Files:
    - `webapp/vitest.config.ts`
    - `webapp/vitest.setup.ts`
  - Content:
    - Config with jsdom environment, React plugin, path alias for @/
    - Setup file importing @testing-library/jest-dom/vitest
  - Dependencies: 1.2
  - Tests:
    - `npm run test` executes without config errors (no tests found is OK)
    - Path aliases resolve correctly in test files

### 1.7 Create Playwright Configuration

- [ ] **Create playwright.config.ts and e2e directory**
  - Files:
    - `webapp/playwright.config.ts`
    - `webapp/e2e/.gitkeep`
  - Content: Config with testDir ./e2e, webServer pointing to localhost:3000, chromium project
  - Dependencies: 1.2
  - Tests:
    - `npm run test:e2e` executes without config errors (no tests found is OK)
    - Web server configuration is valid

### 1.8 Setup MSW Mock Infrastructure

- [ ] **Create MSW handlers and server setup**
  - Files:
    - `webapp/mocks/handlers.ts`
    - `webapp/mocks/server.ts`
  - Content:
    - Empty handlers array export
    - setupServer with handlers for Node environment
  - Dependencies: 1.2
  - Tests:
    - Mock server can be imported and started in test files
    - No runtime errors when starting server

### 1.9 Initialize shadcn/ui

- [ ] **Run shadcn init and add required components**
  - Files:
    - `webapp/components.json`
    - `webapp/components/ui/` (multiple files)
    - `webapp/lib/utils.ts`
    - `webapp/app/globals.css` (modified)
  - Commands:
    ```bash
    npx shadcn@latest init
    npx shadcn@latest add button card tabs input textarea badge dialog dropdown-menu toast skeleton
    ```
  - Dependencies: 1.1
  - Tests:
    - components.json exists with valid config
    - All specified components exist in components/ui/
    - lib/utils.ts exports cn() function
    - Components can be imported without errors

---

## Phase 2: Database Layer

Data persistence layer that enables all CRUD operations.

### 2.1 Create Database Schema

- [ ] **Define all tables in Drizzle schema**
  - Files: `webapp/drizzle/schema.ts`
  - Tables to define:
    - `users` - id (uuid), email (varchar 255 unique), created_at, updated_at
    - `subreddits` - id (uuid), user_id (FK), name (varchar 100), created_at; unique(user_id, name)
    - `tags` - id (uuid), user_id (FK), name (varchar 100), color (varchar 7, default #6366f1), created_at; unique(user_id, name)
    - `search_terms` - id (uuid), tag_id (FK cascade), term (varchar 255), created_at; unique(tag_id, term)
    - `posts` - id (uuid), user_id (FK), reddit_id (varchar 20), title (text), body (text nullable), author (varchar 100), subreddit (varchar 100), permalink (text), url (text nullable), reddit_created_at (timestamp), score (int default 0), num_comments (int default 0), status (varchar 20 default 'new'), response_text (text nullable), responded_at (timestamp nullable), created_at, updated_at; unique(user_id, reddit_id); index(user_id, status)
    - `post_tags` - post_id (FK cascade), tag_id (FK cascade); PK(post_id, tag_id)
  - Dependencies: 1.5
  - Tests:
    - Schema file exports all table definitions
    - TypeScript types are inferred (no manual type definitions needed)
    - `npm run db:generate` produces migration files
    - Foreign key relationships are correctly defined
    - Cascade deletes are configured on search_terms, post_tags

### 2.2 Create Database Client

- [ ] **Create db.ts with Drizzle client**
  - Files: `webapp/lib/db.ts`
  - Content:
    - Import postgres and drizzle
    - Create connection using DATABASE_URL
    - Export typed db client
  - Dependencies: 2.1
  - Tests:
    - db client can be imported
    - TypeScript provides full autocomplete for schema tables
    - Connection works with valid DATABASE_URL

### 2.3 Generate Initial Migration

- [ ] **Generate and verify migration files**
  - Files: `webapp/drizzle/migrations/` (generated)
  - Command: `npm run db:generate`
  - Dependencies: 2.1
  - Tests:
    - Migration files created in drizzle/migrations/
    - SQL contains all CREATE TABLE statements
    - Indexes and constraints are included

### 2.4 Create Seed Script

- [ ] **Create seed.ts for development data**
  - Files: `webapp/drizzle/seed.ts`
  - Content:
    - Create default user (email: dev@example.com)
    - Create sample subreddits: postgresql, database, node
    - Create sample tags:
      - "Yugabyte" (color: #6366f1, terms: yugabyte, yugabytedb)
      - "Distributed PG" (color: #10b981, terms: distributed postgres, distributed postgresql)
    - Create sample posts (3+ per status: new, ignored, done) with varied tags
  - Dependencies: 2.2
  - Tests:
    - `npm run db:seed` completes without errors
    - All sample data is queryable after seed
    - Running seed twice doesn't create duplicates (upsert or check-before-insert)

---

## Phase 3: Core Utilities

Shared libraries that enable business logic and external integrations.

### 3.1 Create Zod Validation Schemas

- [ ] **Define validation schemas for all entities**
  - Files: `webapp/lib/validations.ts`
  - Schemas:
    - `subredditNameSchema` - string, 3-21 chars, alphanumeric + underscore, lowercase
    - `tagSchema` - name (string 1-100), color (hex string, optional)
    - `searchTermSchema` - term (string 1-255)
    - `postStatusSchema` - enum: new, ignored, done
    - `suggestTermsSchema` - tagName (string 1-100)
  - Dependencies: 1.1
  - Tests:
    - Valid inputs pass validation
    - Invalid inputs return descriptive errors
    - Subreddit names with r/ prefix are normalized

### 3.2 Create Reddit API Client

- [ ] **Create reddit.ts with OAuth and fetch logic**
  - Files: `webapp/lib/reddit.ts`
  - Exports:
    - `fetchRedditPosts(subreddits, searchTerms, timeWindow)` - fetches posts matching criteria
    - `isRedditConfigured()` - checks if credentials exist
  - Features:
    - OAuth2 token acquisition and refresh
    - Rate limiting (60 req/min)
    - Retry with exponential backoff
    - Proper User-Agent header
    - Graceful handling when credentials not configured
  - Dependencies: 1.1
  - Tests:
    - Returns empty array gracefully when credentials not configured
    - Correctly parses Reddit API response format
    - Extracts all required fields (reddit_id, title, body, author, subreddit, permalink, url, created_utc, score, num_comments)
    - Handles API errors without crashing
    - Rate limiting prevents exceeding 60 requests/minute

### 3.3 Create MSW Handlers for Reddit API

- [ ] **Add Reddit API mocks to handlers.ts**
  - Files: `webapp/mocks/handlers.ts`
  - Mocks:
    - POST oauth.reddit.com/api/v1/access_token - returns mock token
    - GET oauth.reddit.com/r/:subreddit/search - returns mock posts
  - Dependencies: 1.8, 3.2
  - Tests:
    - Mock server intercepts Reddit API calls in tests
    - Mock responses match Reddit API structure
    - Can simulate error responses for error handling tests

---

## Phase 4: Server Actions

Data mutation layer using Next.js Server Actions.

### 4.1 Create User Actions

- [ ] **Create actions for user management**
  - Files: `webapp/app/actions/users.ts`
  - Actions:
    - `getOrCreateDefaultUser()` - returns the default user (creates if not exists)
    - `getCurrentUserId()` - returns current user ID (for v1: always default user)
  - Dependencies: 2.2
  - Tests:
    - Returns consistent user ID across calls
    - Creates user on first call if not exists

### 4.2 Create Subreddit Actions

- [ ] **Create CRUD actions for subreddits**
  - Files: `webapp/app/actions/subreddits.ts`
  - Actions:
    - `listSubreddits()` - returns all subreddits for current user, alphabetically
    - `addSubreddit(name)` - validates, normalizes (strips r/, lowercase), creates
    - `removeSubreddit(id)` - deletes subreddit record
  - Dependencies: 2.2, 3.1, 4.1
  - Tests:
    - Adding valid subreddit creates record and returns it
    - "r/PostgreSQL" is normalized to "postgresql"
    - Invalid names (special chars, wrong length) return validation error
    - Duplicate names for same user return error
    - Removing subreddit deletes record
    - Existing posts from removed subreddit remain in database
    - List returns subreddits in alphabetical order

### 4.3 Create Tag Actions

- [ ] **Create CRUD actions for tags**
  - Files: `webapp/app/actions/tags.ts`
  - Actions:
    - `listTags()` - returns all tags with search terms and post counts
    - `getTag(id)` - returns single tag with terms
    - `createTag(name, color?, initialTerms?)` - creates tag and optional terms
    - `updateTag(id, name?, color?)` - updates tag fields
    - `deleteTag(id)` - deletes tag (cascades to terms and post_tags)
    - `addSearchTerm(tagId, term)` - adds term to tag
    - `removeSearchTerm(termId)` - removes term
  - Dependencies: 2.2, 3.1, 4.1
  - Tests:
    - Creating tag with valid data succeeds
    - Creating tag with initial terms creates both tag and terms
    - Duplicate tag names for same user return error
    - Duplicate terms within same tag return error
    - Updating tag name/color persists changes
    - Deleting tag removes associated search terms
    - Deleting tag removes post_tag associations but posts remain
    - Adding term to existing tag succeeds
    - Removing term doesn't affect already-tagged posts
    - List includes accurate post count per tag
    - Terms are handled case-insensitively

### 4.4 Create Post Actions

- [ ] **Create CRUD actions for posts**
  - Files: `webapp/app/actions/posts.ts`
  - Actions:
    - `listPosts(status, tagIds?, page?, limit?)` - paginated post list with filters
    - `getPost(id)` - single post with tags
    - `changePostStatus(id, status, responseText?)` - updates status and optional response
    - `updateResponseText(id, responseText)` - updates response without changing status
    - `fetchNewPosts()` - fetches from Reddit, dedupes, stores, returns count
  - Dependencies: 2.2, 3.1, 3.2, 4.1, 4.3
  - Tests:
    - New posts created with status "new"
    - Status transitions work: new->ignored, new->done, ignored->new, done->new
    - Setting status to "done" with response_text saves both and sets responded_at
    - Changing status from "done" clears responded_at but keeps response_text
    - Same reddit_id for same user is not duplicated
    - Post matching multiple search terms gets multiple tags attached
    - Filtering by status returns only matching posts
    - Filtering by tag(s) returns posts with ANY selected tag
    - Combined status+tag filtering works correctly
    - Pagination returns correct subset with total count
    - Posts ordered by reddit_created_at descending
    - fetchNewPosts returns count of newly added posts
    - fetchNewPosts handles missing Reddit credentials gracefully

---

## Phase 5: API Routes

RESTful endpoints for client-side features.

### 5.1 Create Suggest Terms API Route

- [ ] **Create POST /api/suggest-terms endpoint**
  - Files: `webapp/app/api/suggest-terms/route.ts`
  - Request: `{ tagName: string }`
  - Response: `{ suggestions: string[] }`
  - Logic:
    - Validate tagName is non-empty
    - Call Groq LLM with system prompt for search term suggestions
    - Parse JSON array from response
    - Return suggestions array
  - Error Handling:
    - Empty tagName returns 400
    - LLM errors return empty array (don't crash)
    - Invalid JSON response triggers retry, then empty array
  - Dependencies: 1.1
  - Tests:
    - Valid tagName returns array of suggestion strings
    - Empty tagName returns 400 error
    - API errors return empty suggestions array, not 500
    - Response suggestions are lowercase strings
    - Returns 5-15 relevant suggestions for known topics

---

## Phase 6: UI Components

User interface layer built bottom-up from primitives to composed views.

### 6.1 Create Tag Badge Component

- [ ] **Create TagBadge component for displaying tag pills**
  - Files: `webapp/components/tag-badge.tsx`
  - Props: `{ name: string, color: string, className?: string }`
  - Features:
    - Renders as colored pill/badge
    - Uses tag color as background with appropriate text contrast
  - Dependencies: 1.9
  - Tests:
    - Renders tag name text
    - Applies custom color as background
    - Maintains readable text contrast

### 6.2 Create Post Card Component

- [ ] **Create PostCard component for displaying a single post**
  - Files: `webapp/components/post-card.tsx`
  - Props: `{ post: Post, onStatusChange: (status) => void, onResponseUpdate?: (text) => void }`
  - Features:
    - Header: title (link to Reddit), tag badges
    - Meta: subreddit, author, relative time, score, comments
    - Body: truncated post text (~3 lines)
    - Actions: status-specific buttons (Ignore, Mark Done, Mark as New)
    - Response field: textarea for done status, auto-saves on blur
    - Footer: "View on Reddit" link
  - Dependencies: 1.9, 6.1
  - Tests:
    - Displays post title, meta info, and body
    - Title links to Reddit in new tab
    - Tag badges render with correct colors
    - Action buttons match current status (new shows Ignore/Done, ignored shows Mark New, done shows Mark New)
    - Response textarea appears only for done status
    - View on Reddit opens correct permalink

### 6.3 Create Post List Component

- [ ] **Create PostList component for rendering filtered posts**
  - Files: `webapp/components/post-list.tsx`
  - Props: `{ posts: Post[], onStatusChange, onResponseUpdate, isLoading }`
  - Features:
    - Maps posts to PostCard components
    - Shows skeleton loading state
    - Shows empty state message when no posts
  - Dependencies: 6.2
  - Tests:
    - Renders list of PostCard components
    - Shows skeleton cards during loading
    - Shows appropriate empty message when posts array is empty

### 6.4 Create Tab Bar Component

- [ ] **Create StatusTabs component for status filtering**
  - Files: `webapp/components/status-tabs.tsx`
  - Props: `{ currentStatus, counts: { new, ignored, done }, onChange }`
  - Features:
    - Three tabs: New, Ignored, Done
    - Each shows count in parentheses
    - Active tab visually distinct
  - Dependencies: 1.9
  - Tests:
    - Renders three tabs with labels
    - Shows correct count for each tab
    - Active tab has distinct styling
    - Clicking tab calls onChange with status value

### 6.5 Create Tag Filter Component

- [ ] **Create TagFilter dropdown for filtering by tags**
  - Files: `webapp/components/tag-filter.tsx`
  - Props: `{ tags: Tag[], selectedIds: string[], onChange }`
  - Features:
    - Dropdown or multi-select
    - Shows all tags with colors
    - "All" option to clear selection
    - Multiple tags can be selected
  - Dependencies: 1.9, 6.1
  - Tests:
    - Displays all available tags
    - Can select multiple tags
    - "All" option clears selection
    - Selected tags are visually indicated
    - Calls onChange with selected tag IDs

### 6.6 Create Subreddit Settings Component

- [ ] **Create SubredditSettings for managing subreddits**
  - Files: `webapp/components/settings/subreddit-settings.tsx`
  - Features:
    - Lists configured subreddits
    - Add subreddit input with button
    - Remove button per subreddit
    - Validation error display
  - Dependencies: 1.9, 4.2
  - Tests:
    - Displays list of subreddits
    - Can add new subreddit via input
    - Can remove subreddit with button
    - Shows validation errors for invalid input
    - Shows error for duplicate subreddit

### 6.7 Create Tag Settings Component

- [ ] **Create TagSettings for managing tags and terms**
  - Files: `webapp/components/settings/tag-settings.tsx`
  - Features:
    - Lists tags with expand/collapse for terms
    - Add tag button opens form
    - Edit tag (name, color)
    - Delete tag with confirmation
    - Add/remove terms per tag
    - Color picker from palette
  - Dependencies: 1.9, 4.3, 6.1
  - Tests:
    - Displays all tags
    - Can expand tag to see search terms
    - Can add new tag with name and color
    - Can edit existing tag name/color
    - Can delete tag (shows confirmation)
    - Can add terms to existing tag
    - Can remove terms from tag
    - Color picker shows palette options

### 6.8 Create Suggest Terms Component

- [ ] **Create SuggestTerms component for LLM suggestions**
  - Files: `webapp/components/settings/suggest-terms.tsx`
  - Props: `{ tagName: string, existingTerms: string[], onAdd: (terms) => void }`
  - Features:
    - "Suggest Terms" button
    - Loading state with spinner
    - Checkbox list of suggestions
    - Existing terms pre-checked and marked
    - "Add Selected" button
  - Dependencies: 1.9, 5.1
  - Tests:
    - Button triggers API call
    - Loading spinner shows during fetch
    - Suggestions display as checkboxes
    - Existing terms marked as "(already added)"
    - Can select/deselect suggestions
    - Add Selected adds only new selected terms
    - API error shows user-friendly message

### 6.9 Create Settings Panel Component

- [ ] **Create SettingsPanel modal/slide-over**
  - Files: `webapp/components/settings/settings-panel.tsx`
  - Features:
    - Modal or slide-over container
    - Sections for Subreddits and Tags
    - Close button
  - Dependencies: 1.9, 6.6, 6.7
  - Tests:
    - Opens as modal/slide-over
    - Contains Subreddit and Tag sections
    - Can be closed with button or escape key
    - Sections are visually separated

### 6.10 Create Header Component

- [ ] **Create Header with app title and actions**
  - Files: `webapp/components/header.tsx`
  - Features:
    - App title: "Social Tracker"
    - Fetch New button (triggers fetch, shows loading, displays result count)
    - Settings button (opens settings panel)
  - Dependencies: 1.9, 4.4
  - Tests:
    - Displays app title
    - Fetch New button triggers post fetch
    - Button shows loading state during fetch
    - Success shows count of new posts found
    - Settings button present and clickable

### 6.11 Create Main Page

- [ ] **Implement main page with all components**
  - Files: `webapp/app/page.tsx`
  - Features:
    - React Query provider setup
    - Header with fetch/settings
    - Status tabs with counts
    - Tag filter
    - Post list for current status/filter
    - Settings panel (modal)
    - Toast notifications for errors
  - Dependencies: 6.3, 6.4, 6.5, 6.9, 6.10
  - Tests:
    - Page loads without errors
    - All components render correctly
    - Tab switching updates post list
    - Tag filter updates post list
    - Status changes reflect immediately (optimistic update)
    - Fetch button works end-to-end
    - Settings panel opens and closes

### 6.12 Setup React Query Provider

- [ ] **Create QueryProvider wrapper component**
  - Files: `webapp/components/providers.tsx`
  - Features:
    - QueryClientProvider with configured client
    - Client-side only rendering
  - Dependencies: 1.1
  - Tests:
    - Provider wraps app without errors
    - React Query hooks work in child components

---

## Phase 7: Integration & Polish

Connect all pieces and ensure production readiness.

### 7.1 Create React Query Hooks

- [ ] **Create custom hooks for data fetching**
  - Files: `webapp/lib/hooks.ts`
  - Hooks:
    - `usePosts(status, tagIds)` - fetches and caches posts
    - `useTags()` - fetches and caches tags
    - `useSubreddits()` - fetches and caches subreddits
    - Mutation hooks for status changes, CRUD operations
  - Dependencies: 1.1, 4.2, 4.3, 4.4, 6.12
  - Tests:
    - Hooks return loading/error/data states
    - Mutations invalidate relevant queries
    - Optimistic updates work for status changes
    - Error states are handled

### 7.2 Add Toast Notifications

- [ ] **Integrate toast system for feedback**
  - Files:
    - `webapp/app/layout.tsx` (add Toaster)
    - Various components (add toast calls)
  - Features:
    - Success toasts for completed actions
    - Error toasts for failures
    - Auto-dismiss after delay
  - Dependencies: 1.9
  - Tests:
    - Toasts appear for success actions
    - Toasts appear for error conditions
    - Toasts auto-dismiss

### 7.3 Add Loading States

- [ ] **Implement skeleton and loading UI throughout**
  - Files: Various components
  - Features:
    - Skeleton cards during initial load
    - Button spinners during actions
    - Disabled states during processing
  - Dependencies: 1.9
  - Tests:
    - Skeletons show on initial page load
    - Buttons show spinner when processing
    - UI is non-interactive during loading

### 7.4 Add Empty States

- [ ] **Create empty state displays**
  - Files: Various components
  - Messages:
    - No posts in tab: "No [status] posts"
    - No tags: "Create your first tag in settings"
    - No subreddits: "Add subreddits to monitor in settings"
  - Dependencies: 6.3, 6.6, 6.7
  - Tests:
    - Empty states render when data is empty
    - Messages guide user to next action

### 7.5 Add Keyboard Accessibility

- [ ] **Ensure keyboard navigation works**
  - Files: Various components
  - Features:
    - Tab navigation through interactive elements
    - Enter/Space activates buttons
    - Escape closes modals
    - Focus visible states
  - Dependencies: All UI components
  - Tests:
    - Can navigate entire UI with keyboard only
    - Focus states are visible
    - Modals trap focus appropriately

### 7.6 Add Responsive Design

- [ ] **Ensure mobile responsiveness**
  - Files: Various components, `webapp/app/globals.css`
  - Features:
    - Mobile: stacked layout, full-width cards
    - Tablet: tighter spacing
    - Desktop: full layout as designed
  - Dependencies: All UI components
  - Tests:
    - UI is usable at 320px width
    - No horizontal scroll on mobile
    - Touch targets are adequately sized

---

## Phase 8: Testing

Verification layer ensuring correctness.

### 8.1 Unit Tests - Validation Schemas

- [ ] **Write tests for Zod schemas**
  - Files: `webapp/__tests__/validations.test.ts`
  - Coverage:
    - Subreddit name validation (valid/invalid cases)
    - Tag schema validation
    - Post status enum validation
  - Dependencies: 3.1, 1.6
  - Tests:
    - All validation rules are exercised
    - Error messages are descriptive

### 8.2 Unit Tests - Reddit Client

- [ ] **Write tests for Reddit API client**
  - Files: `webapp/__tests__/reddit.test.ts`
  - Coverage:
    - Token acquisition and refresh
    - Post fetching and parsing
    - Rate limiting behavior
    - Error handling
    - Missing credentials handling
  - Dependencies: 3.2, 3.3, 1.6
  - Tests:
    - Uses MSW mocks for Reddit API
    - All client functions tested

### 8.3 Unit Tests - Server Actions

- [ ] **Write tests for server actions**
  - Files:
    - `webapp/__tests__/actions/subreddits.test.ts`
    - `webapp/__tests__/actions/tags.test.ts`
    - `webapp/__tests__/actions/posts.test.ts`
  - Coverage:
    - All CRUD operations
    - Validation enforcement
    - Error conditions
  - Dependencies: 4.2, 4.3, 4.4, 1.6
  - Tests:
    - Uses test database or mocked db
    - All acceptance criteria from specs verified

### 8.4 Unit Tests - UI Components

- [ ] **Write tests for React components**
  - Files: `webapp/__tests__/components/` (various)
  - Coverage:
    - PostCard rendering and interactions
    - StatusTabs selection
    - TagFilter selection
    - Settings components CRUD
  - Dependencies: 6.*, 1.6
  - Tests:
    - Uses React Testing Library
    - Verifies rendering and user interactions

### 8.5 E2E Tests - Post Management Flow

- [ ] **Write Playwright tests for post lifecycle**
  - Files: `webapp/e2e/posts.spec.ts`
  - Scenarios:
    - View posts in each status tab
    - Change post status via buttons
    - Add response text to done post
    - Filter posts by tag
  - Dependencies: All phases, 1.7
  - Tests:
    - Full user flow works end-to-end
    - Status changes persist across page reload
    - Response text saves correctly

### 8.6 E2E Tests - Settings Flow

- [ ] **Write Playwright tests for settings**
  - Files: `webapp/e2e/settings.spec.ts`
  - Scenarios:
    - Add and remove subreddit
    - Create tag with search terms
    - Edit tag color
    - Delete tag
    - Use LLM term suggestions
  - Dependencies: All phases, 1.7
  - Tests:
    - All settings operations work end-to-end
    - Changes persist across sessions

### 8.7 E2E Tests - Fetch Flow

- [ ] **Write Playwright tests for fetching posts**
  - Files: `webapp/e2e/fetch.spec.ts`
  - Scenarios:
    - Click Fetch New with mock Reddit data
    - Verify new posts appear
    - Verify deduplication
    - Verify tag assignment
  - Dependencies: All phases, 1.7
  - Tests:
    - Fetch button triggers post import
    - New posts appear in UI
    - Handles empty results gracefully

---

## Dependency Graph Summary

```
Phase 1 (Setup)
    |
    v
Phase 2 (Database) --> Phase 3 (Utilities)
    |                       |
    v                       v
Phase 4 (Server Actions) <--+
    |
    v
Phase 5 (API Routes)
    |
    v
Phase 6 (UI Components) --> Phase 7 (Polish)
    |                           |
    v                           v
Phase 8 (Testing) <-------------+
```

---

## Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/social_tracker

# Reddit API (optional for dev)
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USERNAME=your_username
REDDIT_PASSWORD=your_password

# Groq LLM (for term suggestions)
GROQ_API_KEY=your_groq_api_key
```

---

## Success Criteria

The implementation is complete when:

1. All tasks above are checked complete
2. `npm run typecheck` passes with no errors
3. `npm run test` passes with all unit tests green
4. `npm run test:e2e` passes with all E2E tests green
5. `npm run build` succeeds
6. Application runs and all features work as specified
