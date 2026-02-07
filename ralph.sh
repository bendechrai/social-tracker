#!/bin/bash
# Run Ralph in a sandboxed Docker container
# Usage: ./ralph.sh <plan|build|stop> [max_iterations]
# Examples:
#   ./ralph.sh plan         # Plan mode, single run
#   ./ralph.sh build        # Build mode, unlimited
#   ./ralph.sh build 20     # Build mode, max 20 iterations
#   ./ralph.sh stop         # Stop after current iteration

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: ./ralph.sh <plan|build|stop> [max_iterations]"
    exit 1
fi

MODE="$1"

# Handle stop command
if [ "$MODE" = "stop" ]; then
    touch .ralph-stop
    echo "Stop file created. Ralph will stop after the current iteration."
    exit 0
fi

if [ "$MODE" != "plan" ] && [ "$MODE" != "build" ]; then
    echo "Error: mode must be 'plan', 'build', or 'stop'"
    exit 1
fi

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

# Clear any stale stop file from a previous run
rm -f .ralph-stop

# Build the ralph container if needed
echo "Building Ralph container..."
docker compose --env-file .env build ralph

# Run the loop inside the container
echo "Starting Ralph..."
docker compose --env-file .env run --rm ralph ./loop.sh "$MODE" "${2:-}"
