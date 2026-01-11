# User API Keys

Per-user API key storage with encryption for external service credentials.

## Overview

Users bring their own API keys for external services (Groq, and Reddit OAuth tokens). Keys are encrypted at rest in the database. Each user's keys are isolated and only accessible to them.

## Encryption

- Algorithm: AES-256-GCM
- Key derivation: Encryption key from `API_KEYS_SECRET` environment variable
- Each value encrypted with unique IV
- Stored format: `iv:authTag:ciphertext` (base64 encoded)

## Environment Variable

```
API_KEYS_SECRET=<32-byte-hex-string>
```

Generate with: `openssl rand -hex 32`

## Database Schema

New `user_api_keys` table:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| user_id | uuid | FK users, unique per service | Owner |
| service | varchar(50) | not null | Service name: 'groq', 'reddit' |
| encrypted_data | text | not null | Encrypted JSON blob |
| created_at | timestamp | not null | When created |
| updated_at | timestamp | not null | Last updated |

Unique constraint: (user_id, service)

### Encrypted Data Structure

**Groq:**
```json
{
  "api_key": "gsk_..."
}
```

**Reddit:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1234567890
}
```

## Operations

### Save API Key

1. Validate service name
2. Encrypt data with AES-256-GCM
3. Upsert into user_api_keys
4. Return success (never return the key back)

### Get API Key (internal)

1. Fetch encrypted data for user + service
2. Decrypt with AES-256-GCM
3. Return decrypted object
4. If not found, return null

### Delete API Key

1. Delete record for user + service
2. Return success

### Check API Key Exists

1. Check if record exists for user + service
2. Return boolean (doesn't decrypt)

## Utility Functions

```typescript
// lib/encryption.ts
encrypt(plaintext: string): string  // Returns iv:authTag:ciphertext
decrypt(encrypted: string): string  // Returns plaintext

// lib/api-keys.ts
saveApiKey(userId: string, service: string, data: object): Promise<void>
getApiKey<T>(userId: string, service: string): Promise<T | null>
deleteApiKey(userId: string, service: string): Promise<void>
hasApiKey(userId: string, service: string): Promise<boolean>
```

## UI - Settings Page

Add "API Keys" section to settings:

### Groq API Key
- Input field (password type, masked)
- "Save" button
- Status indicator: "Not configured" / "Configured ✓"
- "Remove" button (when configured)
- Link to Groq console to get key

### Reddit Connection
- "Connect Reddit Account" button (when not connected)
- Status: "Connected as u/username" (when connected)
- "Disconnect" button (when connected)
- Note: Clicking connect initiates Reddit OAuth flow

## Security Considerations

- Keys encrypted at rest
- Keys never logged
- Keys never returned to client after saving
- UI only shows "configured" status, not actual key
- Decryption only happens server-side when needed
- API_KEYS_SECRET must be kept secure and consistent across deployments

## Acceptance Criteria

1. **Groq key saves** - User can save Groq API key
2. **Groq key encrypts** - Database contains encrypted blob, not plaintext
3. **Groq key works** - Tag suggestions work after saving key
4. **Groq key status shows** - UI shows "Configured" when key saved
5. **Groq key removes** - User can remove saved key
6. **No key shows status** - UI shows "Not configured" when no key
7. **Reddit connects** - OAuth flow completes and tokens stored
8. **Reddit status shows** - UI shows connected username
9. **Reddit disconnects** - User can disconnect Reddit account
10. **Encryption works** - Decryption with correct secret returns original value
11. **Wrong secret fails** - Decryption with wrong secret throws error
12. **Keys isolated** - User A cannot access User B's keys
