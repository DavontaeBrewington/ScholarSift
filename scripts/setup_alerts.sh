#!/usr/bin/env bash
# =========================================================================
# ScholarSift — Research Alert Cron Setup Script
# =========================================================================
# This interactive script helps you schedule regular research alerts
# using the `hermes cron` system.
#
# Usage:
#   bash scripts/setup_alerts.sh
#
# It will prompt you for:
#   1. The topic(s) you want to monitor
#   2. How often to check (hourly, daily, weekly)
#   3. The ScholarSift API base URL
# =========================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_PYTHON="${PROJECT_DIR}/venv/bin/python3"

echo "╔══════════════════════════════════════════════╗"
echo "║   ScholarSift — Research Alert Setup        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# --- Check prerequisites ---
if ! command -v hermes &>/dev/null; then
    echo "⚠️  'hermes' CLI not found. Alerts can still be scheduled via system cron."
    echo "   Install Hermes CLI for the 'hermes cron' integration."
    echo ""
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo "⚠️  Virtual environment Python not found at $VENV_PYTHON"
    echo "   Trying system python3..."
    VENV_PYTHON="python3"
fi

# --- Gather inputs ---
echo "Step 1: Enter the search topic(s) to monitor."
echo "  (You can set up multiple alerts — one per topic)"
echo ""

read -r -p "Topic to monitor (e.g., 'quantum computing'): " TOPIC
if [ -z "$TOPIC" ]; then
    echo "❌ Topic is required. Exiting."
    exit 1
fi

echo ""
echo "Step 2: How often should we check for new papers?"
echo "  1) Every hour"
echo "  2) Every 6 hours"
echo "  3) Every 12 hours"
echo "  4) Daily (at midnight)"
echo "  5) Weekly (every Monday morning)"
read -r -p "Choice [1-5] (default: 4): " FREQ_CHOICE

case "${FREQ_CHOICE:-4}" in
    1) CRON_SCHEDULE="0 * * * *"      ;;  # hourly
    2) CRON_SCHEDULE="0 */6 * * *"    ;;  # every 6 hours
    3) CRON_SCHEDULE="0 */12 * * *"   ;;  # every 12 hours
    4) CRON_SCHEDULE="0 0 * * *"      ;;  # daily at midnight
    5) CRON_SCHEDULE="0 8 * * 1"      ;;  # weekly Monday 8am
    *) CRON_SCHEDULE="0 0 * * *"      ;;  # default: daily
esac

echo ""
read -r -p "ScholarSift API base URL (default: http://localhost:8000): " API_BASE
API_BASE="${API_BASE:-http://localhost:8000}"

echo ""
read -r -p "API token (optional, press Enter to skip): " TOKEN

echo ""
echo "Step 3: Output format"
echo "  1) Text (human-readable alert)"
echo "  2) JSON (machine-readable, for script processing)"
read -r -p "Choice [1-2] (default: 1): " OUTPUT_CHOICE
OUTPUT_FLAG=""
if [ "${OUTPUT_CHOICE:-1}" = "2" ]; then
    OUTPUT_FLAG="--output-json"
fi

# --- Build command ---
ALERT_CMD="cd ${PROJECT_DIR} && ${VENV_PYTHON} scripts/research_alert.py \"${TOPIC}\" --api-base \"${API_BASE}\""
if [ -n "$TOKEN" ]; then
    ALERT_CMD="${ALERT_CMD} --token \"${TOKEN}\""
fi
if [ -n "$OUTPUT_FLAG" ]; then
    ALERT_CMD="${ALERT_CMD} ${OUTPUT_FLAG}"
fi

# --- Schedule via Hermes Cron ---
if command -v hermes &>/dev/null && hermes cron --help &>/dev/null 2>&1; then
    echo ""
    echo "Scheduling via Hermes cron..."
    hermes cron add \
        --name "alert_$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd 'a-z0-9_')" \
        --schedule "$CRON_SCHEDULE" \
        --command "$ALERT_CMD" \
        2>&1 || {
        echo "⚠️  Hermes cron scheduling failed, falling back to system crontab..."
        SCHEDULE_FALLBACK=true
    }
    
    if [ -z "$SCHEDULE_FALLBACK" ]; then
        echo "✅ Alert scheduled via Hermes cron!"
        echo "   Run 'hermes cron list' to see all scheduled alerts."
        echo ""
        echo "📋 Summary:"
        echo "   Topic:    $TOPIC"
        echo "   Schedule: $CRON_SCHEDULE"
        echo "   Command:  $ALERT_CMD"
        exit 0
    fi
fi

# --- Fallback: system crontab ---
echo ""
echo "Adding to system crontab..."
CRON_LINE="${CRON_SCHEDULE} ${ALERT_CMD}"

# Check if the line already exists
if crontab -l 2>/dev/null | grep -Fq "$TOPIC"; then
    echo "⚠️  An alert for '${TOPIC}' already exists in crontab."
    read -r -p "Overwrite? [y/N]: " OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "Skipping."
        exit 0
    fi
    # Remove old line
    (crontab -l 2>/dev/null | grep -vF "$TOPIC") | crontab -
fi

# Add new line
(echo "$(crontab -l 2>/dev/null)"; echo "$CRON_LINE") | crontab -

echo "✅ Alert scheduled via system crontab!"
echo ""
echo "📋 Summary:"
echo "   Topic:    $TOPIC"
echo "   Schedule: $CRON_SCHEDULE"
echo "   Command:  $ALERT_CMD"
echo ""
echo "To view your crontab: crontab -l"
echo "To remove: crontab -e"
