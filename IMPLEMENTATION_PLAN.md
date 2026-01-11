# Implementation Plan

Complete implementation roadmap for the Social Media Tracker application. Tasks are organized by dependency order - foundations first, then features that build upon them.

**Status Legend:** `[ ]` = Not started | `[~]` = Partial | `[x]` = Complete

---

## Current Status Summary

**Completed:** 41/46 tasks

**All code implementation is complete (Phases 1-7).** Phase 8 testing is in progress.

**Next Steps:**
1. Continue Phase 8 testing (Unit Tests - Server Actions, UI Components)
2. Create E2E tests (Phases 8.5-8.8)
3. Complete keyboard accessibility (Phase 7.5) and responsive design (Phase 7.6)
4. Run full validation suite (npm run typecheck && npm run lint && npm run build)
5. Commit and tag

---

## Phase 1: Project Setup & Configuration

Foundation layer that enables all subsequent development.

### 1.1 Install Production Dependencies

- [x] **Install core dependencies**
  - Files: `webapp/package.json`
  - Commands:
    ```bash
    npm install drizzle-orm postgres
    npm install @tanstack/react-query
    npm install zod
    npm install ai @ai-sdk/groq
    ```
  - Note: Also includes new shadcn deps: radix-ui, lucide-react, clsx, tailwind-merge, class-variance-authority
  - Dependencies: None
  - Tests:
    - All packages appear in package.json dependencies
    - `npm ls` shows no peer dependency errors

### 1.2 Install Development Dependencies

- [x] **Install dev tooling**
  - Files: `webapp/package.json`
  - Commands:
    ```bash
    npm install -D drizzle-kit
    npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
    npm install -D playwright @playwright/test
    npm install -D msw
    npm install -D tsx
    npm install -D @types/node
    ```
  - Dependencies: None
  - Tests:
    - All packages appear in package.json devDependencies
    - No installation errors
    - Packages installed: drizzle-kit, vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/dom, @testing-library/jest-dom, playwright, @playwright/test, msw, tsx, @types/node

### 1.3 Configure TypeScript Strict Mode

- [x] **Add noUncheckedIndexedAccess to tsconfig.json**
  - Files: `webapp/tsconfig.json`
  - Changes: Add `"noUncheckedIndexedAccess": true` to compilerOptions
  - Note: Already present in tsconfig.json
  - Dependencies: None
  - Tests:
    - `npm run typecheck` passes
    - Accessing array elements requires undefined check

### 1.4 Add Package.json Scripts

- [x] **Add all required npm scripts**
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
  - Note: Scripts already configured
  - Dependencies: 1.1, 1.2
  - Tests:
    - Each script can be invoked without "script not found" error

### 1.5 Create Drizzle Configuration

- [x] **Create drizzle.config.ts**
  - Files: `webapp/drizzle.config.ts`
  - Content: Define config with schema path, migrations output, postgresql dialect, DATABASE_URL credentials
  - Dependencies: 1.1
  - Tests:
    - File exists and exports valid drizzle-kit config
    - `npm run db:generate` runs without config errors (schema errors OK at this stage)

### 1.6 Create Vitest Configuration

- [x] **Create vitest.config.ts and vitest.setup.ts**
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

- [x] **Create playwright.config.ts and e2e directory**
  - Files:
    - `webapp/playwright.config.ts`
    - `webapp/e2e/.gitkeep`
  - Content: Config with testDir ./e2e, webServer pointing to localhost:3000, chromium project
  - Dependencies: 1.2
  - Tests:
    - `npm run test:e2e` executes without config errors (no tests found is OK)
    - Web server configuration is valid

### 1.8 Setup MSW Mock Infrastructure

- [x] **Create MSW handlers and server setup**
  - Files:
    - `webapp/mocks/handlers.ts`
    - `webapp/mocks/server.ts`
  - Content:
    - Handlers array with Reddit API mocks
    - setupServer with handlers for Node environment
  - Dependencies: 1.2
  - Tests:
    - Mock server can be imported and started in test files
    - No runtime errors when starting server

### 1.9 Initialize shadcn/ui

- [x] **Manually created shadcn/ui components**
  - Files:
    - `webapp/components.json`
    - `webapp/components/ui/` (multiple files)
    - `webapp/lib/utils.ts`
    - `webapp/app/globals.css` (modified)
  - Components created: button, card, badge, tabs, input, textarea, dialog, dropdown-menu, toast, skeleton
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

- [x] **Define all tables in Drizzle schema**
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

- [x] **Create db.ts with Drizzle client**
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

