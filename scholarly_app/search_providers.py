"""Search providers for scholarly sources: arXiv, Semantic Scholar, Open Library, Google Books, CrossRef."""
import asyncio
import re
import time
import xml.etree.ElementTree as ET
import urllib.parse
import httpx

ARXIV_API = "https://export.arxiv.org/api/query"
SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search"
SEMANTIC_SCHOLAR_REC_API = "https://api.semanticscholar.org/graph/v1/recommendations/v1/papers"
OPEN_LIBRARY_API = "https://openlibrary.org/search.json"
CROSSREF_API = "https://api.crossref.org/works"
OPENALEX_API = "https://api.openalex.org"

# ── Search cache (TTL in seconds) ────────────────────────────────────
CACHE_TTL = 300  # 5 minutes
_cache: dict[str, tuple[float, list[dict]]] = {}


def _cache_get(key: str) -> list[dict] | None:
    entry = _cache.get(key)
    if not entry:
        return None
    ts, results = entry
    if time.time() - ts > CACHE_TTL:
        _cache.pop(key, None)
        return None
    return results


def _cache_set(key: str, results: list[dict]) -> None:
    # Keep the cache bounded; drop oldest when over ~256 entries
    if len(_cache) > 256:
        oldest = min(_cache, key=lambda k: _cache[k][0])
        _cache.pop(oldest, None)
    _cache[key] = (time.time(), results)


def _cache_key(provider: str, query: str, max_results: int) -> str:
    return f"{provider}:{query.strip().lower()}:{max_results}"


def _normalize_title(title: str) -> str:
    """Normalize a title for fuzzy dedupe: lowercase, strip punctuation/diacritics-ish."""
    if not title:
        return ""
    t = title.lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _title_words(title: str) -> set[str]:
    return set(_normalize_title(title).split())


def _doi_of(r: dict) -> str:
    """Extract a DOI-ish key from a result dict, normalized."""
    raw = r.get("doi") or r.get("DOI") or ""
    if not raw:
        url = r.get("url") or ""
        if "doi.org/" in url:
            raw = url.split("doi.org/")[-1]
    return raw.strip().lower().lstrip("https://doi.org/").strip()


def merge_unique(results_lists: list[list[dict]]) -> list[dict]:
    """Deduplicate across providers by DOI when available, else fuzzy title.

    Returns merged results, keeping the richest record for each paper.
    """
    seen_dois: dict[str, dict] = {}
    seen_norm: dict[str, dict] = {}

    def richer(a: dict, b: dict) -> dict:
        """Merge two records for the same paper, preferring non-empty fields."""
        out = dict(b)
        for k, v in a.items():
            if not out.get(k) and v:
                out[k] = v
        # Prefer citation_count from either, taking the max
        ca = a.get("citation_count")
        cb = b.get("citation_count")
        if ca is not None and (cb is None or ca > cb):
            out["citation_count"] = ca
        # Prefer openalex_id / arxiv_id from either
        for k in ("openalex_id", "arxiv_id", "pdf_url", "url"):
            if not out.get(k) and a.get(k):
                out[k] = a[k]
        return out

    merged: list[dict] = []
    for lst in results_lists:
        for r in lst:
            doi = _doi_of(r)
            if doi:
                if doi in seen_dois:
                    seen_dois[doi] = richer(r, seen_dois[doi])
                    continue
                seen_dois[doi] = r
                merged.append(r)
                continue
            norm = _normalize_title(r.get("title", ""))
            if len(norm) >= 6:  # only trust normalized titles long enough to be meaningful
                if norm in seen_norm:
                    seen_norm[norm] = richer(r, seen_norm[norm])
                    continue
                seen_norm[norm] = r
            merged.append(r)
    return merged


def _relevance_score(query: str, r: dict) -> float:
    """Compute a simple relevance score for a result against a query.

    Boosts: exact title match > title contains any query word > abstract
    contains any query word. Adds small citation & recency bonuses.
    """
    q = query.lower().strip()
    raw_title = (r.get("title") or "").lower()
    abstract = (r.get("abstract") or "").lower()
    title_norm = _normalize_title(raw_title)
    q_words = [w for w in _normalize_title(q).split() if len(w) > 2]

    score = 0.0
    if title_norm == _normalize_title(q):
        score += 100.0
    for w in q_words:
        if w in title_norm:
            score += 5.0
        elif w in abstract:
            score += 2.0
    # Small citation bonus (log scale, capped)
    cit = r.get("citation_count") or 0
    if cit:
        score += min(8.0, (cit ** 0.3) * 0.5)
    # Small recency bonus
    try:
        yr = int(r.get("year") or 0)
        score += max(0.0, (yr - 2000) / 100.0)
    except (TypeError, ValueError):
        pass
    return score


