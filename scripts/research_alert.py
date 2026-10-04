#!/usr/bin/env python3
"""
ScholarSift — Research Alert Script
====================================
Checks a search topic for new papers since the last check.
Designed to be run as a cron job.

Usage:
    python research_alert.py <topic> [--token <token>] [--api-base <url>]

The script stores the last-seen paper URLs in a JSON file so it can
detect what's new between runs.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx")
    sys.exit(1)

ALERTS_DIR = os.path.join(os.path.dirname(__file__), "..", "alerts")
os.makedirs(ALERTS_DIR, exist_ok=True)


def get_state_file(topic: str) -> str:
    """Return the path to the state file for a given topic."""
    safe_name = topic.lower().replace(" ", "_").replace("/", "_")[:50]
    return os.path.join(ALERTS_DIR, f"state_{safe_name}.json")


def load_state(topic: str) -> dict:
    """Load the previous run's state for this topic."""
    path = get_state_file(topic)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {
        "topic": topic,
        "last_run": None,
        "known_urls": [],
        "total_seen": 0,
    }


def save_state(topic: str, state: dict):
    """Save the current state for this topic."""
    path = get_state_file(topic)
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    with open(path, "w") as f:
        json.dump(state, f, indent=2)


async def check_topic(topic: str, token: str = "", api_base: str = "http://localhost:8000") -> list[dict]:
    """Search for papers on a topic and return new ones."""
    params = {"q": topic, "max_results": 25}
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{api_base}/api/search", params=params)
        if resp.status_code != 200:
            print(f"Error: API returned status {resp.status_code}: {resp.text}")
            return []
        
        data = resp.json()
        results = data.get("results", [])
    
    # Load previous state
    state = load_state(topic)
    known_urls = set(state.get("known_urls", []))
    
    # Find new papers
    new_papers = []
    all_urls = set()
    
    for r in results:
        url = r.get("url", "")
        title = r.get("title", "Untitled")
        if not url:
            continue
        all_urls.add(url)
        if url not in known_urls:
            new_papers.append(r)
    
    # Update state
    state["known_urls"] = list(known_urls | all_urls)
    state["total_seen"] = len(state["known_urls"])
    save_state(topic, state)
    
    return new_papers


def format_alert(new_papers: list[dict], topic: str) -> str:
    """Format new papers into an alert message."""
    if not new_papers:
        return f"✅ No new papers found for '{topic}'."
    
    lines = [
        f"📚 *New Research Alert: {topic}*",
        f"Found {len(new_papers)} new paper(s) since last check.",
        "",
    ]
    
    for i, p in enumerate(new_papers, 1):
        title = p.get("title", "Untitled")
        authors = p.get("authors", [])
        year = p.get("year", "")
        source = p.get("source", "")
        url = p.get("url", "")
        
        author_str = ", ".join(authors[:3]) if authors else "Unknown"
        if len(authors) > 3:
            author_str += " et al."
        
        lines.append(f"  {i}. **{title}**")
        lines.append(f"     {author_str} ({year}) [{source}]")
        if url:
            lines.append(f"     {url}")
        lines.append("")
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="ScholarSift Research Alert — detect new papers on a topic"
    )
    parser.add_argument("topic", help="Search topic to monitor")
    parser.add_argument("--token", default="", help="ScholarSift API token (optional for public search)")
    parser.add_argument("--api-base", default="http://localhost:8000", help="ScholarSift API base URL")
    parser.add_argument("--output-json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    new_papers = []
    try:
        import asyncio
        new_papers = asyncio.run(check_topic(args.topic, args.token, args.api_base))
    except Exception as e:
        print(f"Error checking topic '{args.topic}': {e}")
        sys.exit(1)

    if args.output_json:
        print(json.dumps({"topic": args.topic, "new_papers": new_papers, "count": len(new_papers)}, indent=2))
    else:
        print(format_alert(new_papers, args.topic))


if __name__ == "__main__":
    main()
