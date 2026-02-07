# Landing Page

Marketing landing page for unauthenticated visitors at `/`.

## Overview

The landing page is the public face of Social Tracker. It speaks to developer advocates, community managers, and marketing teams who need to monitor social platforms for relevant conversations. The tone is personal and indie — built by a named developer, not a faceless corporation.

## Route

- **Path**: `/`
- **Auth**: Public (no authentication required)
- **Authenticated users**: Redirect to `/dashboard`
- **Implementation**: Server component using Next.js route group `(marketing)`

## Target Audience

Primary: Developer advocates who monitor communities for product mentions, support questions, and engagement opportunities.

Secondary: Marketing teams tracking brand mentions, competitors, and industry conversations.

Future: Team leads evaluating tools for their DevRel or marketing teams.

## Tone & Voice

- First person, personal. The creator is named and visible.
- Practitioner credibility — "I built this because I had this problem."
- Low-pressure. No corporate sales language, no urgency tactics.
- Honest about what exists now and what's coming.
- Conversational, not formal.

## Page Structure

### Hero Section

- App name: "Social Tracker"
- Creator byline with name and photo
- Personal origin story — one sentence explaining why this was built (e.g., "I kept missing Reddit threads where people were asking about things I could help with")
- Two CTAs:
  - Primary: "Try It Out" → `/signup`
  - Secondary: "Sign In" → `/login`

### What It Does (Current Features)

Three capabilities, described plainly:

1. **Monitors subreddits** — Pick your subreddits, get all recent posts automatically
2. **Tags and organizes** — Color-coded tags with search terms group posts by topic
3. **AI-powered suggestions** — LLM suggests search terms you haven't thought of

### What's Coming (Roadmap)

Tease upcoming features to show momentum and vision:

- **More platforms** — Hacker News, Twitter/X, Discord, Stack Overflow
- **AI response research** — For each post, get AI-generated context, relevant talking points, and a draft reply to help you respond faster and better
- **Team accounts** — Shared dashboards, assigned posts, team analytics

### Pricing

- **Individuals**: Monthly subscription, $0 or more (no upper limit). Donation-based — free to use, support if you find it valuable.
- **Teams & Enterprise**: Coming soon. No details yet, just signal that it's planned.

### Footer

- Personal attribution: "Made with care by [name]"
- No corporate boilerplate

## Acceptance Criteria

1. **Page renders at `/`** — Unauthenticated visitors see the landing page
2. **Authenticated redirect** — Logged-in users visiting `/` are redirected to `/dashboard`
3. **CTAs link correctly** — "Try It Out" goes to `/signup`, "Sign In" goes to `/login`
4. **Server component** — Page is a server component (auth check happens server-side, no flash)
5. **Mobile responsive** — Readable and usable on mobile devices
6. **No auth required** — Proxy/middleware allows `/` through without authentication
7. **Creator visible** — Page includes creator name and photo
8. **Roadmap visible** — Upcoming platforms and features are mentioned
9. **Pricing clear** — Individual donation model and future team plans are communicated
