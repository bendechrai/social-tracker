# LLM Tag Suggestions

Use an LLM to suggest search terms when creating or editing tags.

## Overview

When a user creates a tag (e.g., "Yugabyte"), the system can suggest related search terms they might want to include (e.g., "yugabytedb", "yb-master", "distributed sql"). This uses a fast, cheap LLM via Groq.

## Technology

- Vercel AI SDK (`ai` package)
- Groq provider (`@ai-sdk/groq`)
- Model: `llama-3.3-70b-versatile` (fast, capable, cheap)
- Environment variable: `GROQ_API_KEY`

## User Flow

1. User enters tag name in settings (e.g., "Yugabyte")
2. User clicks "Suggest Terms" button
3. System calls LLM with tag name
4. LLM returns suggested terms
5. UI shows suggestions as checkboxes
6. User selects which to include
7. Selected terms added to tag

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
import { groq } from '@ai-sdk/groq';

const result = await generateText({
  model: groq('llama-3.3-70b-versatile'),
  system: SYSTEM_PROMPT,
  prompt: `Topic: ${tagName}`,
});

const suggestions = JSON.parse(result.text);
```

## Error Handling

- Groq API errors: Return empty suggestions array, log error
- Invalid JSON response: Retry once, then return empty
- Rate limiting: Implement basic retry with backoff
- Empty tag name: Return 400 error

## UI Integration

In the tag creation/edit form:

1. Button: "✨ Suggest Terms" (disabled while loading)
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
- Server-side: Basic rate limit of 10 requests per minute per user (future)

## Acceptance Criteria

1. **Suggestions returned** - Given a tag name, LLM returns relevant search terms
2. **JSON parsed correctly** - Response is valid array of strings
3. **UI shows suggestions** - Checkboxes appear for each suggestion
4. **Selection works** - Can check/uncheck suggestions
5. **Terms added** - Selected suggestions become search terms on the tag
6. **Duplicates handled** - Already-existing terms not duplicated
7. **Loading state shown** - Button disabled, spinner during API call
8. **Errors handled gracefully** - API failure shows error message, doesn't crash
9. **Empty input rejected** - Cannot suggest terms for empty tag name
