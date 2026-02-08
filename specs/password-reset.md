# Password Reset

Allow users to reset their password via a tokenized email link.

## Overview

Users who forget their password can request a reset link sent to their email. The link contains a single-use token that allows them to set a new password. After a successful reset, existing sessions are invalidated by tracking when the password was last changed.

## Flow

1. User clicks "Forgot password?" on the login page
2. User enters their email on `/forgot-password`
3. Server generates a token, stores it in `verificationTokens`, and sends an email
4. User clicks the link in the email → `/reset-password?token={token}`
5. User enters and confirms a new password
6. Server verifies the token, updates the password, deletes the token, and sets `passwordChangedAt`
7. User is redirected to `/login?reset=true` with a success message

## Pages

### Forgot Password Page — `/forgot-password`

- Public route (no auth required)
- Simple form: email input + "Send Reset Link" button
- Link back to login page
- On submit: always show "If an account with that email exists, we've sent a reset link." (don't reveal whether the email exists)
- Excluded from proxy.ts auth

### Reset Password Page — `/reset-password?token={token}`

- Public route (no auth required)
- If no token in URL or token is invalid/expired: show error message with link to request a new one
- If token is valid: show form with new password + confirm password fields
- Same password requirements as signup (12+ chars, uppercase, lowercase, number, symbol)
- Real-time password validation with requirement checklist (same pattern as signup/account settings)
- On success: redirect to `/login?reset=true`
- Excluded from proxy.ts auth

### Login Page Update

- Add "Forgot password?" link below the login form, linking to `/forgot-password`
- If `?reset=true` query param is present, show success message: "Password reset successfully. Please log in with your new password."

## API

### Request Reset — `POST /api/auth/reset-password`

Public route (no auth required).

Request body:
```json
{
  "email": "user@example.com"
}
```

Behavior:
1. Validate email format
2. Look up user by email (case-insensitive, lowercased)
3. If user not found: return 200 OK (don't reveal email existence)
4. Rate limit: max 1 reset email per email address per 15 minutes (check `verificationTokens` for recent token with same identifier)
5. Delete any existing reset tokens for this email
6. Generate a cryptographically random token (`crypto.randomBytes(32).toString('hex')`)
7. Hash the token with SHA-256 before storing (store hash, send raw token in email)
8. Insert into `verificationTokens`: identifier = email, token = hashed token, expires = now + 1 hour
9. Send reset email (fire-and-forget, don't block response)
10. Return 200 OK

### Execute Reset — `POST /api/auth/execute-reset`

Public route (no auth required).

Request body:
```json
{
  "token": "raw-token-from-email",
  "password": "newPassword123!",
  "confirmPassword": "newPassword123!"
}
```

Behavior:
1. Validate password against `passwordSchema` and confirm passwords match
2. Hash the provided token with SHA-256
3. Look up the hashed token in `verificationTokens`
4. If not found or expired: return 400 with "Invalid or expired reset link"
5. Look up user by the token's identifier (email)
6. Hash new password with bcrypt (cost factor 12)
7. Update user: set `passwordHash`, set `passwordChangedAt` to now
8. Delete the used token from `verificationTokens`
9. Return 200 OK

## Session Invalidation

### Database Change

Add `passwordChangedAt` timestamp column to the `users` table (nullable, default null).

### JWT Callback Check

In the Auth.js JWT callback, after the token is created, check `passwordChangedAt` on the user:
- When the JWT is refreshed (not initial sign-in), compare `passwordChangedAt` with the token's `iat` (issued-at)
- If `passwordChangedAt` is set and is after `iat`, return `null` to invalidate the session
- This forces the user to re-authenticate after a password change

### Change Password Action Update

The existing `changePassword` server action should also set `passwordChangedAt` to now, so that changing your password while logged in also invalidates other sessions.

## Reset Email

### Subject

`Social Tracker — Reset Your Password`

### Body (HTML)

- Greeting: "Hi,"
- Message: "We received a request to reset your password for Social Tracker."
- CTA button: "Reset Password" linking to `/reset-password?token={raw-token}`
- Expiry note: "This link expires in 1 hour."
- Security note: "If you didn't request this, you can safely ignore this email. Your password will not be changed."
- Footer: same style as other emails

### Plain Text Fallback

Same content without HTML formatting, link as full URL.

## Token Security

- **Hashed storage**: Raw token is sent in the email; SHA-256 hash is stored in the database. A database breach doesn't expose usable tokens.
- **Single use**: Token is deleted after successful password reset.
- **Short-lived**: 1-hour expiry.
- **Rate limited**: One reset email per email address per 15 minutes.
- **No email enumeration**: Same response whether the email exists or not.

## Route Protection

Add to proxy.ts public routes:
- `/forgot-password`
- `/reset-password`
- `/api/auth/reset-password` (already covered by `/api/auth/*` exclusion)
- `/api/auth/execute-reset` (already covered by `/api/auth/*` exclusion)

## Infrastructure

Uses the same nodemailer/SMTP setup from `specs/email-notifications.md`.

## Acceptance Criteria

1. **Forgot password page** — `/forgot-password` renders with email input
2. **No email enumeration** — Response is identical whether email exists or not
3. **Token emailed** — Reset email sent with valid tokenized link
4. **Token hashed** — Only SHA-256 hash stored in database, raw token in email
5. **Token single-use** — Token is deleted after successful reset
6. **Token expires** — Reset link expires after 1 hour
7. **Rate limited** — Max 1 reset email per email per 15 minutes
8. **Password validation** — Same requirements as signup (12+ chars, upper, lower, number, symbol)
9. **Session invalidation** — Existing sessions are invalidated after password reset via `passwordChangedAt`
10. **Change password also invalidates** — Existing `changePassword` action sets `passwordChangedAt`
11. **Login page updated** — "Forgot password?" link and success message after reset
12. **Public routes** — Forgot/reset pages excluded from proxy.ts auth
13. **Plain text fallback** — Email includes both HTML and plain text parts
