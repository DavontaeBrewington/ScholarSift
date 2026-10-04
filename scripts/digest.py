#!/usr/bin/env python3
"""
Daily Research Digest — ScholarSift

Usage:
    python scripts/digest.py --query "quantum computing" [--max-results 10] [--format text|markdown]

Generates a research digest for a saved search query by calling the search API
and formatting the results. Designed to be invoked by cron.

Example crontab entry (run daily at 8 AM):
    0 8 * * * cd /path/to/scholarly_app && venv/bin/python scripts/digest.py --query="machine learning" --format=markdown | mail -s "Daily Research Digest: ML" you@example.com
"""

import argparse
import json
import sys
import urllib.request
import urllib.parse
from datetime import datetime


def fetch_results(query: str, max_results: int = 10) -> list[dict]:
    """Call the ScholarSift search API and return results."""
    params = urllib.parse.urlencode({"q": query, "max_results": max_results})
    url = f"http://localhost:8001/api/search?{params}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            return data.get("results", [])
    except Exception as e:
        print(f"[digest] Error fetching results: {e}", file=sys.stderr)
        return []


def format_text_digest(query: str, results: list[dict]) -> str:
    """Format results as a plain-text digest."""
    lines = []
    lines.append("=" * 60)
    lines.append(f"DAILY RESEARCH DIGEST: {query}")
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"Results: {len(results)} paper(s)")
    lines.append("=" * 60)
    lines.append("")

    if not results:
        lines.append("No new results found.")
        return "\n".join(lines)

    for i, r in enumerate(results, 1):
        authors = ", ".join(r.get("authors", [])[:3])
        if len(r.get("authors", [])) > 3:
            authors += " et al."
        year = r.get("year", "n.d.")
        source = r.get("source", "Unknown")
        title = r.get("title", "Untitled")
        abstract = (r.get("abstract") or "")[:200]
        citations = r.get("citation_count")
        url = r.get("url", "")

        lines.append(f"{i}. {title}")
        lines.append(f"   Authors: {authors or 'Unknown'}")
        lines.append(f"   Year: {year}  |  Source: {source}")
        if citations is not None:
            lines.append(f"   Citations: {citations}")
        if abstract:
            lines.append(f"   Abstract: {abstract}...")
        if url:
            lines.append(f"   URL: {url}")
        lines.append("")

    lines.append("-" * 60)
    lines.append("End of digest.")
    return "\n".join(lines)


def format_markdown_digest(query: str, results: list[dict]) -> str:
    """Format results as a Markdown digest."""
    lines = []
    lines.append(f"# Daily Research Digest: {query}")
    lines.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    lines.append(f"**{len(results)} paper(s) found**")
    lines.append("")

    if not results:
        lines.append("*No new results found.*")
        return "\n".join(lines)

    for i, r in enumerate(results, 1):
        authors = ", ".join(r.get("authors", [])[:3])
        if len(r.get("authors", [])) > 3:
            authors += " et al."
        year = r.get("year", "n.d.")
        source = r.get("source", "Unknown")
        title = r.get("title", "Untitled")
        abstract = (r.get("abstract") or "")[:200]
        citations = r.get("citation_count")
        url = r.get("url", "")

        lines.append(f"## {i}. {title}")
        lines.append(f"**Authors:** {authors or 'Unknown'}  ")
        lines.append(f"**Year:** {year}  |  **Source:** {source}  ")
        if citations is not None:
            lines.append(f"**Citations:** {citations}  ")
        if abstract:
            lines.append(f"\n{abstract}...")
        if url:
            lines.append(f"\n[🔗 View paper]({url})")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate a daily research digest")
    parser.add_argument("--query", "-q", required=True, help="Search query for the digest")
    parser.add_argument("--max-results", "-n", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--format", "-f", choices=["text", "markdown"], default="text", help="Output format (default: text)")
    args = parser.parse_args()

    results = fetch_results(args.query, args.max_results)

    if args.format == "markdown":
        output = format_markdown_digest(args.query, results)
    else:
        output = format_text_digest(args.query, results)

    print(output)


if __name__ == "__main__":
    main()
