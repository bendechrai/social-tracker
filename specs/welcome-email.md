# Welcome Email & Email Verification

Send a welcome email with quick-start tips and a verification link immediately after signup.

## Overview

When a user signs up, they receive a welcome email containing getting-started tips and an email verification link. The app works without verification, but a banner reminds unverified users to verify. Notification emails (see `specs/email-notifications.md`) are only sent to verified users.

## Trigger

Sent immediately after a successful signup (user record created). Called from the signup server action, fire-and-forget (do not block the signup response).

## Email Content

### Subject

`Welcome to Social Tracker`

### Body (HTML)

- Greeting: "Welcome to Social Tracker!"
- Brief intro: "You're all set to start tracking Reddit posts across subreddits and organizing them with tags."
- Quick-start tips (numbered list):
  1. **Add a subreddit** — "Head to Settings > Subreddits and add your first subreddit to monitor. Posts from the last 7 days will be fetched automatically."
  2. **Create tags** — "Tags help you organize posts. Each tag has search terms — posts matching those terms are auto-tagged. Go to Settings > Tags to create your first tag."
  3. **Add a Groq API key** (optional) — "Enable AI-powered features like response drafting and search term suggestions. Get a free key at console.groq.com and add it in Settings > API Keys."
- CTA button: "Get Started" linking to `/dashboard`
- Verification section: "Please verify your email address to enable notification emails:" with a "Verify Email" button linking to `/api/verify-email?token={signed-token}`
- Footer: same style as notification emails

### Plain Text Fallback

Same content without HTML formatting, links as full URLs.

## Email Verification

### How It Works

1. On signup, the welcome email includes a signed verification link
2. User clicks the link → `GET /api/verify-email?token={signed-token}`
3. Server verifies the token, sets `email_verified` to now on the `users` table
4. Redirects to `/dashboard` with a success toast/query param

### Verification Token

Same signed token approach as the unsubscribe token (HMAC with user ID + expiry). Token expires after 7 days.

### Verification Endpoint

`GET /api/verify-email?token={signed-token}`

- No authentication required (the signed token is the credential)
- Excluded from proxy.ts auth (add `/api/verify-email` to public routes)
- Verifies token signature and expiry
- Sets `users.email_verified` to `new Date()` (Auth.js column, already exists in schema)
- Redirects to `/dashboard?verified=true`
- If token is expired or invalid, redirects to `/dashboard?verify_error=true`

### Resend Verification

On the account settings page, if the user is not verified, show:
- A "Resend verification email" button
- Rate limited: one resend per 5 minutes (enforced by Arcjet — see `specs/arcjet-security.md`)
- Sends only the verification portion of the welcome email (not the full welcome content)

## App Behavior for Unverified Users

### Dashboard Banner

If `email_verified` is null, show a dismissible banner at the top of the dashboard:
- "Please verify your email to receive notifications. Check your inbox or [resend verification email]."
- Banner is dismissible for the session (client-side state), but reappears on next visit
- Banner does not appear once email is verified

### Notification Emails Gated

The email notification system (see `specs/email-notifications.md`) must check `email_verified` is not null before sending notification emails. Unverified users are skipped.

## Infrastructure

Uses the same nodemailer/SMTP setup from `specs/email-notifications.md`. Same `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` environment variables.

## Acceptance Criteria

1. **Welcome email sent on signup** — Email is sent immediately after user creation
2. **Non-blocking** — Signup completes even if email sending fails
3. **Quick-start tips included** — Email contains numbered getting-started steps
4. **Verification link included** — Email contains a verify button/link with signed token
5. **Verification works** — Clicking the link sets `email_verified` on the user
6. **Token expires** — Verification tokens expire after 7 days
7. **Resend available** — Unverified users can resend from account settings (rate limited)
8. **Dashboard banner** — Unverified users see a dismissible verification reminder
9. **Notifications gated** — Notification emails are only sent to verified users
10. **Plain text fallback** — Email includes both HTML and plain text parts
11. **Public route** — `/api/verify-email` is excluded from proxy.ts auth
