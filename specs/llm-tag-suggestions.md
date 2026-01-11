# LLM Tag Suggestions

Use an LLM to suggest search terms when creating or editing tags.

## Overview

When a user creates a tag (e.g., "Yugabyte"), the system can suggest related search terms they might want to include (e.g., "yugabytedb", "yb-master", "distributed sql"). This uses a fast, cheap LLM via Groq. Users provide their own Groq API key (BYOK).

## Technology

- Vercel AI SDK (`ai` package)
- Groq provider (`@ai-sdk/groq`)
- Model: `llama-3.3-70b-versatile` (fast, capable, cheap)
- API key: User's own key stored encrypted in `users.groq_api_key`

## BYOK (Bring Your Own Key)

Users must provide their own Groq API key to use tag suggestions:

1. User goes to Settings > API Keys
2. Enters their Groq API key (get from https://console.groq.com/)
3. Key is encrypted and stored in database
4. Key is decrypted server-side when making API calls

Without a Groq API key:
- "Suggest Terms" button is disabled
- Tooltip shows: "Add your Groq API key in Settings to enable suggestions"

## User Flow

1. User enters tag name in settings (e.g., "Yugabyte")
2. User clicks "Suggest Terms" button (requires Groq key configured)
3. System decrypts user's Groq API key
4. System calls LLM with tag name using user's key
5. LLM returns suggested terms
6. UI shows suggestions as checkboxes
7. User selects which to include
8. Selected terms added to tag

## API Endpoint

`POST /api/suggest-terms`

Request:
```json
{
  "tagName": "Yugabyte"
}
```

Response:
```json
{
  "suggestions": [
    "yugabyte",
    "yugabytedb", 
    "yb-master",
    "yb-tserver",
    "ysql",
    "ycql",
    "distributed sql",
    "distributed postgres"
  ]
}
```

Error (no API key):
```json
{
  "error": "Groq API key not configured",
  "code": "MISSING_API_KEY"
}
```

## Prompt Design

System prompt:
```
You are helping a developer relations professional track mentions of a technology topic on Reddit. Given a topic name, suggest search terms that would find relevant Reddit posts about this topic.

Include:
- The exact topic name (lowercase)
- Common variations and abbreviations
- Component names or features
- Related technical terms
- Common misspellings if applicable

Return ONLY a JSON array of strings, no explanation. Keep terms lowercase. Aim for 5-15 terms.
```

User prompt:
```
Topic: {tagName}
```

## Implementation

```typescript
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { decrypt } from '@/lib/encryption';

// Get user's encrypted API key from session/database
const encryptedKey = user.groq_api_key;
if (!encryptedKey) {
  return { error: 'Groq API key not configured', code: 'MISSING_API_KEY' };
}

// Decrypt and create provider with user's key
const apiKey = decrypt(encryptedKey);
const groq = createGroq({ apiKey });

const result = await generateText({
  model: groq('llama-3.3-70b-versatile'),
  system: SYSTEM_PROMPT,
  prompt: `Topic: ${tagName}`,
});

const suggestions = JSON.parse(result.text);
```

## Error Handling

- No API key configured: Return error with code `MISSING_API_KEY`
- Invalid API key: Return error with code `INVALID_API_KEY`, suggest checking key in Settings
- Groq API errors: Return empty suggestions array, log error
- Invalid JSON response: Retry once, then return empty
- Rate limiting: Implement basic retry with backoff
- Empty tag name: Return 400 error

## UI Integration

In the tag creation/edit form:

1. Button: "✨ Suggest Terms"
   - Disabled if user has no Groq API key configured
   - Tooltip when disabled: "Add your Groq API key in Settings to enable suggestions"
   - Disabled for 2 seconds after click (prevent spam)
2. Loading state: Spinner, "Thinking..."
3. Results: Checkbox list of suggestions
4. Each suggestion can be checked/unchecked
5. "Add Selected" button to add checked terms
6. Or click individual terms to toggle

Already-existing terms for this tag should be:
- Pre-checked if in suggestions
- Marked as "(already added)" 
- Not duplicated if selected

## Rate Limiting

- Client-side: Disable button for 2 seconds after click (prevent spam)
- Server-side: Basic rate limit of 10 requests per minute per user

## Acceptance Criteria

1. **BYOK works** - Uses user's Groq API key from database
2. **Missing key handled** - Button disabled, helpful message shown
3. **Invalid key handled** - Clear error message suggesting Settings check
4. **Suggestions returned** - Given a tag name and valid key, LLM returns relevant search terms
5. **JSON parsed correctly** - Response is valid array of strings
6. **UI shows suggestions** - Checkboxes appear for each suggestion
7. **Selection works** - Can check/uncheck suggestions
8. **Terms added** - Selected suggestions become search terms on the tag
9. **Duplicates handled** - Already-existing terms not duplicated
10. **Loading state shown** - Button disabled, spinner during API call
11. **Errors handled gracefully** - API failure shows error message, doesn't crash
12. **Empty input rejected** - Cannot suggest terms for empty tag name
