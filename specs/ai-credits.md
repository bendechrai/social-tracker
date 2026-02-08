# AI Credits System

Purchasable token credit packs that give users access to premium AI models via OpenRouter, replacing the donation-based pricing model.

## Overview

Users can access AI chat in two ways:

1. **BYOK (Bring Your Own Key)** — user provides their own Groq API key, free and unlimited. This is the existing behavior, unchanged.
2. **Credits** — user purchases credit packs via Stripe Checkout. Credits are denominated in cents (1 credit = 1 cent USD). When using credits, the user selects from a curated list of AI models (GPT-4o, Claude, Gemini, Llama, etc.) served via OpenRouter. Token usage is tracked and deducted from their balance after each request.

Users with neither a Groq key nor credits see a message prompting them to configure one or the other.

## Credit Denomination

Credits are stored as **integer cents** (e.g., 500 = $5.00). This aligns with Stripe's cent-based amounts and avoids floating-point issues. Different models have different per-token costs — the actual cost of each request is determined after streaming completes, using OpenRouter's reported cost.

## Credit Packs

One-time purchases via Stripe Checkout. No subscriptions.

| Pack | Price | Credits |
|------|-------|---------|
| Small | $5 | 500 credits |
| Medium | $10 | 1,000 credits |
| Large | $20 | 2,000 credits |

Credits are 1:1 with cents — a $5 pack gives 500 credits worth $5.00 of AI usage. The app owner's margin comes from any markup over OpenRouter's costs (currently 1:1, but can be adjusted later by changing the pack definitions).

## Database Tables

### `credit_balances`

Per-user credit balance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | uuid | PK, FK → users, cascade delete | User |
| balance_cents | integer | not null, default 0 | Current balance in cents |
| updated_at | timestamp | not null, default now | Last update time |

### `credit_purchases`

Records of Stripe Checkout purchases. The `stripe_session_id` unique constraint provides webhook idempotency.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK → users, not null, cascade delete | Buyer |
| stripe_session_id | varchar(255) | unique, not null | Stripe Checkout session ID |
| amount_cents | integer | not null | Amount paid in cents |
| credits_cents | integer | not null | Credits added in cents |
| status | varchar(20) | not null, default 'pending' | pending, completed, failed |
| created_at | timestamp | not null, default now | Purchase time |

Index: `(user_id)` for listing purchases.

### `ai_usage_log`

Per-request AI usage tracking for billing and analytics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK → users, not null, cascade delete | User |
| post_id | uuid | nullable | Associated post |
| model_id | varchar(100) | not null | OpenRouter model ID (e.g., "openai/gpt-4o") |
| provider | varchar(20) | not null | "openrouter" or "groq" |
| prompt_tokens | integer | not null | Input tokens |
| completion_tokens | integer | not null | Output tokens |
| cost_cents | integer | not null | Cost in cents deducted from balance |
| created_at | timestamp | not null, default now | Request time |

Index: `(user_id, created_at)` for usage dashboard queries.

## Stripe Integration

### Environment Variables