def sort_by_relevance(query: str, results: list[dict]) -> list[dict]:
    """Sort results by relevance to the query (descending)."""
    scored = [(r, _relevance_score(query, r)) for r in results]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [r for r, _ in scored]


async def search_arxiv(query: str, max_results: int = 10) -> list[dict]:
    """Search arXiv papers. Properly encodes query."""
    ck = _cache_key("arxiv", query, max_results)
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    encoded = urllib.parse.quote(query.replace(" ", "+"))
    url = f"{ARXIV_API}?search_query=all:{encoded}&max_results={max_results}&sortBy=relevance"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as e:
        print(f"[arXiv] error: {e}")
        return []

    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(resp.text)
    except Exception as e:
        print(f"[arXiv] parse error: {e}")
        return []

    results = []
    for entry in root.findall("a:entry", ns):
        title_el = entry.find("a:title", ns)
        if title_el is None:
            continue
        title = title_el.text.strip().replace("\n", " ")
        arxiv_id = entry.find("a:id", ns).text.strip().split("/abs/")[-1]
        published = entry.find("a:published", ns).text[:10]
        year = published[:4]
        authors = [a.find("a:name", ns).text for a in entry.findall("a:author", ns)]
        summary_el = entry.find("a:summary", ns)
        summary = summary_el.text.strip().replace("\n", " ") if summary_el is not None else ""
        if len(summary) > 350:
            summary = summary[:350] + "..."
        results.append({
            "title": title,
            "authors": authors,
            "year": year,
            "abstract": summary,
            "url": f"https://arxiv.org/abs/{arxiv_id}",
            "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}",
            "source": "arXiv",
            "type": "paper",
        })
    _cache_set(ck, results)
    return results


async def search_semantic_scholar(query: str, max_results: int = 10) -> list[dict]:
    """Search Semantic Scholar. Respects rate limits."""
    ck = _cache_key("semantic", query, max_results)
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    url = f"{SEMANTIC_SCHOLAR_API}?query={urllib.parse.quote(query)}&limit={max_results}&fields=title,authors,year,abstract,externalIds,openAccessPdf,citationCount,url,tldr,venue"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 429:
                print("[Semantic Scholar] rate limited, skipping")
                return []
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[Semantic Scholar] error: {e}")
        return []

    results = []
    for paper in data.get("data", []):
        authors = [a["name"] for a in paper.get("authors", []) if a.get("name")]
        ext_ids = paper.get("externalIds", {}) or {}
        abstract = paper.get("abstract") or ""
        if len(abstract) > 350:
            abstract = abstract[:350] + "..."
        doi = ext_ids.get("DOI", "")
        tldr_obj = paper.get("tldr") or {}
        tldr_text = tldr_obj.get("text", "") if isinstance(tldr_obj, dict) else ""
        venue = paper.get("venue") or ""
        results.append({
            "title": paper.get("title", "Untitled"),
            "authors": authors,
            "year": str(paper.get("year", "")) if paper.get("year") else "",
            "abstract": abstract,
            "tldr_text": tldr_text,
            "url": paper.get("url") or (f"https://doi.org/{doi}" if doi else ""),
            "pdf_url": paper.get("openAccessPdf", {}).get("url") if paper.get("openAccessPdf") else None,
            "source": "Semantic Scholar",
            "type": "paper",
            "citation_count": paper.get("citationCount"),
            "arxiv_id": ext_ids.get("arXiv"),
            "venue": venue,
            "doi": doi,
        })
    _cache_set(ck, results)
    return results


