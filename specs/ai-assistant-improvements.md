# AI Assistant Improvements

Enhancements to the AI chat assistant based on observed user behavior, focusing on anti-hallucination guardrails, tone calibration, user profiling, and draft reply refinement shortcuts.

## Background — User Observation

Analysis of a YugabyteDB developer advocate's usage revealed these patterns:

1. **44 messages to craft 1-2 Reddit comments** — The user spent most of her time refining tone and authenticity, not generating content. She repeatedly asked the AI to "make it sound less like AI", "remove flowery language", and "shorten it".

2. **Context the AI didn't have** — The AI didn't know she was a DevRel professional for YugabyteDB. Every conversation started cold, and she had to re-explain her role and goals each time.

3. **Asked AI to visit URLs and research** — She asked the AI to review GitHub repos and external links. The AI couldn't do this but didn't clearly say so, risking hallucinated information about codebases it never read.

4. **Tone mismatch** — The default system prompt produces generic, helpful responses. A DevRel professional needs responses that sound like a real developer in a community conversation — casual, technical, peer-to-peer, not corporate or salesy.

5. **Iterative refinement loop** — She followed a pattern: get draft → critique → refine → critique → refine. The AI could front-load this if it knew her preferences from the start.

## Implementation Order

These improvements are ordered by impact-to-effort ratio. Each can be implemented and shipped independently.

1. **Anti-hallucination guardrails + web research disclosure** — System prompt only. No DB, no UI.
2. **Tone calibration** — System prompt only. No DB, no UI.
3. **User profile** — DB migration + settings UI + system prompt integration.
4. **Draft reply quick-action chips** — ChatPanel UI only. No backend.

---

## Improvement 1: Anti-Hallucination Guardrails

### Problem

The AI currently has no explicit instruction to avoid making up information. When a user asks it to look at a GitHub URL or research a tool, it may fabricate details about code it hasn't read.

### Solution

Add explicit anti-hallucination instructions to the system prompt.

### File to Modify

`webapp/app/api/chat/route.ts` — the `buildSystemPrompt()` function.

### System Prompt Addition

Append the following block after the comments section and before the closing instructions:

```
Important rules:
- NEVER fabricate, guess, or invent information you don't have. If you don't know something, say so clearly.
- You can ONLY see the post content and comments provided above. You cannot access URLs, GitHub repositories, external websites, or any resources outside this conversation.
- If the user asks you to visit a link, review a repo, or look something up, tell them: "I can only work with the post and comments shown here — I'm not able to browse the web or visit links. Web research is a feature we're working on for the future."
- When discussing tools, libraries, or technical claims made in the post or comments, base your analysis ONLY on what's stated in the text. Do not add technical details you're not certain about.
- If you're unsure about a technical detail, say "Based on what's described in the post..." or "I'd need to verify this, but..." rather than stating it as fact.
```

### Rationale

The current system prompt says "Help the user understand the discussion" but doesn't set any boundaries. This leads to:
- Fabricated technical analysis of tools the AI hasn't seen
- Fake code examples from repos the AI hasn't read
- Confident-sounding but potentially wrong technical claims

LLMs default to being helpful, which often means making up plausible-sounding answers. The guardrails must be explicit.

### Web Research Disclosure

The prompt instructs the AI to tell users: "Web research is a feature we're working on for the future." This sets expectations and signals the platform is evolving.

When web search is eventually added (via tool calling), the anti-hallucination prompt should be updated to allow the AI to search, and the disclosure message removed.

---

## Improvement 2: Tone Calibration

### Problem

The default system prompt produces generic, helpful responses:
- Overly formal language
- "Flowery" AI-style writing ("Great question!", "Absolutely!")
- Too long and detailed
- Corporate/marketing tone when asked to draft replies

The observed user spent most of her 44 messages fighting the default tone.

### Solution

Update the base system prompt closing instructions to produce more natural, Reddit-appropriate responses by default.

### File to Modify

`webapp/app/api/chat/route.ts` — the `buildSystemPrompt()` function.

### Current Closing Instructions

```
Help the user understand the discussion, identify key points, and draft thoughtful responses. When asked to draft a reply, write it in a natural Reddit comment style — conversational, helpful, and relevant to the discussion.
```

### Updated Closing Instructions

```
Help the user understand the discussion and draft responses.

When drafting a reply for the user to post:
- Write like a real person on Reddit — casual, concise, and genuine
- Match the tone of the subreddit (technical subreddits expect technical credibility, not marketing speak)
- Keep it short unless the user asks for detail
- No flowery language, no filler phrases, no "Great question!" openers
- No emoji unless the subreddit culture uses them
- If the user has a profile configured, write in their voice as described
```

