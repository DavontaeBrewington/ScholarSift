# ============================================================
# ScholarSift — Production Dockerfile (multi-stage build)
# ============================================================

# ── Stage 1: Dependency installation ────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Install system build deps (only needed for pip compile / wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Runtime image ─────────────────────────────────
FROM python:3.12-slim

# Create non-root user
RUN groupadd -r scholarsift && useradd -r -g scholarsift -d /app -s /sbin/nologin scholarsift

WORKDIR /app

# Copy pre-built wheels from builder
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are on the path
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY . .

# Ensure DB directory is writable by non-root
RUN mkdir -p /data && chown -R scholarsift:scholarsift /data /app

# Switch to non-root user
USER scholarsift

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run with uvicorn
CMD ["python3", "-m", "uvicorn", "scholarly_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