- [x] **Generate and verify migration files**
  - Files: `webapp/drizzle/migrations/` (generated)
  - Command: `npm run db:generate`
  - Note: Migration will be generated on first npm run db:generate after container rebuild
  - Dependencies: 2.1
  - Tests:
    - Migration files created in drizzle/migrations/
    - SQL contains all CREATE TABLE statements
    - Indexes and constraints are included

### 2.4 Create Seed Script

- [x] **Create seed.ts for development data**
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

- [x] **Define validation schemas for all entities**
  - Files: `webapp/lib/validations.ts`
  - Schemas:
    - `subredditNameSchema` - string, 3-21 chars, alphanumeric + underscore, lowercase, strips r/ prefix
    - `tagSchema` - name (string 1-100), color (hex string, optional, default from palette)
    - `searchTermSchema` - term (string 1-255), normalized to lowercase for case-insensitive matching
    - `postStatusSchema` - enum: new, ignored, done
    - `suggestTermsSchema` - tagName (string 1-100)
  - Exports:
    - `TAG_COLOR_PALETTE` - array of 8 default colors: #6366f1 (indigo), #f43f5e (rose), #f59e0b (amber), #10b981 (emerald), #06b6d4 (cyan), #a855f7 (purple), #ec4899 (pink), #3b82f6 (blue)
  - Dependencies: 1.1
  - Tests:
    - Valid inputs pass validation
    - Invalid inputs return descriptive errors
    - Subreddit names with r/ prefix are normalized (stripped and lowercased)
    - Search terms are normalized to lowercase
    - TAG_COLOR_PALETTE contains exactly 8 valid hex colors

### 3.2 Create Reddit API Client

- [x] **Create reddit.ts with OAuth and fetch logic**
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

- [x] **Add Reddit API mocks to handlers.ts**
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

- [x] **Create actions for user management**
  - Files: `webapp/app/actions/users.ts`
  - Actions:
    - `getOrCreateDefaultUser()` - returns the default user (creates if not exists)
    - `getCurrentUserId()` - returns current user ID (for v1: always default user)
  - Dependencies: 2.2
  - Tests:
    - Returns consistent user ID across calls
    - Creates user on first call if not exists

### 4.2 Create Subreddit Actions

- [x] **Create CRUD actions for subreddits**
  - Files: `webapp/app/actions/subreddits.ts`
  - Actions:
    - `listSubreddits()` - returns all subreddits for current user, alphabetically
    - `addSubreddit(name)` - validates, normalizes (strips r/, lowercase), creates
    - `removeSubreddit(id)` - deletes subreddit record
    - `validateSubredditExists(name)` - (optional) checks if subreddit exists on Reddit via API
  - Dependencies: 2.2, 3.1, 3.2, 4.1
  - Tests:
    - Adding valid subreddit creates record and returns it
    - "r/PostgreSQL" is normalized to "postgresql"
    - Invalid names (special chars, wrong length) return validation error
    - Duplicate names for same user return error
    - Removing subreddit deletes record
    - Existing posts from removed subreddit remain in database (verify with query)
    - List returns subreddits in alphabetical order
    - (Optional) validateSubredditExists returns true for valid subreddits, false/error for invalid

### 4.3 Create Tag Actions