### Complete Updated System Prompt

After applying improvements 1 and 2, the full system prompt in `buildSystemPrompt()` becomes:

```
You are an AI assistant helping a user engage with a Reddit post. You have full context of the post and its comments.

Post: {title}
Subreddit: r/{subreddit}
Author: u/{author}
Body: {body}

Comments:
{formatted comments with author, score, and nesting}

{user profile section — see Improvement 3, omitted if no profile configured}

Important rules:
- NEVER fabricate, guess, or invent information you don't have. If you don't know something, say so clearly.
- You can ONLY see the post content and comments provided above. You cannot access URLs, GitHub repositories, external websites, or any resources outside this conversation.
- If the user asks you to visit a link, review a repo, or look something up, tell them: "I can only work with the post and comments shown here — I'm not able to browse the web or visit links. Web research is a feature we're working on for the future."
- When discussing tools, libraries, or technical claims made in the post or comments, base your analysis ONLY on what's stated in the text. Do not add technical details you're not certain about.
- If you're unsure about a technical detail, say "Based on what's described in the post..." or "I'd need to verify this, but..." rather than stating it as fact.

Help the user understand the discussion and draft responses.

When drafting a reply for the user to post:
- Write like a real person on Reddit — casual, concise, and genuine
- Match the tone of the subreddit (technical subreddits expect technical credibility, not marketing speak)
- Keep it short unless the user asks for detail
- No flowery language, no filler phrases, no "Great question!" openers
- No emoji unless the subreddit culture uses them
- If the user has a profile configured, write in their voice as described
```

---

## Improvement 3: User Profile / Context

### Problem

The AI doesn't know who the user is or what they're trying to accomplish. Every conversation starts from zero context. Users have to re-explain their role, company, and communication style in every chat.

### Solution

Add profile fields to the user's account. These are injected into the AI system prompt for every conversation, giving the AI persistent context about the user's identity and preferences.

### Database Changes

New columns on the `users` table in `webapp/drizzle/schema.ts`:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| profile_role | varchar(255) | nullable | User's job role (e.g., "Developer Advocate") |
| profile_company | varchar(255) | nullable | Company or project name (e.g., "YugabyteDB") |
| profile_goal | text | nullable | What they use the platform for |
| profile_tone | varchar(20) | nullable | Tone preference enum value |
| profile_context | text | nullable | Freeform additional instructions for the AI |

Migration: `npm run db:generate` then `npm run db:migrate`.

Update `specs/database-schema.md` to include these columns in the `users` table.

### Tone Options

The `profile_tone` field accepts one of these values:

| Value | Label | Description |
|-------|-------|-------------|
| `casual` | Casual | Relaxed, conversational, like chatting with a colleague |
| `professional` | Professional | Polished but not stiff, appropriate for business contexts |
| `technical` | Technical | Dense, precise, assumes reader has domain expertise |
| `friendly` | Friendly | Warm and approachable, uses inclusive language |

Stored as a varchar, validated in the server action. `null` means no preference (AI uses its default tone calibration from Improvement 2).

### Server Actions

New file: `webapp/app/actions/profile.ts`

Following the pattern in `webapp/app/actions/api-keys.ts`:

```
"use server"

getProfile() → {
  role: string | null;
  company: string | null;
  goal: string | null;
  tone: string | null;
  context: string | null;
}

updateProfile(data: {
  role?: string;
  company?: string;
  goal?: string;
  tone?: string;
  context?: string;
}) → { success: boolean; error?: string }
```

Both use `getCurrentUserId()` from `./users` for authentication.

Validation in `updateProfile`:
- `role`: max 255 chars, trim whitespace
- `company`: max 255 chars, trim whitespace
- `goal`: max 1000 chars, trim whitespace
- `tone`: must be one of `casual`, `professional`, `technical`, `friendly`, or `null`/empty string to clear
- `context`: max 2000 chars, trim whitespace

### React Query Hooks

Add to `webapp/lib/hooks/index.ts`:

```
import { getProfile, updateProfile } from "@/app/actions/profile";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
```

### Settings Page

New settings tab: **AI Profile**

#### Navigation

Add to `webapp/app/settings/layout.tsx` `settingsNavItems` array:

```
{
  href: "/settings/ai-profile",
  label: "AI Profile",
  icon: BrainCircuit,  // from lucide-react
  description: "Help the AI write in your voice",
}
```

