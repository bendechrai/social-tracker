# Arcjet Security

Application-wide security using Arcjet for rate limiting, bot detection, email validation, and attack protection.

## Overview

Arcjet provides a layered security SDK that runs per-request. It replaces hand-rolled in-memory rate limiters with a centralized, persistent solution and adds bot detection, email validation, and general attack shielding.

## Package

`@arcjet/next` — the official Next.js SDK.

Environment variable: `ARCJET_KEY` — site key from app.arcjet.com.

## Rules by Route

### Signup — `POST /api/auth/signup` (or server action)

Use `protectSignup` for a combined rule:

| Rule | Config |
|------|--------|
| Email validation | Block `DISPOSABLE`, `INVALID`, `NO_MX_RECORDS` |
| Bot detection | Block all bots |
| Rate limit | 5 requests per 10 minutes per IP |

### Login — Credentials authorize

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Bot detection | Block all bots |
| Rate limit | 10 requests per 5 minutes per IP |

### Password Reset — `POST /api/auth/reset-password`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Bot detection | Block all bots |
| Email validation | Block `DISPOSABLE`, `INVALID`, `NO_MX_RECORDS` |
| Rate limit | 3 requests per 15 minutes per IP |

Note: This supplements the per-email rate limit in the password reset spec (token-based). Arcjet adds per-IP protection on top.

### Suggest Terms — `POST /api/suggest-terms`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Rate limit | 10 requests per minute per user ID |

Replaces the current in-memory `rateLimitMap` in `suggest-terms/route.ts`.

### AI Chat — `POST /api/chat`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Rate limit | 20 requests per minute per user ID |

### Cron Fetch — `GET /api/cron/fetch-posts`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Rate limit | 2 requests per minute per IP |

Prevents external abuse of the cron endpoint.

### Unsubscribe — `POST /api/unsubscribe`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Rate limit | 5 requests per minute per IP |

### Verify Email — `GET /api/verify-email`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Rate limit | 5 requests per minute per IP |

### Resend Verification — `POST /api/resend-verification`

| Rule | Config |
|------|--------|
| Shield | LIVE |
| Rate limit | 1 request per 5 minutes per user ID |

Replaces the in-memory rate limit specified in the welcome email spec.

### Global Fallback — All Other Routes

| Rule | Config |
|------|--------|
| Shield | LIVE |

Shield runs on every request to block common attack patterns (SQL injection, XSS, etc.) with no rate limit overhead on general page loads.

## Implementation

### Shared Client

Create `lib/arcjet.ts` with the base Arcjet client. Export `ajMode` which is `DRY_RUN` in development/test and `LIVE` in production:

```typescript
import arcjet, { shield } from "@arcjet/next";

export const ajMode = process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN" as const;

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [shield({ mode: ajMode })],
});

export default aj;
```

### Per-Route Rules

Each route imports the base client and `ajMode`, adding route-specific rules using `withRule()`:

```typescript
import aj, { ajMode } from "@/lib/arcjet";
import { slidingWindow, detectBot } from "@arcjet/next";

const protectedAj = aj.withRule(
  slidingWindow({ mode: ajMode, interval: "5m", max: 10 })
).withRule(
  detectBot({ mode: ajMode, allow: [] })
);
```

### Decision Handling

```typescript
const decision = await protectedAj.protect(request);

if (decision.isDenied()) {
  if (decision.reason.isRateLimit()) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (decision.reason.isBot()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Characteristics

- Public routes (login, signup, password reset): rate limit by IP (default)
- Authenticated routes (suggest-terms, chat): rate limit by user ID via `characteristics: ["userId"]` and passing `userId` to `protect()`

## Cleanup

After Arcjet is implemented, remove:
- In-memory `rateLimitMap` and `checkRateLimit` from `suggest-terms/route.ts`
- Any other hand-rolled rate limiters added before Arcjet

## Dry Run Mode

All rules use `ajMode` from the shared client, which is automatically `DRY_RUN` when `NODE_ENV` is not `production`. In production, all rules are `LIVE`. No manual switching needed.

## Acceptance Criteria

1. **Arcjet client configured** — Base client in `lib/arcjet.ts` with Shield enabled globally
2. **Signup protected** — `protectSignup` with email validation, bot detection, and rate limiting
3. **Login protected** — Bot detection and rate limiting on credentials auth
4. **Password reset protected** — Bot detection, email validation, and rate limiting
5. **API routes rate limited** — suggest-terms, chat, cron, unsubscribe, verify-email, resend-verification
6. **In-memory rate limiters removed** — Hand-rolled limiters replaced by Arcjet
7. **Authenticated routes use user ID** — Rate limiting by user ID, not just IP
8. **Decisions handled** — Appropriate HTTP status codes returned (429, 403)
9. **Automatic dry run** — DRY_RUN in development/test, LIVE in production via `ajMode`
10. **ARCJET_KEY configured** — Environment variable documented and required
