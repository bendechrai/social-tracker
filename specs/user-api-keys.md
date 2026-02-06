# User API Keys

Per-user API key storage with encryption for external service credentials.

## Overview

Users bring their own API keys for external services (Groq for LLM tag suggestions). Keys are encrypted at rest in the database. Each user's keys are isolated and only accessible to them.

Note: Reddit data is fetched via the Arctic Shift API, which requires no authentication or API keys.

## Encryption

- Algorithm: AES-256-GCM
- Key derivation: Encryption key from `ENCRYPTION_KEY` environment variable
- Each value encrypted with unique IV
- Stored format: `iv:authTag:ciphertext` (base64 encoded)

## Database

The Groq API key is stored encrypted in the `users.groq_api_key` column. See `database-schema.md` for full schema.

## Operations

### Save API Key

1. Validate key format (basic validation)
2. Encrypt data with AES-256-GCM
3. Store in `users.groq_api_key`
4. Return success (never return the key back)

### Get API Key (internal)

1. Fetch encrypted value for user
2. Decrypt with AES-256-GCM
3. Return decrypted value
4. If not found, return null

### Delete API Key

1. Set `users.groq_api_key` to null
2. Return success

### Check API Key Exists

1. Check if `users.groq_api_key` is non-null
2. Return boolean (doesn't decrypt)

### Get Key Hint

1. Decrypt key
2. Return masked version (e.g., last 4 chars visible)
3. For UI display only

## UI - Settings Page

### API Keys Section

**Groq API Key:**
- Input field (password type, masked)
- "Save" button
- Status indicator: "Not configured" / "Configured"
- "Remove" button (when configured)
- Link to Groq console to get key
- Help text: "Required for AI-powered tag suggestions"

## Security Considerations

- Keys encrypted at rest
- Keys never logged
- Keys never returned to client after saving
- UI only shows "configured" status or masked hint, not actual key
- Decryption only happens server-side when needed
- ENCRYPTION_KEY must be kept secure and consistent across deployments

## Acceptance Criteria

1. **Groq key saves** - User can save Groq API key
2. **Groq key encrypts** - Database contains encrypted blob, not plaintext
3. **Groq key works** - Tag suggestions work after saving key
4. **Groq key status shows** - UI shows "Configured" when key saved
5. **Groq key removes** - User can remove saved key
6. **No key shows status** - UI shows "Not configured" when no key
7. **Encryption works** - Decryption with correct secret returns original value
8. **Wrong secret fails** - Decryption with wrong secret throws error
9. **Keys isolated** - User A cannot access User B's keys