- `STRIPE_SECRET_KEY` — Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` — Webhook endpoint signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Client-side publishable key (for future use if needed)

### Checkout Flow

1. User clicks "Buy" on a credit pack in Settings
2. Server action creates a Stripe Checkout Session in `payment` mode
3. Session metadata includes `userId` and `credits_cents`
4. User is redirected to Stripe's hosted checkout page
5. On completion, Stripe redirects to `/settings/credits?result=success`
6. Separately, Stripe sends a webhook event

### Webhook

**Route:** `POST /api/webhooks/stripe`

- Must be public (excluded from auth proxy, signature-verified instead)
- Verifies webhook signature using `stripe.webhooks.constructEvent()`
- Handles `checkout.session.completed` event
- In a database transaction:
  1. Insert into `credit_purchases` (unique on `stripe_session_id` for idempotency — use `ON CONFLICT DO NOTHING`)
  2. Upsert `credit_balances` (increment `balance_cents`)
- Returns 200 OK to Stripe

### Proxy Changes

Add `/api/webhooks` to the public route exclusions in `proxy.ts` (both the `isApiRoute` check and the matcher regex).

## OpenRouter Integration

### Environment Variables

- `OPENROUTER_API_KEY` — App owner's OpenRouter API key

### Curated Model List

A static allowlist of ~10 models. Only models in this list can be used with credits. This controls costs and quality.

```
openai/gpt-4o-mini        — GPT-4o Mini (OpenAI)
openai/gpt-4o             — GPT-4o (OpenAI)
anthropic/claude-3.5-sonnet — Claude 3.5 Sonnet (Anthropic)
anthropic/claude-3-haiku   — Claude 3 Haiku (Anthropic)
google/gemini-2.0-flash-001 — Gemini 2.0 Flash (Google)
meta-llama/llama-3.3-70b-instruct — Llama 3.3 70B (Meta)
meta-llama/llama-3.1-8b-instruct — Llama 3.1 8B (Meta)
deepseek/deepseek-chat     — DeepSeek V3 (DeepSeek)
mistralai/mistral-large    — Mistral Large (Mistral)
```

### Model Pricing Endpoint

`GET /api/models`

- Fetches model list from OpenRouter's `GET /api/v1/models` endpoint
- Filters to the curated allowlist
- Returns models with per-1M-token pricing for prompt and completion
- Cached in-memory for 1 hour

### Usage Accounting

When using credits, the OpenRouter provider is called with `usage: { include: true }`. After streaming completes:

1. Read cost from `result.providerMetadata.openrouter.usage.cost` (USD)
2. Convert to cents: `Math.max(1, Math.ceil(costUsd * 100))` — minimum 1 cent per request
3. Read token counts from provider metadata
4. Deduct from `credit_balances` atomically: `SET balance_cents = GREATEST(0, balance_cents - cost)`
5. Insert row into `ai_usage_log`

## Chat Route Changes

`POST /api/chat` request body gains an optional `modelId` field:

```json
{
  "postId": "uuid",
  "message": "user's message",
  "modelId": "openai/gpt-4o-mini"  // optional
}
```

Provider resolution logic:

1. If `modelId` is provided and valid, and user has credits (balance > 0) → use OpenRouter with that model
2. If no `modelId`, try BYOK Groq key (user's stored key, then env fallback) → use Groq
3. If neither → return error with code `NO_AI_ACCESS`

The error code changes from `MISSING_API_KEY` to `NO_AI_ACCESS` when neither option is available.

## Server Actions

New file: `webapp/app/actions/credits.ts`

- `getCreditBalance()` → number (cents)
- `createCheckoutSession(packCents)` → { url } or { error }
- `getUsageHistory(page, limit)` → paginated usage log entries
- `getUsageSummary()` → daily aggregates for last 30 days
- `getPurchaseHistory()` → list of purchases
- `getAiAccessInfo()` → { hasGroqKey, creditBalanceCents, mode: "byok" | "credits" | "none" }

## UI — Settings: Credits & Usage Page

New settings tab at `/settings/credits`.

### Navigation

Add to settings sidebar: "Credits & Usage" with CreditCard icon.

### Balance Card

- Shows current balance formatted as dollars (e.g., "$4.23 remaining")
- Prominent "Buy Credits" CTA button

### Buy Credits Section

Three cards showing each credit pack:
- Pack name and price
- "Buy" button → calls `createCheckoutSession()` → redirects to Stripe
- On return from Stripe with `?result=success`, show success toast and refetch balance

### Usage Chart

Simple bar chart showing daily credit spend over the last 30 days. CSS-based bars (no charting library needed for v1).

### Usage History Table

Paginated table with columns: Date/time, Model, Tokens (prompt + completion), Cost. Uses existing Pagination component pattern.

### Purchase History

List of past credit purchases: Date, Amount, Status.

## UI — Chat Panel Changes

### Props

Replace `hasApiKey: boolean` with a richer prop:

```typescript
interface AiAccess {
  mode: "byok" | "credits" | "none";
  creditBalanceCents?: number;
}
```

### Mode: "byok"

Current behavior, unchanged. No model selector shown.

### Mode: "credits"

- Show model selector dropdown above the chat input
- Dropdown lists curated models with per-token pricing (fetched from `/api/models`)
- Show current balance in the chat header
- Selected `modelId` is sent with each POST to `/api/chat`

### Mode: "none"

Show a message with two options:
- "Add your Groq API key" → link to `/settings/api-keys`
- "Buy AI credits" → link to `/settings/credits`

### Post Detail Page

Update `webapp/app/dashboard/posts/[id]/page.tsx` to use `getAiAccessInfo()` instead of `hasGroqApiKey()` and pass the richer `aiAccess` prop to ChatPanel.

## Landing Page Changes

Replace the donation-based pricing section with:

- **Free (BYOK)** card — "Bring your own Groq API key. Unlimited usage, no credit card needed."
- **AI Credits** card — "Choose from premium models. Buy credit packs: $5 / $10 / $20"
- **Teams & Enterprise** card — "Coming soon" (unchanged)

Update tagline from "Use it for free. Support it if you find it valuable." to something like "Free to use with your own API key, or buy credits for premium AI models."

## Specs to Update

- `specs/database-schema.md` — add three new tables
- `specs/landing-page.md` — update pricing section
- `specs/post-detail.md` — document BYOK vs credits AI modes, model selector
- `specs/user-api-keys.md` — add context that credits are an alternative to BYOK

## New Dependencies

- `stripe` — Stripe Node.js SDK
- `@openrouter/ai-sdk-provider` — Vercel AI SDK provider for OpenRouter

## Docker / Environment

Add to `docker-compose.yml` webapp service environment:

```yaml
- STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
- STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
- OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
```

## Acceptance Criteria

1. **BYOK unchanged** — Users with Groq API keys continue to use AI chat exactly as before
2. **Credit purchase works** — User can buy a credit pack via Stripe Checkout and see balance increase
3. **Webhook is idempotent** — Processing the same checkout event twice does not double-credit the user
4. **Model selector shown** — Users with credits see a model dropdown in the chat panel
5. **Credits deducted** — After each AI request, the correct cost is deducted from the user's balance
6. **Usage logged** — Each AI request creates an entry in `ai_usage_log`
7. **Balance check** — Users with 0 credits cannot use the credits path
8. **Usage dashboard** — Settings page shows balance, usage chart, and history
9. **Purchase history** — Settings page shows past credit purchases
10. **Landing page updated** — Pricing section shows BYOK and credit pack options
11. **No AI access message** — Users without a key or credits see a helpful prompt with links to both options
12. **Webhook secured** — Stripe webhook verifies signature and is excluded from auth proxy
13. **Minimum cost** — Each credit-based request costs at least 1 cent (prevents free usage on very cheap models)
