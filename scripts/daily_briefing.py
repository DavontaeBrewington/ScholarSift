#!/usr/bin/env python3
"""
ScholarSift Daily Briefing Cron Script.

Usage:
    python scripts/daily_briefing.py "topic1" "topic2" ...

Takes a list of saved topic/collection names, calls the app's /api/search
for each, and prints a formatted text briefing with the top 3 new papers
per topic. Designed for cron delivery (stdout → email/file).

Example cron entry:
    0 8 * * * cd /home/ubuntu && \
        /home/ubuntu/scholarly_app/venv/bin/python \
        /home/ubuntu/scholarly_app/scripts/daily_briefing.py \
        "quantum machine learning" "transformers" >> /tmp/briefing_output.txt
"""

import sys
import json
import urllib.parse
from datetime import datetime

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Install with: pip install httpx")
    sys.exit(1)

API_BASE = "http://localhost:8000"
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def search_topic(topic: str, max_results: int = 5) -> list[dict]:
    """Search the app's API for a topic and return results."""
    url = f"{API_BASE}/api/search?q={urllib.parse.quote(topic)}&max_results={max_results}"
    try:
        resp = httpx.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", [])
    except Exception as e:
        print(f"[ERROR] API request failed for '{topic}': {e}", file=sys.stderr)
        return []


def format_briefing(topics: list[str]) -> str:
    """Format a text briefing with top papers per topic."""
    today = datetime.now()
    now_str = today.strftime("%Y-%m-%d %H:%M UTC")
    weekday = WEEKDAYS[today.weekday()]

    lines = []
    lines.append("=" * 74)
    lines.append(f"  📋 ScholarSift Daily Briefing")
    lines.append(f"  {weekday}, {now_str}")
    lines.append("=" * 74)
    lines.append("")

    for topic in topics:
        lines.append(f"─── 🎯 {topic} {'─' * (62 - len(topic))}")
        lines.append("")

        papers = search_topic(topic, max_results=5)
        top3 = papers[:3]

        if not top3:
            lines.append("  No new results found for this topic.")
            lines.append("")
            continue

        for i, p in enumerate(top3, 1):
            title = p.get("title", "Untitled")
            authors = p.get("authors", [])
            year = p.get("year", "?")
            source = p.get("source", "Unknown")
            url = p.get("url", "")
            abstract = (p.get("abstract", "") or "")
            if len(abstract) > 200:
                abstract = abstract[:200] + "..."

            author_str = ", ".join(authors[:3])
            if len(authors) > 3:
                author_str += " et al."

            lines.append(f"  [{i}] {title}")
            lines.append(f"      {author_str} ({year}) — {source}")
            if url:
                lines.append(f"      {url}")
            if abstract:
                # Word-wrap abstract
                words = abstract.split()
                wrapped = []
                line = ""
                for word in words:
                    if len(line) + len(word) + 1 > 68:
                        wrapped.append(line)
                        line = "      " + word
                    else:
                        line = (line + " " + word) if line else "      " + word
                if line:
                    wrapped.append(line)
                for wl in wrapped:
                    lines.append(wl)
            lines.append("")

        if len(papers) > 3:
            lines.append(f"  (+ {len(papers) - 3} more results available)")
            lines.append("")

    lines.append("─" * 74)
    lines.append("  ScholarSift Academic Dashboard — Daily Briefing")
    lines.append(f"  Generated {now_str}")
    lines.append("=" * 74)

    return "\n".join(lines)


def main():
    topics = sys.argv[1:]
    if not topics:
        print("Usage: python daily_briefing.py <topic1> [topic2 ...]")
        print("")
        print("Examples:")
        print("  python daily_briefing.py \"quantum computing\"")
        print("  python daily_briefing.py \"NLP\" \"reinforcement learning\" \"transformers\"")
        sys.exit(1)

    briefing = format_briefing(topics)
    print(briefing)


if __name__ == "__main__":
    main()
