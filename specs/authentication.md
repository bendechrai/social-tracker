# Authentication

User authentication using Auth.js (NextAuth v5) with credentials-based login and future OAuth provider support.

## Overview

Users sign up and log in with email and password. Each user has their own isolated data (tags, subreddits, posts). Reddit OAuth connects their Reddit account for fetching posts. Groq API keys are user-provided (BYOK).

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
- `reddit_access_token` - text, encrypted, nullable
- `reddit_refresh_token` - text, encrypted, nullable  
- `reddit_token_expires_at` - timestamp, nullable
- `reddit_username` - varchar(100), nullable
- `groq_api_key` - text, encrypted, nullable

Add Auth.js required tables:
- `sessions` - id, sessionToken, userId, expires
- `accounts` - id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token (for future OAuth)
- `verification_tokens` - identifier, token, expires (for future email verification)

## Encryption

Sensitive fields encrypted at rest using AES-256-GCM:
- `reddit_access_token`
- `reddit_refresh_token`
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

## Reddit OAuth Integration

Users connect their Reddit account to enable post fetching.

### Setup

1. Create Reddit OAuth app at reddit.com/prefs/apps
2. Type: "web app" (not "script")
3. Redirect URI: `https://socialtracker.com/api/auth/reddit/callback`
4. For local dev: `http://localhost:3000/api/auth/reddit/callback`

### OAuth Flow

1. User clicks "Connect Reddit" in settings
2. Redirect to Reddit authorization URL:
   ```
   https://www.reddit.com/api/v1/authorize?
     client_id={REDDIT_CLIENT_ID}&
     response_type=code&
     state={csrf_token}&
     redirect_uri={callback_url}&
     duration=permanent&
     scope=read,identity
   ```
3. User authorizes on Reddit
4. Reddit redirects to callback with code
5. Exchange code for tokens:
   ```
   POST https://www.reddit.com/api/v1/access_token
   grant_type=authorization_code&
   code={code}&
   redirect_uri={callback_url}
   ```
6. Store encrypted tokens in user record
7. Fetch Reddit username via `/api/v1/me`, store in user record

### Token Refresh

Reddit tokens expire after 1 hour. Before fetching posts:
1. Check if `reddit_token_expires_at` is in the past
2. If expired, refresh using `reddit_refresh_token`
3. Update stored tokens and expiry

### Disconnect

User can disconnect Reddit in settings:
1. Clear `reddit_access_token`, `reddit_refresh_token`, `reddit_token_expires_at`, `reddit_username`
2. Posts fetched previously remain in database

## BYOK - Groq API Key

Users provide their own Groq API key for LLM tag suggestions.

1. User enters key in Settings > API Keys
2. Key encrypted and stored in `groq_api_key` column
3. When suggesting terms, use user's key (decrypt on use)
4. If no key set, "Suggest Terms" button disabled with tooltip

## Routes

### Public (no auth required)
- `/login` - Login page
- `/signup` - Registration page
- `/api/auth/*` - Auth.js API routes

### Protected (auth required)
- `/` - Dashboard (main app)
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
  - Reddit: "Connect" button or "Connected as u/username" with "Disconnect" button
  
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

# Reddit OAuth (app-level, for OAuth flow)
REDDIT_CLIENT_ID=      # From reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=  # From reddit.com/prefs/apps

# Note: REDDIT_USERNAME and REDDIT_PASSWORD no longer needed
# Each user connects their own Reddit account via OAuth
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
9. **Reddit OAuth connects** - User can authorize Reddit account
10. **Reddit tokens stored encrypted** - Tokens not visible in plain text in DB
11. **Reddit token refresh works** - Expired tokens automatically refreshed
12. **Reddit disconnect works** - User can remove Reddit connection
13. **BYOK Groq works** - User can add/update their Groq API key
14. **Groq key encrypted** - Key not visible in plain text in DB
15. **Missing Groq key handled** - Suggest Terms disabled without key
16. **Change password works** - User can update password with valid current password
