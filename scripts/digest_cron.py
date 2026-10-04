#!/usr/bin/env python3
"""
ScholarSift Weekly Digest Cron Script.

Usage:
    python digest_cron.py "saved query string"
    
Or from cron:
    0 9 * * 1 cd /home/ubuntu/scholarly_app && venv/bin/python scripts/digest_cron.py "quantum machine learning" >> /tmp/digest_output.txt

Takes a saved query as argument, calls arXiv API for recent papers,
formats a text digest with newest papers first, prints to stdout.
"""

import sys
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Optional

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Install with: pip install httpx")
    sys.exit(1)


ARXIV_API = "https://export.arxiv.org/api/query"
WEEK_DAYS = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday",
             4: "Friday", 5: "Saturday", 6: "Sunday"}


def fetch_arxiv(query: str, max_results: int = 20) -> list[dict]:
    """Fetch recent papers from arXiv matching the query."""
    encoded = urllib.parse.quote(query.replace(" ", "+"))
    # Sort by submittedDate descending to get newest first
    url = (
        f"{ARXIV_API}?search_query=all:{encoded}"
        f"&sortBy=submittedDate&sortOrder=descending"
        f"&max_results={max_results}"
    )
    headers = {
        "User-Agent": "ScholarSift/2.0 (weekly digest bot; mailto:scholarsift@demo.dev)",
        "Accept": "application/xml",
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"[ERROR] arXiv request failed: {e}", file=sys.stderr)
        return []

    papers = []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(resp.text)
    except Exception as e:
        print(f"[ERROR] arXiv XML parse failed: {e}", file=sys.stderr)
        return []

    for entry in root.findall("a:entry", ns):
        title_el = entry.find("a:title", ns)
        if title_el is None:
            continue
        title = title_el.text.strip().replace("\n", " ")

        arxiv_id = ""
        id_el = entry.find("a:id", ns)
        if id_el is not None:
            id_match = re.search(r"/abs/(\d+\.\d+)", id_el.text)
            if id_match:
                arxiv_id = id_match.group(1)

        published_el = entry.find("a:published", ns)
        published = published_el.text[:10] if published_el is not None else ""

        authors = []
        for a in entry.findall("a:author", ns):
            name_el = a.find("a:name", ns)
            if name_el is not None:
                authors.append(name_el.text)

        summary_el = entry.find("a:summary", ns)
        abstract = summary_el.text.strip().replace("\n", " ") if summary_el is not None else ""
        if len(abstract) > 400:
            abstract = abstract[:400] + "..."

        papers.append({
            "title": title,
            "authors": authors,
            "published": published,
            "year": published[:4],
            "abstract": abstract,
            "arxiv_id": arxiv_id,
            "url": f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else "",
            "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}" if arxiv_id else "",
        })

    # Already sorted by submittedDate descending from API, but double-check
    papers.sort(key=lambda p: p["published"], reverse=True)
    return papers


def format_digest(query: str, papers: list[dict]) -> str:
    """Format papers into a plain-text digest, newest first."""
    today = datetime.now().strftime("%Y-%m-%d")
    weekday = WEEK_DAYS.get(datetime.now().weekday(), "Unknown")

    lines = []
    lines.append("=" * 72)
    lines.append(f"  ScholarSift Weekly Digest")
    lines.append(f"  Query: {query}")
    lines.append(f"  Generated: {today} ({weekday})")
    lines.append("=" * 72)
    lines.append("")

    if not papers:
        lines.append(f"No papers found for: {query}")
        lines.append("Try a different query or check back next week.")
        return "\n".join(lines)

    lines.append(f"Found {len(papers)} paper(s) — newest first:")
    lines.append("")

    for i, p in enumerate(papers, 1):
        lines.append(f"─── [{i:02d}] {'─' * 62}")
        lines.append(f"  Title:   {p['title']}")
        lines.append(f"  Authors: {', '.join(p['authors'][:5])}{' et al.' if len(p['authors']) > 5 else ''}")
        lines.append(f"  Date:    {p['published']}  |  Year: {p['year']}")
        lines.append(f"  arXiv:   {p['url']}")
        if p.get('pdf_url'):
            lines.append(f"  PDF:     {p['pdf_url']}")
        if p.get('abstract'):
            # Truncate abstracts for digest readability
            abstract = p['abstract']
            if len(abstract) > 300:
                abstract = abstract[:300] + "..."
            lines.append(f"")
            lines.append(f"  Abstract:")
            # Word-wrap the abstract
            words = abstract.split()
            wrapped = []
            line = ""
            for word in words:
                if len(line) + len(word) + 1 > 68:
                    wrapped.append(line)
                    line = "    " + word
                else:
                    line = (line + " " + word) if line else "    " + word
            if line:
                wrapped.append(line)
            for wl in wrapped:
                lines.append(wl)
        lines.append("")

    lines.append("─" * 72)
    lines.append("  Powered by arXiv.org | ScholarSift Academic Dashboard")
    lines.append(f"  Generated {today}")
    lines.append("=" * 72)

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python digest_cron.py <saved_query>")
        print("       python digest_cron.py \"machine learning transformers\"")
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    papers = fetch_arxiv(query, max_results=20)
    digest = format_digest(query, papers)
    print(digest)


if __name__ == "__main__":
    main()
