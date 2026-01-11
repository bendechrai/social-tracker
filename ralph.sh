#!/bin/bash
# Run Ralph in a sandboxed Docker container
# Usage: ./ralph.sh [plan] [max_iterations]
# Examples:
#   ./ralph.sh              # Build mode, unlimited
#   ./ralph.sh plan         # Plan mode, generate implementation plan
#   ./ralph.sh 20           # Build mode, max 20 iterations

set -euo pipefail

# Check for required environment variables
check_env() {
    local var=$1
    if [ -z "${!var:-}" ]; then
        echo "Error: $var is not set"
        echo "Set it in your environment or in .env file"
        exit 1
    fi
}

# Source .env if it exists (for our validation and for docker compose)
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "Error: .env file not found"
    echo "Run 'cp .env.devports.example .env.devports && devports setup' first"
    exit 1
fi

# Required for Claude Code CLI
check_env "CLAUDE_CODE_OAUTH_TOKEN"

# Build the ralph container if needed
echo "Building Ralph container..."
docker compose --env-file .env build ralph

# Run the loop inside the container
echo "Starting Ralph..."
docker compose --env-file .env run --rm ralph ./loop.sh "$@"
