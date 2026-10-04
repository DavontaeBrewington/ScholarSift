#!/usr/bin/env bash
# ScholarSift — Deploy Script
# Usage: ./deploy.sh [--no-docker]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ "${1:-}" = "--no-docker" ]; then
    echo "[*] Running ScholarSift without Docker..."
    # Ensure uv is available
    if command -v uv &> /dev/null; then
        echo "[*] Found uv package manager"
        if [ ! -d venv ]; then
            echo "[*] Creating virtual environment with uv..."
            uv venv venv
        fi
        echo "[*] Installing dependencies with uv..."
        uv pip install --quiet -r requirements.txt
        echo "[*] Starting uvicorn server..."
        PYTHONPATH="$SCRIPT_DIR" exec venv/bin/python3 -m uvicorn scholarly_app.main:app --host 0.0.0.0 --port 8000 --reload
    else
        # Fallback to pip/venv
        if [ ! -d venv ]; then
            echo "[*] Creating virtual environment..."
            python3 -m venv venv
        fi
        echo "[*] Activating virtual environment..."
        source venv/bin/activate
        echo "[*] Installing dependencies..."
        pip install --quiet -r requirements.txt
        echo "[*] Starting uvicorn server..."
        PYTHONPATH="$SCRIPT_DIR" exec python3 -m uvicorn scholarly_app.main:app --host 0.0.0.0 --port 8000 --reload
    fi
    exit 0
fi

# --- Docker path ---
if ! command -v docker &> /dev/null; then
    echo "[!] Docker not found. Install Docker or use ./deploy.sh --no-docker"
    exit 1
fi

echo "[*] Building ScholarSift Docker image..."
docker build -t scholarsift:latest .

echo "[*] Stopping any existing container..."
docker rm -f scholarsift 2>/dev/null || true

echo "[*] Starting ScholarSift container..."
docker run -d \
    --name scholarsift \
    -p 8000:8000 \
    --restart unless-stopped \
    scholarsift:latest

echo ""
echo "[✓] ScholarSift is running at http://localhost:8000"
echo "    To stop:   docker stop scholarsift"
echo "    To view logs: docker logs -f scholarsift"
echo ""
