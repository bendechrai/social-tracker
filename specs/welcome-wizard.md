# Welcome Wizard

A step-by-step onboarding guide for new users that walks them through initial setup using overlay prompts on the actual pages where each action happens.

## Overview

When a user has zero subreddits, the welcome wizard activates automatically. Each step navigates the user to the relevant page and displays an overlay explaining what to do. The user interacts with the real forms — no duplicate UI. The wizard tracks progress via URL query parameter and the data state itself.

## Trigger

The wizard is **data-driven**: it shows when the authenticated user has zero subreddits. No schema change or onboarding flag is needed.

- If a user deletes all their subreddits, the wizard will reappear on their next visit to `/dashboard`
- The wizard does not show on settings pages directly — only triggers from `/dashboard`

## Steps

### Step 1: Welcome (Dashboard)

- **Page**: `/dashboard`
- **Overlay content**:
  - Heading: "Welcome to Social Tracker"
  - Brief description: "Track Reddit posts across subreddits and organize them with tags. Let's get you set up."
  - Button: "Get Started"
- **Action**: Clicking "Get Started" navigates to `/settings/subreddits?onboarding=2`

### Step 2: Add a Subreddit (Settings/Subreddits)

- **Page**: `/settings/subreddits?onboarding=2`
- **Overlay content**:
  - Heading: "Add a Subreddit"
  - Description: "Subreddits are the source of your posts. Add at least one subreddit to start tracking. Posts from the last 7 days will be fetched automatically."
  - The overlay should not block the subreddit form — position it as a banner/card above or beside the form
- **Required**: User must add at least one subreddit to proceed
- **Progression**: Once a subreddit is successfully added, show a "Next" button that navigates to `/settings/api-keys?onboarding=3`

### Step 3: Groq API Key (Settings/API Keys)

- **Page**: `/settings/api-keys?onboarding=3`
- **Overlay content**:
  - Heading: "AI-Powered Suggestions (Optional)"
  - Description: "Add a Groq API key to enable AI-generated response suggestions for posts. This is free and optional — you can always add it later in settings."
  - Link: "Get a free API key at console.groq.com"
  - The overlay should not block the API key form
- **Skippable**: Show both "Skip" and "Next" buttons
- **Progression**: Either button navigates to `/settings/tags?onboarding=4`

### Step 4: Create a Tag (Settings/Tags)

- **Page**: `/settings/tags?onboarding=4`
- **Overlay content**:
  - Heading: "Organize with Tags"
  - Description: "Tags help you categorize posts. Each tag has search terms — posts matching those terms are automatically tagged. For example, a tag called 'Performance' with search terms 'slow', 'latency', 'benchmark' will auto-tag matching posts."
  - The overlay should not block the tag creation form
- **Skippable**: Show both "Skip" and "Done" buttons
- **Progression**: Either button navigates to `/dashboard` (wizard complete)

## Overlay Component

A reusable `OnboardingOverlay` component that:

- Renders as a card/banner on the page (not a blocking modal — the real form must remain interactive)
- Accepts: heading, description, step number (for progress indicator), action buttons
- Shows a step progress indicator (e.g., "Step 2 of 4")
- Only renders when the `onboarding` query parameter matches the expected step number
- Uses a subtle background highlight or border to draw attention

## State Management

- **Current step**: Tracked via `?onboarding=N` query parameter
- **Step completion detection**:
  - Step 2 (subreddit): Check if user's subreddit count > 0 after form submission
  - Step 3 (API key): User clicks "Next" or "Skip" (no data check needed)
  - Step 4 (tags): User clicks "Done" or "Skip" (no data check needed)
- **Entry point**: The dashboard page checks if the user has zero subreddits. If so, it shows the Step 1 welcome overlay. The overlay's "Get Started" button navigates to Step 2.
- **Re-entry**: If a user navigates away mid-wizard (e.g., closes the tab), they'll see the welcome overlay again on `/dashboard` since they still have zero subreddits. Once they have at least one subreddit, the wizard won't trigger.

## Acceptance Criteria

1. **Auto-triggers for new users** — Wizard appears on `/dashboard` when user has zero subreddits
2. **Real forms used** — Each step uses the actual settings page forms, not duplicated inputs
3. **Subreddit required** — User cannot skip Step 2; must add at least one subreddit
4. **API key skippable** — Step 3 can be skipped
5. **Tags skippable** — Step 4 can be skipped
6. **Progress indicator** — Each overlay shows current step out of total (e.g., "Step 2 of 4")
7. **Non-blocking overlay** — Overlay does not prevent interaction with the underlying form
8. **Explains tags clearly** — Step 4 explains the relationship between tags and search terms with an example
9. **Clean exit** — Completing or skipping the final step returns user to `/dashboard` with no overlay
10. **Re-triggers if no subreddits** — Wizard reappears if user somehow ends up with zero subreddits
