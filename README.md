# Social Tracker

A developer relations tool for monitoring Reddit for mentions of topics you care about. Track posts, manage responses, and never miss a community conversation.

## Features

- **Reddit Monitoring** - Search configured subreddits for posts matching your keywords (via Arctic Shift API — no Reddit account needed)
- **Tag Organization** - Group related search terms (e.g., "Yugabyte" includes "yugabyte", "yugabytedb", "yb-master")
- **Post Triage** - Move posts through New → Ignored or Done workflow
- **Response Tracking** - Record your responses for later reference and metrics
- **LLM-Assisted Setup** - Get smart suggestions for search terms when creating tags

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Node.js 22+](https://nodejs.org/)
- [devports](https://www.npmjs.com/package/devports) - `npm install -g devports`

### 1. Clone and Setup

```bash
git clone https://github.com/bendechrai/social-tracker.git
cd social-tracker

# Copy the example env file
cp .env.devports.example .env.devports

# Initialize devports (allocates ports, generates .env and docker-compose.yml)
devports setup

# Make scripts executable
chmod +x ralph.sh loop.sh
```

### 2. Configure Environment

Edit `.env` and add your API keys. See [Getting API Keys](#getting-api-keys) below for detailed instructions.

```bash
# Required for Ralph (autonomous building)
CLAUDE_CODE_OAUTH_TOKEN=

# Optional for the app
GROQ_API_KEY=

# Required for Ralph to push commits
GITHUB_TOKEN=
```

### 3. Start the Database

```bash
docker compose up -d db
```

### 4. Run the App (Manual Development)

```bash
cd webapp
npm install
npm run db:migrate
npm run db:seed    # Optional: add test data
npm run dev
```

Visit http://localhost:3000 (or your devports-assigned port).

---

## Getting API Keys

### Reddit Data (No Setup Required)

Reddit data is fetched via the [Arctic Shift API](https://arctic-shift.photon-reddit.com) — a free, public archive of Reddit data. No Reddit account, API keys, or OAuth setup needed. Data has a ~36-hour delay from when posts are created on Reddit.

### Claude Code OAuth Token

Claude Code uses an OAuth token, not an API key. There are two ways to get one:

**Option A: Via Claude CLI (easiest)**
1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Run `claude` in your terminal
3. Follow the authentication prompts
4. Run `claude /settings` and copy your OAuth token

**Option B: Via Console**
1. Go to https://console.anthropic.com/
2. Navigate to **Settings** → **OAuth tokens**
3. Create a new token
4. Copy the token (starts with `sk-ant-oat...`)

Add to `.env`:
```
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...
```

### Groq API Key

1. Go to https://console.groq.com/
2. Sign up or log in (free tier available)
3. Navigate to **API Keys**
4. Click **"Create API Key"**
5. Name it and copy the key
6. Add to `.env`:
   ```
   GROQ_API_KEY=gsk_...
   ```

### GitHub Personal Access Token

Ralph needs to push commits. Use a fine-grained token scoped to just this repo:

1. Go to https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Fill in:
   - **Token name**: `social-tracker-ralph`
   - **Expiration**: Your choice (90 days is reasonable)
   - **Repository access**: Select **"Only select repositories"** → choose `social-tracker`
4. Under **Permissions → Repository permissions**:
   - **Contents**: Read and write
   - (Leave everything else as "No access")
5. Click **"Generate token"**
6. Copy the token
7. Add to `.env`:
   ```
   GITHUB_TOKEN=github_pat_...
   ```

---

## Autonomous Development with Ralph

This project uses the [Ralph pattern](https://ghuntley.com/ralph/) for autonomous AI-driven development. Ralph (Claude) reads specs, generates an implementation plan, and builds iteratively - one task per loop, committing after each.

### How It Works

```
specs/*.md          → Requirements with acceptance criteria
PROMPT_plan.md      → "Study specs, generate implementation plan"
PROMPT_build.md     → "Pick task, implement, test, commit"
IMPLEMENTATION_PLAN.md → Generated task list (Ralph maintains this)
AGENTS.md           → Operational guide (how to build/test/run)
```

### Running Ralph

⚠️ **Ralph runs in a Docker sandbox for security. Never run `loop.sh` directly on your host.**

Ralph uses `--dangerously-skip-permissions` to operate autonomously. Without sandboxing, this would expose your SSH keys, browser cookies, AWS credentials, etc. The Docker container isolates Ralph to only this project directory and the API keys you explicitly provide.

#### First Time Setup

```bash
# 1. Make sure you've done the Quick Start steps above (devports setup, .env configured)

# 2. Start the database
docker compose up -d db

# 3. Build the Ralph container
docker compose build ralph

# 4. Generate the implementation plan (runs in Docker)
./ralph.sh plan
```

#### Building with Ralph

```bash
# Build autonomously until done (Ctrl+C to stop)
./ralph.sh

# Build with iteration limit (e.g., 20 tasks then stop)
./ralph.sh 20

# Regenerate the plan (after changing specs)
./ralph.sh plan
```

#### What `ralph.sh` Does

The `ralph.sh` script:
1. Sources your `.env` file
2. Validates `ANTHROPIC_API_KEY` is set
3. Runs `docker compose run --rm ralph ./loop.sh "$@"`

This means `loop.sh` executes **inside the container**, with:
- Only this project directory mounted
- Only the env vars from docker-compose.yml
- No access to your home directory, SSH keys, or other credentials

### Modifying Requirements

1. Edit files in `/specs/`
2. Regenerate the plan: `./ralph.sh plan`
3. Continue building: `./ralph.sh`

---

## Project Structure

```
social-tracker/
├── specs/                    # Requirements (one per topic)
│   ├── project-setup.md
│   ├── database-schema.md
│   ├── reddit-integration.md
│   ├── subreddit-configuration.md
│   ├── tag-system.md
│   ├── post-management.md
│   ├── ui-components.md
│   └── llm-tag-suggestions.md
├── webapp/                   # Next.js application
│   ├── app/                  # App Router
│   ├── components/           # React components
│   ├── lib/                  # Shared utilities
│   └── drizzle/              # Database schema & migrations
├── AGENTS.md                 # Operational guide for Ralph
├── PROMPT_plan.md            # Planning mode prompt
├── PROMPT_build.md           # Building mode prompt
├── IMPLEMENTATION_PLAN.md    # Generated by Ralph
├── loop.sh                   # Ralph loop (runs INSIDE container only)
├── ralph.sh                  # Wrapper to run Ralph in Docker sandbox
├── Dockerfile.ralph          # Ralph container definition
├── docker-compose.yml.devports
└── .env.devports
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui
- **Database**: PostgreSQL 17, Drizzle ORM
- **Testing**: Vitest, Playwright, MSW
- **LLM**: Groq (Llama 3.3 70B) for tag suggestions
- **APIs**: Arctic Shift (Reddit data archive)

## Development Commands

```bash
cd webapp

# Development
npm run dev              # Start dev server
npm run build            # Production build

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npm run db:studio        # Open Drizzle Studio

# Testing
npm run test             # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run typecheck        # TypeScript check
npm run lint             # ESLint
```

## Future Roadmap

- [ ] Comment monitoring (not just posts)
- [ ] Scheduled fetching (check every hour automatically)
- [ ] AI-suggested responses (research + draft using Claude)
- [ ] Multi-user support (authentication, tenant isolation)
- [ ] Metrics dashboard (response times, volume trends)

## License

MIT

## Acknowledgments

- [Ralph pattern](https://ghuntley.com/ralph/) by Geoffrey Huntley
- [Ralph Playbook](https://github.com/ClaytonFarr/ralph-playbook) by Clayton Farr
