# Database Schema

PostgreSQL database schema using Drizzle ORM for type-safe database operations.

## Overview

The database stores users with authentication data, their configured subreddits, tags with search terms, and fetched posts. Drizzle ORM provides type-safe queries and migrations. Auth.js tables handle sessions and OAuth accounts.

## Technology

- PostgreSQL 17
- Drizzle ORM with `drizzle-kit` for migrations
- Auth.js Drizzle adapter for authentication tables
- Connection via `DATABASE_URL` environment variable

## Schema

### users

User accounts with authentication and API credentials.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| email | varchar(255) | unique, not null | User email (login identifier) |
| password_hash | varchar(255) | not null | bcrypt hashed password |
| reddit_access_token | text | nullable | Encrypted Reddit OAuth access token |
| reddit_refresh_token | text | nullable | Encrypted Reddit OAuth refresh token |
| reddit_token_expires_at | timestamp | nullable | When Reddit access token expires |
| reddit_username | varchar(100) | nullable | Connected Reddit username |
| groq_api_key | text | nullable | Encrypted Groq API key (BYOK) |
| created_at | timestamp | not null, default now | Record creation time |
| updated_at | timestamp | not null, default now | Last update time |

### sessions

Auth.js session storage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| session_token | varchar(255) | unique, not null | Session identifier |
| user_id | uuid | FK users, not null, cascade delete | Session owner |
| expires | timestamp | not null | Session expiry time |

### accounts

Auth.js OAuth accounts (for future Google/GitHub login).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK users, not null, cascade delete | Account owner |
| type | varchar(255) | not null | Account type (oauth, credentials) |
| provider | varchar(255) | not null | Provider name (google, github) |
| provider_account_id | varchar(255) | not null | ID from provider |
| refresh_token | text | nullable | OAuth refresh token |
| access_token | text | nullable | OAuth access token |
| expires_at | integer | nullable | Token expiry (unix timestamp) |
| token_type | varchar(255) | nullable | Token type |
| scope | varchar(255) | nullable | OAuth scopes |
| id_token | text | nullable | OIDC ID token |

Unique constraint: (provider, provider_account_id)

### verification_tokens

Auth.js verification tokens (for future email verification).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| identifier | varchar(255) | not null | Email or other identifier |
| token | varchar(255) | unique, not null | Verification token |
| expires | timestamp | not null | Token expiry |

Primary key: (identifier, token)

### subreddits

Subreddits a user wants to monitor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK users, not null, cascade delete | Owner |
| name | varchar(100) | not null | Subreddit name without r/ prefix |
| created_at | timestamp | not null, default now | Record creation time |

Unique constraint: (user_id, name)

### tags

Groupings for search terms (e.g., "Yugabyte", "Distributed Postgres").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK users, not null, cascade delete | Owner |
| name | varchar(100) | not null | Display name for the tag |
| color | varchar(7) | not null, default #6366f1 | Hex color for UI pill |
| created_at | timestamp | not null, default now | Record creation time |

Unique constraint: (user_id, name)

### search_terms

Individual search terms belonging to a tag.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| tag_id | uuid | FK tags, not null, cascade delete | Parent tag |
| term | varchar(255) | not null | The search term |
| created_at | timestamp | not null, default now | Record creation time |

Unique constraint: (tag_id, term)

### posts

Reddit posts fetched and stored.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK users, not null, cascade delete | Owner who fetched this |
| reddit_id | varchar(20) | not null | Reddit's ID (t3_xxxxx) |
| title | text | not null | Post title |
| body | text | | Post body (selftext) |
| author | varchar(100) | not null | Reddit username |
| subreddit | varchar(100) | not null | Subreddit name |
| permalink | text | not null | Reddit permalink |
| url | text | | External URL for link posts |
| reddit_created_at | timestamp | not null | When posted on Reddit |
| score | integer | not null, default 0 | Reddit score |
| num_comments | integer | not null, default 0 | Comment count |
| status | varchar(20) | not null, default 'new' | new, ignored, done |
| response_text | text | | User's response notes |
| responded_at | timestamp | | When user marked as done |
| created_at | timestamp | not null, default now | Record creation time |
| updated_at | timestamp | not null, default now | Last update time |

Unique constraint: (user_id, reddit_id)

Index: (user_id, status) for filtered queries

### post_tags

Many-to-many relationship between posts and tags.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| post_id | uuid | FK posts, not null, cascade delete | Post |
| tag_id | uuid | FK tags, not null, cascade delete | Tag |

Primary key: (post_id, tag_id)

## Encrypted Fields

The following fields are encrypted using AES-256-GCM before storage:
- `users.reddit_access_token`
- `users.reddit_refresh_token`
- `users.groq_api_key`

See `authentication.md` for encryption implementation details.

## Migrations

- Use `drizzle-kit` for migration generation
- Migrations stored in `webapp/drizzle/migrations`
- Migration command: `npm run db:migrate`
- Schema push for dev: `npm run db:push`

## Seeding

Provide a seed script for development that creates a test user:
- Email: `test@example.com`
- Password: `TestPassword123!` (meets requirements)
- Sample subreddits: postgresql, database, node
- Sample tags: "Yugabyte" (terms: yugabyte, yugabytedb), "Distributed PG" (terms: distributed postgres, distributed postgresql)
- Sample posts in various statuses for UI testing

Note: Seed script should hash password with bcrypt before storing.

## Acceptance Criteria

1. **Schema matches spec** - All tables, columns, types, and constraints match this specification
2. **Migrations work** - `npm run db:migrate` applies schema to fresh database without errors
3. **Foreign keys enforced** - Deleting a user cascades to their sessions, subreddits, tags, and posts
4. **Unique constraints enforced** - Duplicate (user_id, reddit_id) for posts is rejected
5. **Drizzle types generated** - TypeScript types are inferred from schema, no manual type definitions
6. **Seed script works** - `npm run db:seed` populates database with test user and data
7. **Indexes created** - (user_id, status) index exists on posts table
8. **Auth.js tables present** - sessions, accounts, verification_tokens tables exist
9. **Encrypted fields work** - Can store and retrieve encrypted values correctly
