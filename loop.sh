#!/bin/bash
# Usage: ./loop.sh [plan] [max_iterations]
# Examples:
#   ./loop.sh              # Build mode, unlimited iterations
#   ./loop.sh 20           # Build mode, max 20 iterations
#   ./loop.sh plan         # Plan mode, unlimited iterations
#   ./loop.sh plan 5       # Plan mode, max 5 iterations

set -euo pipefail

# Parse arguments
if [ "${1:-}" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=${2:-0}
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=$1
else
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=0
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
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
    # --model opus: Primary agent uses Opus for complex reasoning (task selection, prioritization)
    #               Can use 'sonnet' in build mode for speed if plan is clear and tasks well-defined
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
