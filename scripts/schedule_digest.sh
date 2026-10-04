#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# ScholarSift Weekly Digest Scheduler
# ============================================================================
# This script helps you schedule a weekly digest using Hermes cron API.
#
# Usage:
#   chmod +x schedule_digest.sh
#   ./schedule_digest.sh
#
# It will prompt you for your saved query and preferred schedule,
# then print instructions for scheduling with Hermes cron.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  ScholarSift Weekly Digest Scheduler"
echo "============================================"
echo ""

read -p "Enter your saved search query: " QUERY
if [ -z "$QUERY" ]; then
    echo "ERROR: Query cannot be empty."
    exit 1
fi

echo ""
echo "Select schedule (day of week):"
echo "  1) Monday"
echo "  2) Tuesday"
echo "  3) Wednesday"
echo "  4) Thursday"
echo "  5) Friday"
echo "  6) Saturday"
echo "  7) Sunday"
echo "  8) Every day"
echo "  9) Custom cron expression"
read -p "Choose [1-9]: " SCHEDULE_CHOICE

CRON_EXPR=""
SCHEDULE_NAME=""

case "$SCHEDULE_CHOICE" in
    1) CRON_EXPR="0 9 * * 1"; SCHEDULE_NAME="Monday 9:00 AM" ;;
    2) CRON_EXPR="0 9 * * 2"; SCHEDULE_NAME="Tuesday 9:00 AM" ;;
    3) CRON_EXPR="0 9 * * 3"; SCHEDULE_NAME="Wednesday 9:00 AM" ;;
    4) CRON_EXPR="0 9 * * 4"; SCHEDULE_NAME="Thursday 9:00 AM" ;;
    5) CRON_EXPR="0 9 * * 5"; SCHEDULE_NAME="Friday 9:00 AM" ;;
    6) CRON_EXPR="0 9 * * 6"; SCHEDULE_NAME="Saturday 9:00 AM" ;;
    7) CRON_EXPR="0 9 * * 7"; SCHEDULE_NAME="Sunday 9:00 AM" ;;
    8) CRON_EXPR="0 9 * * *"; SCHEDULE_NAME="Daily 9:00 AM" ;;
    9)
        read -p "Enter cron expression (e.g. '0 9 * * 1'): " CRON_EXPR
        SCHEDULE_NAME="Custom ($CRON_EXPR)"
        ;;
    *) echo "Invalid choice."; exit 1 ;;
esac

echo ""
echo "============================================"
echo "  Summary"
echo "============================================"
echo "  Query:        $QUERY"
echo "  Schedule:     $SCHEDULE_NAME"
echo "  Cron:         $CRON_EXPR"
echo "  Script:       $PROJECT_DIR/scripts/digest_cron.py"
echo "============================================"
echo ""

echo "To schedule this digest with Hermes cron, run these steps:"
echo ""
echo "---"
echo ""
echo "STEP 1: Register the cron job"
echo ""
echo "  hermes cron add \\"
echo "    --name \"weekly-digest-${QUERY// /-}\" \\"
echo "    --schedule \"$CRON_EXPR\" \\"
echo "    --command \"cd $PROJECT_DIR && $PROJECT_DIR/venv/bin/python scripts/digest_cron.py '$QUERY'\" \\"
echo "    --label \"ScholarSift Digest: $QUERY\""
echo ""
echo "STEP 2: List your cron jobs"
echo ""
echo "  hermes cron list"
echo ""
echo "STEP 3: Remove the job later (if desired)"
echo ""
echo "  hermes cron remove <job-id>"
echo ""
echo "---"
echo ""
echo "NOTE: The cron job output (the digest text) will be captured by Hermes"
echo "and delivered according to your notification settings."
echo ""
echo "To test the digest script immediately, run:"
echo ""
echo "  cd $PROJECT_DIR && $PROJECT_DIR/venv/bin/python scripts/digest_cron.py \"$QUERY\""
echo ""