async def semantic_recommendations(paper_ids: list[str], max_results: int = 10) -> list[dict]:
    """Get Semantic Scholar recommendations for a set of seed paper IDs."""
    if not paper_ids:
        return []
    ids = ",".join(paper_ids[:3])
    url = f"{SEMANTIC_SCHOLAR_REC_API}?paperId={ids}&limit={max_results}&fields=title,authors,year,abstract,externalIds,openAccessPdf,citationCount,url,venue"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url)
            if resp.status_code == 429:
                print("[Semantic Scholar] rec rate limited, skipping")
                return []
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[Semantic Scholar] rec error: {e}")
        return []

    results = []
    for paper in data.get("recommendedPapers", []):
        authors = [a["name"] for a in paper.get("authors", []) if a.get("name")]
        ext_ids = paper.get("externalIds", {}) or {}
        doi = ext_ids.get("DOI", "")
        abstract = paper.get("abstract") or ""
        if len(abstract) > 350:
            abstract = abstract[:350] + "..."
        venue = paper.get("venue") or ""
        results.append({
            "title": paper.get("title", "Untitled"),
            "authors": authors,
            "year": str(paper.get("year", "")) if paper.get("year") else "",
            "abstract": abstract,
            "url": paper.get("url") or (f"https://doi.org/{doi}" if doi else ""),
            "pdf_url": paper.get("openAccessPdf", {}).get("url") if paper.get("openAccessPdf") else None,
            "source": "Semantic Scholar",
            "type": "paper",
            "citation_count": paper.get("citationCount"),
            "arxiv_id": ext_ids.get("arXiv"),
            "venue": venue,
            "doi": doi,
        })
    _cache_set(ck, results)
    return results


async def search_openlibrary(query: str, max_results: int = 10) -> list[dict]:
    """Search Open Library for books."""
    ck = _cache_key("openlibrary", query, max_results)
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    url = f"{OPEN_LIBRARY_API}?q={urllib.parse.quote(query)}&limit={max_results}&fields=key,title,author_name,first_publish_year,subject,id_goodreads,isbn"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[Open Library] error: {e}")
        return []

    results = []
    for doc in data.get("docs", []):
        authors = doc.get("author_name", [])
        subjects = doc.get("subject", [])[:5]
        results.append({
            "title": doc.get("title", "Untitled"),
            "authors": authors,
            "year": str(doc.get("first_publish_year", "")) if doc.get("first_publish_year") else "",
            "abstract": f"Subjects: {', '.join(subjects)}" if subjects else "No description available.",
            "url": doc.get("key", "") and f"https://openlibrary.org{doc['key']}" or "",
            "source": "Open Library",
            "type": "book",
            "subjects": subjects,
        })
    _cache_set(ck, results)
    return results


async def search_wikipedia(query: str) -> dict | None:
    """Fetch Wikipedia summary for a query. Returns None if not found."""
    import urllib.parse
    encoded = urllib.parse.quote(query.replace(" ", "_"))
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            if data.get("type") == "disambiguation" or not data.get("extract"):
                return None
            return {
                "title": data.get("title", ""),
                "extract": data.get("extract", ""),
                "thumbnail": data.get("thumbnail", {}).get("source") if data.get("thumbnail") else None,
                "url": data.get("content_urls", {}).get("desktop", {}).get("page", f"https://en.wikipedia.org/wiki/{encoded}"),
            }
    except Exception as e:
        print(f"[Wikipedia] error: {e}")
        return None


async def search_openalex(query: str, max_results: int = 10) -> list[dict]:
    """Search OpenAlex for scholarly works."""
    ck = _cache_key("openalex", query, max_results)
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    url = f"{OPENALEX_API}/works?search={urllib.parse.quote(query)}&per_page={max_results}&sort=relevance_score:desc"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[OpenAlex] error: {e}")
        return []

    results = []
    for work in data.get("results", []):
        title = work.get("title", "Untitled")
        if not title:
            continue
        authors = [
            a.get("author", {}).get("display_name", "Unknown")
            for a in work.get("authorships", [])
            if a.get("author")
        ]
        year = str(work.get("publication_year", "")) if work.get("publication_year") else ""
        abstract = (work.get("abstract_inverted_index") and " ".join(
            sorted(work["abstract_inverted_index"].keys(),
                   key=lambda k, w=work: w["abstract_inverted_index"][k][0])
        )) or ""
        if len(abstract) > 350:
            abstract = abstract[:350] + "..."
        doi = work.get("doi", "") or ""
        oa_location = work.get("best_oa_location") or {}
        concepts = [
            {"name": c.get("display_name", ""), "score": c.get("score", 0)}
            for c in work.get("concepts", []) if c.get("display_name")
        ]
        results.append({
            "title": title,
            "authors": authors,
            "year": year,
            "abstract": abstract,
            "url": f"https://doi.org/{doi}" if doi else "",
            "pdf_url": oa_location.get("pdf_url"),
            "source": "OpenAlex",
            "type": "paper",
            "citation_count": work.get("cited_by_count", 0),
            "open_access_pdf": oa_location.get("pdf_url"),
            "concepts": concepts,
            "openalex_id": work.get("id", ""),
            "venue": ((work.get("primary_location") or {}).get("source") or {}).get("display_name") if work.get("primary_location") else "",
            "doi": doi,
        })
    _cache_set(ck, results)
    return results


