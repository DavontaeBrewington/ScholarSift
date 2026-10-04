#!/usr/bin/env bash
#
# ScholarSift Daily Briefing Cron Setup Script
#
# This script:
#   1. Reads saved topics/collections from the app's localStorage (via a helper endpoint)
#   2. Guides you through scheduling a daily cron via `hermes cron create`
#
# Usage:
#   bash scripts/setup_briefing.sh
#
# Prerequisites:
#   - The ScholarSift server must be running on localhost:8000
#   - hermes CLI must be available

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
VENV_PYTHON="$APP_DIR/venv/bin/python3"
BRIEFING_SCRIPT="$SCRIPT_DIR/daily_briefing.py"

echo "============================================"
echo "  ScholarSift Daily Briefing Setup"
echo "============================================"
echo ""

# Check for venv
if [ ! -f "$VENV_PYTHON" ]; then
    echo "[!] Virtual environment not found at $VENV_PYTHON"
    echo "    Attempting to use system python3..."
    VENV_PYTHON="$(which python3)"
fi

# Check for hermes CLI
if ! command -v hermes &>/dev/null; then
    echo "[!] hermes CLI not found. Install with:"
    echo "    curl -fsSL https://hermes-agent.nousresearch.com/install | sh"
    echo ""
    echo "    You can still set up the cron manually (see MANUAL CRON below)."
    echo ""
    HAS_HERMES=false
else
    HAS_HERMES=true
fi

# Ask for topics
echo "Enter the topics/collections you want in your daily briefing."
echo "Separate multiple topics with commas (e.g.: quantum computing, NLP, transformers)"
echo ""
read -rp "Topics: " TOPICS_INPUT

# Parse topics (split on comma, trim whitespace)
IFS=',' read -ra TOPIC_ARRAY <<< "$TOPICS_INPUT"
TOPICS=()
for t in "${TOPIC_ARRAY[@]}"; do
    t_trimmed="$(echo "$t" | xargs)"
    if [ -n "$t_trimmed" ]; then
        TOPICS+=("$t_trimmed")
    fi
done

if [ ${#TOPICS[@]} -eq 0 ]; then
    echo "[!] No topics provided. Aborting."
    exit 1
fi

echo ""
echo "Topics: ${TOPICS[*]}"
echo ""

# Preview the briefing
echo "Generating preview briefing..."
echo "------------------------------------------------"
"$VENV_PYTHON" "$BRIEFING_SCRIPT" "${TOPICS[@]}"
echo "------------------------------------------------"
echo ""

# Build cron command
TOPICS_QUOTED=()
for t in "${TOPICS[@]}"; do
    TOPICS_QUOTED+=("\"$t\"")
done

CRON_CMD="cd $APP_DIR && $VENV_PYTHON $BRIEFING_SCRIPT ${TOPICS_QUOTED[*]} >> /tmp/scholarsift_briefing.log 2>&1"

if $HAS_HERMES; then
    echo "Scheduling daily cron via hermes..."
    echo ""
    echo "Run:"
    echo ""
    echo "  hermes cron create --schedule '0 8 * * *' \\"
    echo "    --name 'scholarsift-daily-briefing' \\"
    echo "    --command \"$CRON_CMD\""
    echo ""
    echo "This will run the briefing every day at 8:00 AM."
    echo ""
else
    echo "MANUAL CRON SETUP"
    echo "================="
    echo ""
    echo "Add the following line to your crontab (crontab -e):"
    echo ""
    echo "  0 8 * * * $CRON_CMD"
    echo ""
    echo "This will run the briefing every day at 8:00 AM."
    echo "Output is logged to /tmp/scholarsift_briefing.log"
fi

echo ""
echo "To test immediately, run:"
echo ""
echo "  $VENV_PYTHON $BRIEFING_SCRIPT ${TOPICS_QUOTED[*]}"
echo ""
echo "============================================"