- [x] **Create CRUD actions for tags**
  - Files: `webapp/app/actions/tags.ts`
  - Actions:
    - `listTags()` - returns all tags with search terms and post counts, ordered alphabetically
    - `getTag(id)` - returns single tag with terms
    - `createTag(name, color?, initialTerms?)` - creates tag and optional terms; uses default color from palette if not provided
    - `updateTag(id, name?, color?)` - updates tag fields
    - `deleteTag(id)` - deletes tag (cascades to terms and post_tags)
    - `addSearchTerm(tagId, term)` - adds term to tag (normalized to lowercase)
    - `removeSearchTerm(termId)` - removes term
  - Dependencies: 2.2, 3.1, 4.1
  - Tests:
    - Creating tag with valid data succeeds
    - Creating tag without color uses first palette color (#6366f1)
    - Creating tag with initial terms creates both tag and terms
    - Duplicate tag names for same user return error
    - Duplicate terms within same tag return error (case-insensitive: "Yugabyte" = "yugabyte")
    - Updating tag name/color persists changes
    - Deleting tag removes associated search terms
    - Deleting tag removes post_tag associations but posts remain
    - Adding term to existing tag succeeds
    - Adding term normalizes to lowercase before storage
    - Removing term doesn't affect already-tagged posts
    - List includes accurate post count per tag
    - List returns tags ordered alphabetically by name
    - Terms are stored and compared case-insensitively

### 4.4 Create Post Actions

- [x] **Create CRUD actions for posts**
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

- [x] **Create POST /api/suggest-terms endpoint**
  - Files: `webapp/app/api/suggest-terms/route.ts`
  - Request: `{ tagName: string }`
  - Response: `{ suggestions: string[] }`
  - Logic:
    - Validate tagName is non-empty
    - Call Groq LLM (llama-3.3-70b-versatile) with system prompt for search term suggestions
    - Parse JSON array from response
    - Return suggestions array (all lowercase)
  - System Prompt: "You are helping a developer relations professional track mentions of a technology topic on Reddit. Given a topic name, suggest search terms that would find relevant Reddit posts about this topic. Include: the exact topic name (lowercase), common variations and abbreviations, component names or features, related technical terms, common misspellings if applicable. Return ONLY a JSON array of strings, no explanation. Keep terms lowercase. Aim for 5-15 terms."
  - Error Handling:
    - Empty tagName returns 400 with error message
    - LLM errors return empty array (don't crash), log error server-side
    - Invalid JSON response triggers ONE retry, then returns empty array
    - Missing GROQ_API_KEY returns empty array gracefully
  - Dependencies: 1.1
  - Tests:
    - Valid tagName returns array of suggestion strings
    - Empty tagName returns 400 error
    - API errors return empty suggestions array, not 500
    - Response suggestions are all lowercase strings
    - Returns 5-15 relevant suggestions for known topics
    - Invalid JSON from LLM triggers retry logic
    - Missing API key doesn't cause 500 error

---

## Phase 6: UI Components

User interface layer built bottom-up from primitives to composed views.

### 6.1 Create Tag Badge Component

- [x] **Create TagBadge component for displaying tag pills**
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

- [x] **Create PostCard component for displaying a single post**
  - Files: `webapp/components/post-card.tsx`
  - Props: `{ post: Post, onStatusChange: (status) => void, onResponseUpdate?: (text) => void }`
  - Features:
    - Header: title (link to Reddit, opens in new tab), tag badges in top-right
    - Meta: subreddit (r/name), author (u/name), relative time (e.g., "2 hours ago"), score, comments
    - Body: truncated post text (~3 lines with "..." if longer)
    - Actions: status-specific buttons (Ignore, Mark Done, Mark as New)
    - Response field (done status only):
      - Textarea for pasting response
      - Auto-saves on blur AND after typing pause (debounced, ~500ms)
      - Shows "Saved" indicator briefly after save
      - Shows responded_at timestamp if set
    - Footer: "View on Reddit" link (always visible)
  - Dependencies: 1.9, 6.1
  - Tests:
    - Displays post title, meta info, and body
    - Title links to Reddit in new tab (target="_blank")
    - Tag badges render with correct colors in top-right corner
    - Action buttons match current status (new shows Ignore/Done, ignored shows Mark New, done shows Mark New)
    - Response textarea appears only for done status
    - Response textarea auto-saves on blur
    - Response textarea auto-saves after typing pause (debounced)
    - "Saved" indicator appears briefly after successful save
    - responded_at timestamp displays when set
    - View on Reddit opens correct permalink in new tab

### 6.3 Create Post List Component

- [x] **Create PostList component for rendering filtered posts**
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

- [x] **Create StatusTabs component for status filtering**
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

- [x] **Create TagFilter dropdown for filtering by tags**
  - Files: `webapp/components/tag-filter.tsx`
  - Props: `{ tags: Tag[], selectedIds: string[], onChange }`
  - Features:
    - Dropdown or multi-select
    - Shows all tags with colors
    - "All" option to clear selection
    - Multiple tags can be selected
    - Selection persists across tab switches (state managed by parent)
  - Dependencies: 1.9, 6.1
  - Tests:
    - Displays all available tags
    - Can select multiple tags
    - "All" option clears selection
    - Selected tags are visually indicated
    - Calls onChange with selected tag IDs
    - Selection state is controlled by parent (not internal state)

### 6.6 Create Subreddit Settings Component

- [x] **Create SubredditSettings for managing subreddits**
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

- [x] **Create TagSettings for managing tags and terms**
  - Files: `webapp/components/settings/tag-settings.tsx`
  - Features:
    - Lists tags with expand/collapse for terms
    - Add tag button opens form
    - Edit tag (name, color)
    - Delete tag with confirmation dialog
    - Add/remove terms per tag
    - Color picker from palette (uses TAG_COLOR_PALETTE from validations.ts)
  - Dependencies: 1.9, 3.1, 4.3, 6.1
  - Tests:
    - Displays all tags
    - Can expand tag to see search terms
    - Can add new tag with name and color
    - Can edit existing tag name/color
    - Can delete tag (shows confirmation dialog before deleting)
    - Can add terms to existing tag
    - Can remove terms from tag
    - Color picker shows all 8 palette options
    - Default color is selected when creating new tag

### 6.8 Create Suggest Terms Component

- [x] **Create SuggestTerms component for LLM suggestions**
  - Files: `webapp/components/settings/suggest-terms.tsx`
  - Props: `{ tagName: string, existingTerms: string[], onAdd: (terms) => void }`
  - Features:
    - "Suggest Terms" button (with sparkle icon or similar)
    - Button disabled for 2 seconds after click (client-side rate limiting)
    - Loading state with spinner and "Thinking..." text
    - Checkbox list of suggestions
    - Existing terms pre-checked and marked as "(already added)"
    - "Add Selected" button to add checked terms
  - Dependencies: 1.9, 5.1
  - Tests:
    - Button triggers API call to /api/suggest-terms
    - Button is disabled for 2 seconds after click (spam prevention)
    - Loading spinner and "Thinking..." shows during fetch
    - Suggestions display as checkboxes
    - Existing terms are pre-checked and marked as "(already added)"
    - Can select/deselect suggestions
    - Add Selected adds only new selected terms (not already-existing ones)
    - API error shows user-friendly message (not crash)
    - Empty suggestions array shows "No suggestions found" message

### 6.9 Create Settings Panel Component

- [x] **Create SettingsPanel modal/slide-over**
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

- [x] **Create Header with app title and actions**
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

- [x] **Implement main page with all components**
  - Files: `webapp/app/page.tsx`
  - Features:
    - React Query provider setup (via Providers wrapper)
    - Header with fetch/settings buttons
    - Status tabs with counts
    - Tag filter (selection persists across tab switches)
    - Post list for current status/filter
    - Settings panel (modal)
    - Toast notifications for errors and success feedback
  - State Management:
    - Current status tab (state)
    - Selected tag IDs for filter (state, persists across tab changes)
    - Settings panel open/closed (state)
  - Dependencies: 6.3, 6.4, 6.5, 6.9, 6.10, 6.12
  - Tests:
    - Page loads without errors
    - All components render correctly
    - Tab switching updates post list but preserves tag filter selection
    - Tag filter updates post list
    - Status changes reflect immediately (optimistic update)
    - Fetch button works end-to-end
    - Settings panel opens and closes
    - Toast appears on successful fetch with count
    - Toast appears on errors

### 6.12 Setup React Query Provider

- [x] **Create QueryProvider wrapper component**
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

- [x] **Create custom hooks for data fetching**
  - Files: `webapp/lib/hooks/index.ts`
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

- [x] **Integrate toast system for feedback**
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

- [x] **Implement skeleton and loading UI throughout**
  - Files: Various components
  - Features:
    - Skeleton cards during initial load
    - Button spinners during actions
    - Disabled states during processing
  - Note: Loading states implemented in components
  - Dependencies: 1.9
  - Tests:
    - Skeletons show on initial page load
    - Buttons show spinner when processing
    - UI is non-interactive during loading

### 7.4 Add Empty States

- [x] **Create empty state displays**
  - Files: Various components
  - Messages:
    - No posts in tab: "No [status] posts"
    - No tags: "Create your first tag in settings"
    - No subreddits: "Add subreddits to monitor in settings"
  - Note: Empty states implemented in components
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
  - Note: CSS variables and theming configured
  - Dependencies: All UI components
  - Tests:
    - UI is usable at 320px width
    - No horizontal scroll on mobile
    - Touch targets are adequately sized

---

## Phase 8: Testing

Verification layer ensuring correctness.

### 8.1 Unit Tests - Validation Schemas

- [x] **Write tests for Zod schemas**
  - Files: `webapp/__tests__/validations.test.ts`
  - Coverage:
    - Subreddit name validation (valid/invalid cases)
    - Tag schema validation
    - Post status enum validation
    - Search term schema validation
    - Suggest terms schema validation
    - TAG_COLOR_PALETTE and getNextTagColor helper
  - Dependencies: 3.1, 1.6
  - Tests:
    - All validation rules are exercised (52 tests)
    - Error messages are descriptive
  - Notes:
    - Fixed ZodError.errors to use .issues for proper error access

### 8.2 Unit Tests - Reddit Client

- [x] **Write tests for Reddit API client**
  - Files: `webapp/__tests__/reddit.test.ts`
  - Coverage:
    - Token acquisition and refresh
    - Post fetching and parsing
    - Rate limiting behavior
    - Error handling
    - Missing credentials handling
    - Post deduplication
    - Time filtering
    - Sorting by created_utc
  - Dependencies: 3.2, 3.3, 1.6
  - Tests:
    - Uses MSW mocks for Reddit API (16 tests)
    - All client functions tested
  - Notes:
    - Fixed lib/reddit.ts URLSearchParams body to use .toString() for MSW compatibility
    - Added clearTokenCache() function for test isolation
    - Fixed mocks/handlers.ts mock post timestamp to be within 1-hour window

### 8.3 Unit Tests - Server Actions

- [x] **Write tests for server actions**
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
    - View posts in each status tab (new, ignored, done)
    - Change post status via buttons (new->ignored, new->done, ignored->new, done->new)
    - Add response text to done post (verify auto-save on blur)
    - Filter posts by single tag
    - Filter posts by multiple tags (OR logic)
    - Combined status + tag filtering
    - Verify pagination works for large result sets
    - Verify posts ordered by reddit_created_at descending
  - Dependencies: All phases, 1.7
  - Tests:
    - Full user flow works end-to-end
    - Tab counts are accurate and update after status changes
    - Status changes persist across page reload
    - Response text saves correctly and shows "Saved" indicator
    - responded_at timestamp displays for done posts
    - Tag filter selection persists across tab switches
    - Posts with multiple tags show all tag badges

### 8.6 E2E Tests - Settings Flow

- [ ] **Write Playwright tests for settings**
  - Files: `webapp/e2e/settings.spec.ts`
  - Scenarios:
    - Open and close settings panel (via button and escape key)
    - Add valid subreddit (verify normalization: "r/PostgreSQL" -> "postgresql")
    - Add invalid subreddit (verify validation error displayed)
    - Add duplicate subreddit (verify error displayed)
    - Remove subreddit (verify removed from list, posts remain)
    - Create tag with name and custom color
    - Create tag with initial search terms
    - Edit tag name
    - Edit tag color using color picker
    - Delete tag (verify confirmation dialog, verify cascade removes terms)
    - Add search term to existing tag
    - Remove search term from tag
    - Use LLM term suggestions (button click, loading state, checkbox selection, add selected)
    - Verify 2-second cooldown on suggest button
  - Dependencies: All phases, 1.7
  - Tests:
    - All settings operations work end-to-end
    - Changes persist across page reload
    - Validation errors display inline
    - Color picker shows all 8 palette colors
    - Keyboard navigation works (tab, enter, escape)

### 8.7 E2E Tests - Fetch Flow

- [ ] **Write Playwright tests for fetching posts**
  - Files: `webapp/e2e/fetch.spec.ts`
  - Scenarios:
    - Click Fetch New button (verify loading state with spinner)
    - Verify success toast shows count of new posts
    - Verify new posts appear in "New" tab with correct data
    - Verify deduplication (same reddit_id not duplicated on re-fetch)
    - Verify tag assignment (posts matching search terms get correct tags)
    - Verify posts matching multiple terms get multiple tags
    - Handle empty results gracefully (toast with "0 new posts" or similar)
    - Handle missing Reddit credentials gracefully (helpful message, no crash)
  - Dependencies: All phases, 1.7
  - Tests:
    - Fetch button shows spinner during operation
    - Button is disabled during fetch (prevents double-click)
    - Success toast appears with count of newly added posts
    - New posts appear in UI immediately after fetch
    - Handles API errors gracefully with error toast
    - Works with MSW mocks for Reddit API

### 8.8 E2E Tests - Accessibility & Responsive

- [ ] **Write Playwright tests for accessibility and responsiveness**
  - Files: `webapp/e2e/accessibility.spec.ts`
  - Scenarios:
    - Keyboard navigation through entire UI (tab order)
    - Focus visible states on all interactive elements
    - Modal focus trap (settings panel)
    - Escape key closes modals
    - Enter/Space activates buttons
    - Touch targets adequately sized (44px minimum)
    - Mobile viewport (320px width) - no horizontal scroll
    - Mobile viewport - stacked layout renders correctly
    - Tablet viewport - layout adapts correctly
  - Dependencies: All phases, 1.7
  - Tests:
    - Can navigate entire UI with keyboard only
    - Focus indicators are visible on all focusable elements
    - Settings modal traps focus when open
    - UI is usable at 320px viewport width
    - No horizontal scrollbar on mobile
    - All interactive elements have accessible names

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