async def search_all(query: str, max_results: int = 10) -> tuple[list[dict], dict]:
    """Search all providers in parallel, merge results.

    Returns (results, provider_status) where provider_status maps source name
    to a status string: 'ok', 'empty', 'error', or 'rate-limited'.
    """
    async def run_providers():
        arxiv_task = search_arxiv(query, max_results)
        ss_task = search_semantic_scholar(query, max_results)
        ol_task = search_openlibrary(query, max_results)
        cr_task = search_crossref(query, max_results)
        oa_task = search_openalex(query, max_results)
        return await asyncio.gather(arxiv_task, ss_task, ol_task, cr_task, oa_task)

    arxiv_results, ss_results, ol_results, cr_results, oa_results = await run_providers()

    # Provider status: how many responded with data
    provider_status = {
        "arXiv": "ok" if arxiv_results else "empty",
        "Semantic Scholar": "ok" if ss_results else "empty",
        "Open Library": "ok" if ol_results else "empty",
        "CrossRef": "ok" if cr_results else "empty",
        "OpenAlex": "ok" if oa_results else "empty",
    }

    # Deduplicate by DOI when possible, else fuzzy title
    merged = merge_unique([arxiv_results, ss_results, ol_results, cr_results, oa_results])

    # Sort: citations first, then year (newer first)
    def sort_key(r):
        citations = r.get("citation_count") or 0
        year = r.get("year") or "0"
        try:
            year_int = int(year)
        except ValueError:
            year_int = 0
        return (-citations, -year_int)

    merged.sort(key=sort_key)
    return merged[:max_results * 2], provider_status


async def search_crossref(query: str, max_results: int = 10) -> list[dict]:
    """Search CrossRef for journal articles, books, chapters."""
    ck = _cache_key("crossref", query, max_results)
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    url = f"{CROSSREF_API}?query={urllib.parse.quote(query)}&rows={max_results * 2}&mailto=scholarsift@demo.dev"
    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "ScholarSift/1.0"}) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[CrossRef] error: {e}")
        return []

    results = []
    items = data.get("message", {}).get("items", [])
    for item in items:
        title = (item.get("title") or ["Untitled"])[0]

        # Skip noisy CrossRef items: titles that are just numbers, single chars, or very short
        clean_title = title.strip()
        if clean_title.isdigit() or len(clean_title) <= 2:
            continue
        authors = [
            f"{a.get('given', '')} {a.get('family', '')}".strip()
            for a in item.get("author", [])
        ]
        year = ""
        if item.get("published-print"):
            year = str(item["published-print"].get("date-parts", [[0]])[0][0])
        elif item.get("published-online"):
            year = str(item["published-online"].get("date-parts", [[0]])[0][0])
        elif item.get("created"):
            year = str(item["created"].get("date-parts", [[0]])[0][0])

        abstract = item.get("abstract", "") or ""
        # CrossRef abstracts often have HTML/XML tags
        if abstract:
            abstract = abstract.replace("<jats:p>", "").replace("</jats:p>", " ").replace("<jats:italic>", "").replace("</jats:italic>", "")
            if len(abstract) > 350:
                abstract = abstract[:350] + "..."

        doi = item.get("DOI", "")
        url_link = f"https://doi.org/{doi}" if doi else ""
        container = item.get("container-title", [""])[0] if item.get("container-title") else ""
        type_label = item.get("type", "article").replace("-", " ").title()

        results.append({
            "title": title,
            "authors": authors,
            "year": year,
            "abstract": abstract or f"Published in {container}" if container else "No description available.",
            "url": url_link,
            "pdf_url": None,
            "source": "CrossRef",
            "type": type_label,
            "citation_count": item.get("is-referenced-by-count", 0),
            "publisher": item.get("publisher", ""),
            "container": container,
            "doi": doi,
        })
    _cache_set(ck, results)
    return results