Position it after "API Keys" and before "Subreddits" in the nav order.

#### Page

New file: `webapp/app/settings/ai-profile/page.tsx`

"use client" component. Layout: single Card with form fields, matching the style of the existing account settings page.

| Field | Component | Notes |
|-------|-----------|-------|
| Role | Input (text) | placeholder: "e.g., Developer Advocate, Community Manager" |
| Company/Project | Input (text) | placeholder: "e.g., YugabyteDB, My Open Source Project" |
| Goal | Textarea | placeholder: "e.g., Engage with community discussions about our database product", max 1000 chars |
| Tone | Select dropdown | Options: (none selected), Casual, Professional, Technical, Friendly |
| Additional context | Textarea | placeholder: "Any other instructions for the AI, e.g., 'Keep responses under 3 sentences' or 'Always mention we support pgvector'", max 2000 chars |

- "Save" button at the bottom, disabled while saving
- Toast on success: "AI profile updated"
- Toast on error: show error message with `variant: "destructive"`
- All fields are optional — show helper text above the form: "These fields help the AI write in your voice. All fields are optional."
- Load existing profile data on mount via `useProfile()` hook
- Pre-fill fields with existing values

### System Prompt Integration

Modify `buildSystemPrompt()` in `webapp/app/api/chat/route.ts`:

1. Change function signature to accept an optional profile parameter:

```typescript
function buildSystemPrompt(
  post: { title: string; body: string | null; subreddit: string; author: string },
  postComments: Array<{ author: string; body: string; score: number; parentRedditId: string | null }>,
  profile?: {
    profileRole: string | null;
    profileCompany: string | null;
    profileGoal: string | null;
    profileTone: string | null;
    profileContext: string | null;
  }
): string
```

2. When any profile fields are non-null, build and insert a section between the comments and the rules block:

```
About the user:
- Role: Developer Advocate at YugabyteDB
- Goal: Engage with community discussions about our database product
- Preferred tone: Casual
- Additional notes: Keep responses under 3 sentences. Always mention we support pgvector.

When drafting replies, write in the user's voice as described above. The user will post these as themselves on Reddit, so they must sound natural and genuine.
```

Only include lines where the corresponding field is non-null. If `profileCompany` is set, combine with role as "Role: {role} at {company}". If no profile fields are set at all, omit the entire section.

3. In the POST handler, add a query to load the user's profile alongside existing data loading:

```typescript
const userProfile = await db.query.users.findFirst({
  where: eq(users.id, userId),
  columns: {
    profileRole: true,
    profileCompany: true,
    profileGoal: true,
    profileTone: true,
    profileContext: true,
  },
});
```

Pass `userProfile` to `buildSystemPrompt()`.

### Onboarding Wizard Integration

Add optional Step 3.5 to the welcome wizard (between API Keys and Tags).

#### New Step

- **Page**: `/settings/ai-profile?onboarding=3.5`
- **Overlay content**:
  - Heading: "Help the AI Write in Your Voice (Optional)"
  - Description: "Tell us about your role and how you like to communicate. The AI will use this to draft responses that sound like you, not like a chatbot."
- **Skippable**: Show both "Skip" and "Next" buttons
- **Progression**: Either button navigates to `/settings/tags?onboarding=4`

This changes the wizard from 4 steps to 5 steps.

#### Files to Modify

- `webapp/app/settings/ai-profile/page.tsx` — add `OnboardingOverlay` when `?onboarding=3.5` is present
- `webapp/app/settings/api-keys/page.tsx` — change Step 3 "Next" target from `?onboarding=4` to `?onboarding=3.5`
- All onboarding overlay instances: update progress indicator from "of 4" to "of 5"

Update `specs/welcome-wizard.md` to reflect the new step and updated step count.

---

## Improvement 4: Draft Reply Quick-Action Chips

### Problem

Users go through many refinement cycles when drafting replies: draft → too long → shorten → too formal → make casual → too salesy → remove marketing language. Each cycle requires typing a new prompt.

### Solution

Show pre-built quick-action buttons below AI draft replies. Clicking one sends that prompt automatically, saving the user from typing common refinement requests.

### Quick-Action Prompts

| Chip Label | Prompt Sent |
|------------|-------------|
| Shorter | "Make it shorter and more concise" |
| More casual | "Rewrite this in a more casual, conversational tone" |
| More technical | "Add more technical depth and specificity" |
| Less marketing | "Remove anything that sounds like marketing or sales copy" |

### File to Modify

