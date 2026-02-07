# Authentication

User authentication using Auth.js (NextAuth v5) with credentials-based login and future OAuth provider support.

## Overview

Users sign up and log in with email and password. Each user has their own isolated data (tags, subreddits, posts). Reddit data is fetched via the Arctic Shift API (no per-user Reddit credentials needed). Groq API keys are user-provided (BYOK).

## Technology

- Auth.js v5 (NextAuth) with Credentials provider
- bcrypt for password hashing
- Drizzle adapter for session storage
- Future: Google and GitHub OAuth providers

## Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one symbol (!@#$%^&*etc)

Validation regex: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/`

## User Registration

Open signup - anyone can create an account.

1. User submits email + password
2. Validate email format and uniqueness
3. Validate password meets requirements
4. Hash password with bcrypt (cost factor 12)
5. Create user record
6. Create session, redirect to dashboard

No email verification required for v1.

## User Login

1. User submits email + password
2. Look up user by email
3. Verify password with bcrypt
4. Create session (7 day expiry)
5. Redirect to dashboard

## Session Management

- Sessions stored in database (via Drizzle adapter)
- 7 day duration
- Refresh on activity (sliding window)
- Secure, httpOnly cookies

## Database Schema Updates

Add to `users` table:
- `password_hash` - varchar(255), not null for credentials users
- `groq_api_key` - text, encrypted, nullable

Add Auth.js required tables:
- `sessions` - id, sessionToken, userId, expires
- `accounts` - id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token (for future OAuth)
- `verification_tokens` - identifier, token, expires (for future email verification)

## Encryption

Sensitive fields encrypted at rest using AES-256-GCM:
- `groq_api_key`

Encryption key from environment variable: `ENCRYPTION_KEY` (32-byte hex string)

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(data: string): string {
  const buf = Buffer.from(data, 'base64');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const encrypted = buf.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

Generate encryption key: `openssl rand -hex 32`

## BYOK - Groq API Key

Users provide their own Groq API key for LLM tag suggestions.

1. User enters key in Settings > API Keys
2. Key encrypted and stored in `groq_api_key` column
3. When suggesting terms, use user's key (decrypt on use)
4. If no key set, "Suggest Terms" button disabled with tooltip

## Routes

### Public (no auth required)
- `/` - Marketing landing page (redirects to `/dashboard` if authenticated)
- `/login` - Login page
- `/signup` - Registration page
- `/api/auth/*` - Auth.js API routes

### Protected (auth required)
- `/dashboard` - Dashboard (main app)
- `/settings` - User settings
- `/api/*` - All other API routes

## UI Components

### Login Page (`/login`)
- Email input
- Password input
- "Sign in" button
- Link to signup: "Don't have an account? Sign up"
- Error messages for invalid credentials

### Signup Page (`/signup`)
- Email input
- Password input
- Password confirmation input
- Password requirements hint text
- "Create account" button
- Link to login: "Already have an account? Sign in"
- Validation errors inline

### Settings Additions
- **Account section**
  - Email (display only for now)
  - Change password (current password, new password, confirm)
  
- **Connected Accounts section**
  - Removed — Reddit data is fetched via Arctic Shift (no account connection needed)
  
- **API Keys section**
  - Groq API Key: masked input showing last 4 chars, "Update" button
  - Help text with link to Groq console

## Environment Variables

```bash
# Auth.js
AUTH_SECRET=           # Generate with: openssl rand -base64 32
AUTH_URL=https://socialtracker.com  # Or http://localhost:3000 for dev

# Encryption
ENCRYPTION_KEY=        # Generate with: openssl rand -hex 32

# Note: No Reddit credentials needed — data fetched via Arctic Shift API (public, no auth)
```

## Acceptance Criteria

1. **Signup works** - New user can register with valid email/password
2. **Password validation** - Weak passwords rejected with specific error messages
3. **Login works** - Existing user can log in with correct credentials
4. **Invalid login rejected** - Wrong password or unknown email shows error
5. **Sessions persist** - User stays logged in for 7 days
6. **Logout works** - User can log out, session destroyed
7. **Routes protected** - Unauthenticated access to protected routes redirects to login
8. **Data isolated** - Users only see their own tags, subreddits, posts
9. **BYOK Groq works** - User can add/update their Groq API key
10. **Groq key encrypted** - Key not visible in plain text in DB
11. **Missing Groq key handled** - Suggest Terms disabled without key
12. **Change password works** - User can update password with valid current password
