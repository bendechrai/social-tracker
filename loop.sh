#!/bin/bash
# Usage: ./loop.sh <plan|build> [max_iterations]
# Examples:
#   ./loop.sh build         # Build mode, unlimited iterations
#   ./loop.sh build 20      # Build mode, max 20 iterations
#   ./loop.sh plan           # Plan mode, single run (no looping)

set -euo pipefail

# This script runs inside the Ralph Docker container. Use ralph.sh to launch it.
if [ ! -f /.dockerenv ]; then
    echo "Error: loop.sh must run inside the Ralph container. Use ./ralph.sh instead."
    exit 1
fi

STOPFILE=".ralph-stop"

# Parse arguments
MODE="${1:-build}"
if [ "$MODE" = "plan" ]; then
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=1
elif [ "$MODE" = "build" ]; then
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=${2:-0}
else
    echo "Error: mode must be 'plan' or 'build'"
    exit 1
fi

ITERATION=0
CURRENT_BRANCH=$(git branch --show-current)

# Configure git credentials for push (if GITHUB_TOKEN is set)
if [ -n "${GITHUB_TOKEN:-}" ]; then
    # Get repo URL and convert to HTTPS with token
    REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$REPO_URL" == git@github.com:* ]]; then
        # Convert SSH to HTTPS format
        REPO_PATH=${REPO_URL#git@github.com:}
        REPO_PATH=${REPO_PATH%.git}
        git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"
        echo "Git configured for HTTPS push with token"
    elif [[ "$REPO_URL" == https://github.com/* ]]; then
        # Already HTTPS, add token
        REPO_PATH=${REPO_URL#https://github.com/}
        REPO_PATH=${REPO_PATH%.git}
        git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"
        echo "Git configured for HTTPS push with token"
    fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
echo "Branch: $CURRENT_BRANCH"
[ $MAX_ITERATIONS -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
echo "To stop after current iteration: ./ralph.sh stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
    # Check for stop file
    if [ -f "$STOPFILE" ]; then
        echo "Stop file detected. Exiting."
        rm -f "$STOPFILE"
        break
    fi

    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    ITERATION=$((ITERATION + 1))
    echo -e "\n\n======================== LOOP $ITERATION ========================\n"

    # Run Ralph iteration with selected prompt
    # -p: Headless mode (non-interactive, reads from stdin)
    # --dangerously-skip-permissions: Auto-approve all tool calls (YOLO mode)
    # --output-format=text: Readable output for monitoring
    # --model opus: Primary agent uses Opus for complex reasoning
    # --verbose: Detailed execution logging
    cat "$PROMPT_FILE" | claude -p \
        --dangerously-skip-permissions \
        --output-format=text \
        --model opus \
        --verbose

    # Push changes after each iteration
    git push origin "$CURRENT_BRANCH" 2>/dev/null || {
        echo "Failed to push. Creating remote branch..."
        git push -u origin "$CURRENT_BRANCH" || echo "Push failed - will retry next iteration"
    }

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Loop $ITERATION complete."
    echo "Press Ctrl+C to stop, or wait to continue..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    for i in 5 4 3 2 1; do
        echo -n "$i... "
        sleep 1
    done
    echo ""

done