`webapp/components/chat-panel.tsx`

### Draft Reply Detection

A message is considered a "draft reply" when:
- The user's most recent message (the one preceding this assistant response) contains any of these keywords (case-insensitive): `draft`, `reply`, `respond`, `response`, `write`, `comment`
- AND the assistant's response does not end with a question mark (indicating it's providing content, not asking for clarification)

This is intentionally simple. False positives just show extra buttons, which is harmless. False negatives just mean the user types their refinement manually, which is the current behavior.

### UI

For the **most recent** assistant message only (not older messages), if it's detected as a draft reply, render a row of small buttons below the message content, alongside the existing "Use as Response" button:

```
[Use as Response] [Shorter] [More casual] [More technical] [Less marketing]
```

Implementation details:
- Buttons use the existing `Button` component with `variant="ghost"` and `size="sm"`, same style as "Use as Response"
- Each button's `onClick` sets the input value to the chip's prompt text and calls the existing `handleSend` logic
- After clicking a chip, the chips disappear (because the message is no longer the most recent assistant message — a new user message was just sent, and eventually a new assistant message will become the latest)
- Chips only render when `!isLoading` (don't show while AI is streaming)

### State Management

No new state needed. The detection logic runs in the render:

```typescript
const isLatestAssistant = msg.id === messages.filter(m => m.role === "assistant").at(-1)?.id;
const precedingUserMsg = messages[messages.indexOf(msg) - 1];
const isDraftReply = isLatestAssistant
  && !isLoading
  && precedingUserMsg?.role === "user"
  && /\b(draft|reply|respond|response|write|comment)\b/i.test(precedingUserMsg.content)
  && !msg.content.trimEnd().endsWith("?");
```

### Quick-Action Chip Component

Define the chips as a constant array in the component file:

```typescript
const QUICK_ACTIONS = [
  { label: "Shorter", prompt: "Make it shorter and more concise" },
  { label: "More casual", prompt: "Rewrite this in a more casual, conversational tone" },
  { label: "More technical", prompt: "Add more technical depth and specificity" },
  { label: "Less marketing", prompt: "Remove anything that sounds like marketing or sales copy" },
];
```

Render them in the same `<div className="flex gap-1 mt-2">` container as the "Use as Response" button, using the same button styling.

---

## Specs to Update

When implementing these improvements, update the following existing specs:

- `specs/post-detail.md` — Update the System Prompt section to show the new full prompt (rules, tone instructions, profile section placeholder). Update the AI Chat API behavior steps to include loading user profile. Add note about quick-action chips on draft replies.
- `specs/database-schema.md` — Add the five new `profile_*` columns to the `users` table.
- `specs/welcome-wizard.md` — Add Step 3.5 (AI Profile), update step count from 4 to 5, update progression flow from Step 3 to Step 3.5 to Step 4.

---

## Acceptance Criteria

### Anti-Hallucination (Improvement 1)
1. **No fabrication** — When asked about a URL or external resource, the AI explicitly says it cannot access it
2. **Web research disclosure** — AI mentions web research is a feature coming in the future
3. **Hedged claims** — AI uses qualifying language ("Based on what's described in the post...") when discussing external tools or projects mentioned in the post

### Tone Calibration (Improvement 2)
4. **Concise by default** — Draft replies are short and to the point unless the user asks for more detail
5. **No flowery language** — No "Great question!", "Absolutely!", or similar AI-typical openers
6. **Reddit-appropriate** — Draft replies read like genuine Reddit comments, not corporate comms

### User Profile (Improvement 3)
7. **Profile saves** — User can save role, company, goal, tone, and context in settings
8. **Profile in prompt** — When profile fields are populated, they appear in the system prompt sent to the LLM
9. **Tone matches profile** — A user with "casual" tone preference gets casual drafts by default
10. **Profile optional** — AI works normally without a profile configured (no errors, no placeholder text in prompt)
11. **Settings nav** — "AI Profile" tab appears in settings sidebar between "API Keys" and "Subreddits"
12. **Onboarding step** — New optional onboarding step after API keys, skippable

### Quick-Action Chips (Improvement 4)
13. **Chips shown** — Draft reply messages show refinement buttons (Shorter, More casual, More technical, Less marketing)
14. **Chips functional** — Clicking a chip sends the corresponding prompt and triggers AI response
15. **Latest only** — Chips only appear on the most recent assistant message
16. **Draft detection** — Chips appear when the preceding user message contains draft/reply/response keywords
17. **No chips while loading** — Chips hidden during AI streaming
