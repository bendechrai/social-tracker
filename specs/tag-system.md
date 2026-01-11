# Tag System

Manage tags and their associated search terms for organizing post discovery.

## Overview

Tags group related search terms under a meaningful label. For example, a "Yugabyte" tag might include terms: "yugabyte", "yugabytedb", "yb-master", "yb-tserver". When any term matches, the post gets the tag attached.

## Tag Structure

- **Tag**: The grouping label (e.g., "Yugabyte", "Distributed Postgres")
  - Has a display name
  - Has a color (hex) for UI rendering
  - Belongs to a user
  
- **Search Term**: Individual strings to search for
  - Belongs to exactly one tag
  - Case-insensitive matching in Reddit search

## Operations

### Create Tag

Input: user_id, name, color (optional), initial_terms (optional)

1. Validate name is unique for user
2. Create tag with default color if not provided
3. If initial_terms provided, create search_terms records
4. Return created tag with terms

### Update Tag

Input: tag_id, name (optional), color (optional)

1. Validate tag belongs to user
2. If name provided, validate uniqueness
3. Update fields
4. Return updated tag

### Delete Tag

Input: tag_id

1. Validate tag belongs to user
2. Delete tag (cascades to search_terms and post_tags)
3. Note: Posts remain, just lose the tag association

### Add Search Term

Input: tag_id, term

1. Validate tag belongs to user
2. Validate term is unique within tag
3. Create search_term record
4. Return updated tag with all terms

### Remove Search Term

Input: term_id

1. Validate term's tag belongs to user
2. Delete term
3. Note: Existing posts keep the tag (term was already matched)

### List Tags

Input: user_id

1. Fetch all tags for user
2. Include search_terms for each tag
3. Include count of posts per tag
4. Order by name alphabetically

### Get Tag

Input: tag_id

1. Validate tag belongs to user (or return 404)
2. Return tag with search_terms

## Color Palette

Provide a default color palette for tag creation:
- Indigo: #6366f1 (default)
- Rose: #f43f5e
- Amber: #f59e0b
- Emerald: #10b981
- Cyan: #06b6d4
- Purple: #a855f7
- Pink: #ec4899
- Blue: #3b82f6

## Search Term Guidelines

When creating terms, consider:
- Base product name: "yugabyte"
- Variations: "yugabytedb", "yb"
- Components: "yb-master", "yb-tserver"
- Common misspellings: "yugabites" (if relevant)

LLM suggestions (see llm-tag-suggestions.md) can help generate comprehensive term lists.

## Acceptance Criteria

1. **Tag CRUD works** - Can create, read, update, delete tags
2. **Term CRUD works** - Can add and remove search terms from tags
3. **Uniqueness enforced** - Duplicate tag names for same user rejected; duplicate terms within tag rejected
4. **Cascade delete** - Deleting tag removes its terms and post associations
5. **Posts retain on term delete** - Removing a search term doesn't untag already-matched posts
6. **Color persists** - Custom colors are saved and returned
7. **Post counts included** - List tags includes count of posts per tag
8. **Case insensitive terms** - Search terms are stored/compared case-insensitively
