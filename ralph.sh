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

# Source .env if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Required for Claude CLI
check_env "ANTHROPIC_API_KEY"

# Build the ralph container if needed
echo "Building Ralph container..."
docker compose build ralph

# Run the loop inside the container
echo "Starting Ralph..."
docker compose run --rm ralph ./loop.sh "$@"
