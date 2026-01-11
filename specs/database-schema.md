# Database Schema

PostgreSQL database schema using Drizzle ORM for type-safe database operations.

## Overview

The database stores users, their configured subreddits, tags with search terms, and fetched posts. Drizzle ORM provides type-safe queries and migrations.

## Technology

- PostgreSQL 17
- Drizzle ORM with `drizzle-kit` for migrations
- Connection via `DATABASE_URL` environment variable

## Schema

### users

For v1, single-user, but schema supports multi-tenant future.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| email | varchar(255) | unique, not null | User email (placeholder for future auth) |
| created_at | timestamp | not null, default now | Record creation time |
| updated_at | timestamp | not null, default now | Last update time |

### subreddits

Subreddits a user wants to monitor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK users, not null | Owner |
| name | varchar(100) | not null | Subreddit name without r/ prefix |
| created_at | timestamp | not null, default now | Record creation time |

Unique constraint: (user_id, name)

### tags

Groupings for search terms (e.g., "Yugabyte", "Distributed Postgres").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen | Primary key |
| user_id | uuid | FK users, not null | Owner |
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
| user_id | uuid | FK users, not null | Owner who fetched this |
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

## Migrations

- Use `drizzle-kit` for migration generation
- Migrations stored in `webapp/drizzle/migrations`
- Migration command: `npm run db:migrate`
- Schema push for dev: `npm run db:push`

## Seeding

Provide a seed script for development:
- Creates a default user
- Adds sample subreddits: postgresql, database, node
- Adds sample tags: "Yugabyte" (terms: yugabyte, yugabytedb), "Distributed PG" (terms: distributed postgres, distributed postgresql)
- Adds sample posts in various statuses for UI testing

## Acceptance Criteria

1. **Schema matches spec** - All tables, columns, types, and constraints match this specification
2. **Migrations work** - `npm run db:migrate` applies schema to fresh database without errors
3. **Foreign keys enforced** - Deleting a user cascades to their subreddits, tags, and posts
4. **Unique constraints enforced** - Duplicate (user_id, reddit_id) for posts is rejected
5. **Drizzle types generated** - TypeScript types are inferred from schema, no manual type definitions
6. **Seed script works** - `npm run db:seed` populates database with test data
7. **Indexes created** - (user_id, status) index exists on posts table
