"""Scholarly Research Dashboard — FastAPI backend."""

import os
import json
import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import urllib.parse
import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()  # loads OPENAI_API_KEY, OPENAI_BASE_URL, etc. from .env
except ImportError:
    pass  # optional: dotenv not installed; rely on real environment vars

from .search_providers import search_all, semantic_recommendations
from .topic_extractor import extract_topics
from .refine_helpers import refine_phrase_to_query, wikipedia_first_sentence
from .auth import hash_password, verify_password, create_token, decode_token
from fastapi.responses import FileResponse, StreamingResponse
from fastapi import WebSocket, WebSocketDisconnect
import io
import tempfile

DB_PATH = os.path.join(os.path.dirname(__file__), "scholarsift.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def get_db():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database from schema.sql."""
    conn = get_db()
    try:
        with open(SCHEMA_PATH) as f:
            conn.executescript(f.read())
        conn.commit()
    finally:
        conn.close()


async def get_user_from_token(authorization: str = Header(None)) -> dict:
    """Extract user info from Authorization header. Raises 401 if invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle handler: init DB on startup."""
    init_db()
    print(f"[ScholarSift] Database initialized at {DB_PATH}")
    yield


app = FastAPI(title="Scholarly Research Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchResponse(BaseModel):
    query: str
    results: list[dict]
    topics: list[dict]
    total_results: int
    provider_status: dict = {}  # which providers responded vs were rate-limited/empty


# ─── Auth Endpoints ────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str
    username: str


class UserInfo(BaseModel):
    username: str
    created_at: str


@app.post("/api/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    conn = get_db()
    try:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (req.username,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")
        pw_hash = hash_password(req.password)
        cur = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (req.username, pw_hash),
        )
        conn.commit()
        token = create_token(req.username)
        return TokenResponse(token=token, username=req.username)
    finally:
        conn.close()


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (req.username,)
        ).fetchone()
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        token = create_token(req.username)
        return TokenResponse(token=token, username=req.username)
    finally:
        conn.close()


@app.get("/api/auth/me", response_model=UserInfo)
async def me(payload: dict = __import__("fastapi").Depends(get_user_from_token)):
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT username, created_at FROM users WHERE username = ?",
            (payload["username"],),
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserInfo(username=user["username"], created_at=user["created_at"])
    finally:
        conn.close()


# ─── Sync Endpoints ────────────────────────────────────────────────


class SyncBookmarksRequest(BaseModel):
    token: str
    bookmarks: list[dict]


class SyncCollectionsRequest(BaseModel):
    token: str
    collections: list[dict]


@app.post("/api/sync/bookmarks")
async def sync_bookmarks(req: SyncBookmarksRequest):
    payload = decode_token(req.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    conn = get_db()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (payload["username"],)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["id"]
        # Clear existing bookmarks for this user, then insert all
        conn.execute("DELETE FROM bookmarks WHERE user_id = ?", (user_id,))
        for bm in req.bookmarks:
            conn.execute(
                "INSERT INTO bookmarks (user_id, url, title, year, authors, source) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    user_id,
                    bm.get("url", ""),
                    bm.get("title", ""),
                    bm.get("year", ""),
                    json.dumps(bm.get("authors", [])),
                    bm.get("source", ""),
                ),
            )
        conn.commit()
        return {"status": "ok", "count": len(req.bookmarks)}
    finally:
        conn.close()


@app.get("/api/sync/bookmarks")
async def get_bookmarks(token: str = Query(...)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    conn = get_db()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (payload["username"],)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        rows = conn.execute(
            "SELECT url, title, year, authors, source FROM bookmarks WHERE user_id = ?",
            (user["id"],),
        ).fetchall()
        bookmarks = []
        for row in rows:
            authors_raw = row["authors"]
            try:
                authors = json.loads(authors_raw) if authors_raw else []
            except (json.JSONDecodeError, TypeError):
                authors = []
            bookmarks.append(
                {
                    "url": row["url"],
                    "title": row["title"],
                    "year": row["year"],
                    "authors": authors,
                    "source": row["source"],
                }
            )
        return {"bookmarks": bookmarks}
    finally:
        conn.close()


@app.post("/api/sync/collections")
async def sync_collections(req: SyncCollectionsRequest):
    payload = decode_token(req.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    conn = get_db()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (payload["username"],)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["id"]
        # Clear existing collections (cascade deletes papers)
        conn.execute("DELETE FROM collections WHERE user_id = ?", (user_id,))
        for col in req.collections:
            cur = conn.execute(
                "INSERT INTO collections (user_id, name) VALUES (?, ?)",
                (user_id, col.get("name", "Untitled")),
            )
            collection_id = cur.lastrowid
            for paper in col.get("papers", []):
                conn.execute(
                    "INSERT INTO collection_papers (collection_id, url, title, year, authors, source) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        collection_id,
                        paper.get("url", ""),
                        paper.get("title", ""),
                        paper.get("year", ""),
                        json.dumps(paper.get("authors", [])),
                        paper.get("source", ""),
                    ),
                )
        conn.commit()
        return {"status": "ok", "count": len(req.collections)}
    finally:
        conn.close()


@app.get("/api/sync/collections")
async def get_collections(token: str = Query(...)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    conn = get_db()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (payload["username"],)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["id"]
        col_rows = conn.execute(
            "SELECT id, name, created_at FROM collections WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        collections = []
        for col in col_rows:
            paper_rows = conn.execute(
                "SELECT url, title, year, authors, source FROM collection_papers WHERE collection_id = ?",
                (col["id"],),
            ).fetchall()
            papers = []
            for p in paper_rows:
                authors_raw = p["authors"]
                try:
                    authors = json.loads(authors_raw) if authors_raw else []
                except (json.JSONDecodeError, TypeError):
                    authors = []
                papers.append(
                    {
                        "url": p["url"],
                        "title": p["title"],
                        "year": p["year"],
                        "authors": authors,
                        "source": p["source"],
                    }
                )
            collections.append(
                {
                    "id": col["id"],
                    "name": col["name"],
                    "created_at": col["created_at"],
                    "papers": papers,
                }
            )
        return {"collections": collections}
    finally:
        conn.close()


# ─── Trending Papers Discovery Feed ────────────────────────────────


class TrendingPaper(BaseModel):
    title: str
    authors: list[str]
    abstract: str
    year: str
    source: str
    url: str
    arxiv_id: str | None = None
    citation_count: int | None = None


@app.get("/api/trending")
async def trending(max_results: int = Query(20, ge=1, le=50)):
    """Fetch recent papers from arXiv in AI/NLP/ML."""
    search_query = "cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG"
    url = (
        f"https://export.arxiv.org/api/query"
        f"?search_query={search_query}"
        f"&sortBy=submittedDate&sortOrder=descending"
        f"&max_results={max_results}"
    )
    headers = {
        "User-Agent": "ScholarSift/2.0 (trending feed; mailto:scholarsift@demo.dev)",
        "Accept": "application/xml",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            xml_text = resp.text
    except Exception as e:
        print(f"[Trending] arXiv fetch error: {e}")
        return {"results": []}

    # Parse arXiv Atom XML
    import re
    results = []
    entries = re.split(r"<entry[^>]*>", xml_text)[1:]  # drop everything before first entry
    for entry in entries:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", entry, re.DOTALL)
        title = title_match.group(1).strip() if title_match else "Untitled"
        # Clean up arXiv title
        title = re.sub(r"\s+", " ", title)
        title = re.sub(r"\n", "", title)

        # Abstract
        abstract_match = re.search(r"<summary[^>]*>(.*?)</summary>", entry, re.DOTALL)
        abstract = abstract_match.group(1).strip() if abstract_match else ""

        # URL / arXiv ID
        id_match = re.search(r"<id[^>]*>(.*?)</id>", entry, re.DOTALL)
        arxiv_url = id_match.group(1).strip() if id_match else ""
        arxiv_id = ""
        if arxiv_url:
            arxiv_id_match = re.search(r"/abs/(\d+\.\d+)", arxiv_url)
            if arxiv_id_match:
                arxiv_id = arxiv_id_match.group(1)

        # Authors
        authors = [a.strip() for a in re.findall(r"<author[^>]*>.*?<name[^>]*>(.*?)</name>.*?</author>", entry, re.DOTALL)]

        # Year from published date
        published_match = re.search(r"<published[^>]*>(.*?)</published>", entry, re.DOTALL)
        year = ""
        if published_match:
            year_match = re.search(r"(\d{4})", published_match.group(1))
            if year_match:
                year = year_match.group(1)

        source = "arXiv"
        results.append({
            "title": title,
            "authors": authors,
            "abstract": abstract[:500] if abstract else "",
            "year": year,
            "source": source,
            "url": arxiv_url,
            "arxiv_id": arxiv_id,
        })

    return {"results": results}


# ─── AI Topic Graph ────────────────────────────────────────────────


@app.get("/api/topic-graph")
async def topic_graph(q: str = Query(..., description="Search query")):
    """Build a topic graph by querying OpenAlex concepts and extracting keyword pairs from abstracts."""
    import re
    from collections import Counter

    nodes = []
    edges = []
    # Center node = the query
    center_id = "query"
    nodes.append({"id": center_id, "label": q, "size": 30})

    # Try OpenAlex concepts API
    try:
        alex_url = f"https://api.openalex.org/autocomplete/concepts?q={urllib.parse.quote(q)}"
        async with httpx.AsyncClient(timeout=10) as client:
            alex_resp = await client.get(alex_url)
            if alex_resp.status_code == 200:
                alex_data = alex_resp.json()
                concepts = (alex_data.get("results", []) or [])[:12]
                for i, c in enumerate(concepts):
                    cid = f"concept_{i}"
                    display = c.get("display_name", c.get("label", "Unknown"))
                    nodes.append({"id": cid, "label": display, "size": 12 + int(c.get("score", 20) * 0.1)})
                    edges.append({"source": center_id, "target": cid})
                if nodes:
                    return {"nodes": nodes, "edges": edges}
    except Exception as e:
        print(f"[TopicGraph] OpenAlex error: {e}")

    # Fallback: extract keyword pairs from result abstracts
    try:
        results, _ = await search_all(q, max_results=15)
    except Exception:
        results, _ = [], {}

    results = results or []
    if not results:
        # Return just the center node
        return {"nodes": nodes, "edges": edges}

    # Collect all words from titles + abstracts
    stopwords = {"the", "a", "an", "and", "or", "in", "on", "at", "of", "to", "for",
                 "with", "by", "is", "are", "was", "were", "this", "that", "from",
                 "as", "be", "it", "its", "not", "we", "has", "have", "been", "can",
                 "may", "also", "how", "what", "who", "which", "their", "our", "about",
                 "new", "study", "studies", "results", "method", "paper", "data"}
    word_pairs = Counter()
    for r in results:
        text = (r.get("title", "") + " " + (r.get("abstract", "") or ""))
        words = re.findall(r"[A-Za-z][a-zA-Z]{3,}", text)
        words = [w.lower() for w in words if w.lower() not in stopwords and len(w) > 2]
        # Count top bigrams (co-occurring keywords)
        seen = set()
        for i in range(len(words) - 1):
            pair = (words[i], words[i+1])
            if pair not in seen:
                word_pairs[pair] += 1
                seen.add(pair)

    # Extract top keywords by frequency
    word_freq = Counter()
    for (w1, w2), count in word_pairs.items():
        word_freq[w1] += count
        word_freq[w2] += count

    top_keywords = [w for w, _ in word_freq.most_common(10) if w.lower() != q.lower()][:10]
    connected = set()
    for i, kw in enumerate(top_keywords):
        kid = f"keyword_{i}"
        nodes.append({"id": kid, "label": kw.capitalize(), "size": 10 + word_freq[kw]})
        edges.append({"source": center_id, "target": kid})
        connected.add(kid)

    # Add edges between keywords that appear together
    kid_map = {kw.capitalize(): f"keyword_{i}" for i, kw in enumerate(top_keywords)}
    for (w1, w2), count in word_pairs.most_common(20):
        k1 = w1.capitalize()
        k2 = w2.capitalize()
        if k1 in kid_map and k2 in kid_map and kid_map[k1] != kid_map[k2]:
            edges.append({"source": kid_map[k1], "target": kid_map[k2]})

    return {"nodes": nodes, "edges": edges}


# ─── Existing Endpoints ────────────────────────────────────────────


@app.get("/api/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., description="Search query"),
    topic: str = Query(None, description="Optional topic filter"),
    max_results: int = Query(15, ge=1, le=50),
):
    effective_query = q
    if topic:
        effective_query = f"{q} {topic}"

    prefixed = q.strip().lower().startswith(("stops:", "related:", "cited:"))

    results, provider_status = await search_all(effective_query, max_results=max_results)

    # For prefixed refinement queries, generate richer topic chips
    topics = []
    if prefixed and (q.strip().lower().startswith(("stops:", "related:"))):
        topics = _refinement_topics(q, results)
    else:
        topics = extract_topics(q if not prefixed else q.split(":", 1)[1].strip(), results)

    return SearchResponse(
        query=q,
        results=results,
        topics=topics,
        total_results=len(results),
        provider_status=provider_status,
    )


async def _refinement_topics(q: str, results: list[dict]) -> list[dict]:
    """Build topic chips for a stops:/related: refinement query.

    Extract the actual subject of the refinement (the part after the colon),
    then try to surface concrete sub-topics: known hints if available,
    otherwise Wikipedia-derived first sentences of the top results.
    """
    subject = q.split(":", 1)[1].strip() if ":" in q else q.strip()

    # If we have known hints for it, return those
    from .refine_helpers import topic_hints_for
    hints = topic_hints_for(subject)
    if hints:
        return [{"label": h, "description": f"Works and scholarship related to {h}"} for h in hints]

    # Otherwise derive chips from top result titles (short, specific)
    chips = []
    seen = set()
    for r in results[:6]:
        title = (r.get("title") or "").strip()
        if not title:
            continue
        short = title[:48]
        if short.lower() in seen:
            continue
        seen.add(short.lower())
        chips.append({"label": short, "description": (r.get("abstract") or "")[:120]})
    if chips:
        return chips

    return [{"label": "All results", "description": "Full result set for this refinement"}]


@app.get("/api/similar")
async def similar(
    title: str = Query(..., description="Title of the source paper"),
    max_results: int = Query(8, ge=1, le=20),
):
    """Find semantically similar papers via Semantic Scholar recommendations.

    Falls back to a keyword search on the top title words if the rec API
    is unavailable or returns nothing.
    """
    # Semantic Scholar recs need paper IDs; use the title as a search seed first.
    try:
        lookup = await search_all(title, max_results=3)
        seed_ids = []
        for r in lookup[0]:
            # collect a doi/arxiv id usable as a seed
            sid = r.get("doi") or r.get("arxiv_id")
            if sid and sid not in seed_ids:
                seed_ids.append(sid)
        if seed_ids:
            recs = await semantic_recommendations(seed_ids, max_results=max_results)
            if recs:
                return {"results": recs}
    except Exception as e:
        print(f"[Similar] rec error: {e}")

    # Fallback: keyword search on top title words
    words = [w for w in title.split() if len(w) > 3][:3]
    if words:
        fallback, _ = await search_all(" ".join(words), max_results=max_results)
        return {"results": fallback[:max_results]}
    return {"results": []}


@app.get("/api/wiki")
async def wiki(q: str = Query(..., description="Wikipedia lookup query")):
    """Fetch a Wikipedia summary for a query."""
    import urllib.parse
    encoded = urllib.parse.quote(q.replace(" ", "_"))
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    headers = {"User-Agent": "ScholarSift/2.0 (academic research tool; mailto:scholarsift@demo.dev)"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 404:
                return {"found": False, "title": None, "extract": None, "thumbnail": None, "url": None, "description": None}
            resp.raise_for_status()
            data = resp.json()
            thumb = data.get("thumbnail", {}).get("source") if data.get("thumbnail") else None
            return {
                "found": True,
                "title": data.get("title"),
                "extract": data.get("extract"),
                "thumbnail": thumb,
                "url": data.get("content_urls", {}).get("desktop", {}).get("page") if data.get("content_urls") else None,
                "description": data.get("description"),
            }
    except Exception as e:
        print(f"[Wikipedia] error: {e}")
        return {"found": False, "title": None, "extract": None, "thumbnail": None, "url": None, "description": None}


@app.get("/api/ai-overview")
async def ai_overview(q: str = Query(..., description="Query to summarize")):
    """Generate an AI overview/summary of a topic using scholarly results.
    Uses the available LLM API key to generate a concise research summary.
    Falls back gracefully if no API key is configured.
    """
    # First fetch some results to ground the summary
    results, _ = await search_all(q, max_results=8)
    if not results:
        return {"overview": f"No scholarly results found for '{q}'. Try a different search term.", "sources": 0}

    # Try to use the LLM for a generative summary
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if api_key:
        try:
            from openai import OpenAI
            base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
            client = OpenAI(api_key=api_key, base_url=base_url)

            # Build a compact summary of results
            summaries = []
            for r in results[:8]:
                title = r.get("title", "Untitled")
                authors = r.get("authors", [])
                year = r.get("year", "")
                abstract = (r.get("abstract", "") or "")[:200]
                author_str = ", ".join(authors[:3]) if authors else "Unknown"
                summaries.append(f"- \"{title}\" by {author_str} ({year}): {abstract}")

            results_text = "\n".join(summaries)

            system_prompt = (
                "You are an AI historian and encyclopedia writer. Your task: when someone asks about a person, "
                "write a short biography covering: who they were (dates, nationality, profession), what they are "
                "most famous for, their key ideas or contributions, their impact and legacy. "
                "When someone asks about a concept or theory, explain: what it is (clear definition), "
                "its origins and development, key figures associated with it, and why it matters. "
                "Write in direct, informative prose as if explaining to an intelligent but uninformed reader. "
                "3-5 paragraphs. Never mention 'scholarly results', 'search results', 'filters', 'sources', "
                "or anything about this website. Just explain the subject directly. "
                "Use the provided research abstracts as background material. "
                "Do not use markdown formatting or bullet points."
            )

            user_prompt = (
                f"Write a clear overview of: {q}\n\n"
                f"Background research material:\n{results_text}\n\n"
                f"Write directly about {q} — who they were / what it is, their key ideas or contributions, "
                "and why they matter. Do not describe how this information was found."
            )

            response = client.chat.completions.create(
                model=os.environ.get("OVERVIEW_MODEL", "deepseek/deepseek-chat"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=800,
            )
            overview = response.choices[0].message.content.strip()
            return {"overview": overview, "sources": len(results)}
        except Exception as e:
            print(f"[AI Overview] LLM error: {e}")

    # Fallback: generate a useful overview about the topic/person
    # Use titles and abstracts to create a meaningful summary
    overview_parts = [f"About: {q}"]

    # Collect key information from results
    all_text = []
    for r in results:
        title = r.get("title", "")
        abstract = r.get("abstract", "") or ""
        authors = r.get("authors", [])
        year = r.get("year", "")
        if title:
            all_text.append(f"{' '.join(authors[:2])} ({year}): {title}")

    if all_text:
        overview_parts.append("Relevant scholarly works include:")
        overview_parts.extend(all_text[:5])

    # Add a sentence from the most descriptive abstract
    for r in results:
        abstract = (r.get("abstract", "") or "")
        if abstract and "No description" not in abstract and "Subjects:" not in abstract[:20]:
            clean = abstract.replace("<p>", "").replace("</p>", " ").replace("<jats:p>", "").replace("</jats:p>", " ")
            if len(clean) > 80:
                overview_parts.append(f"\n{clean[:300]}...")
                break

    return {"overview": "\n\n".join(overview_parts), "sources": len(results)}


@app.get("/api/paper-details")
async def paper_details(
    url: str = Query(None, description="Semantic Scholar paper URL"),
    arxiv_id: str = Query(None, description="arXiv ID"),
):
    """Fetch detailed paper info from Semantic Scholar API with TLDR, full abstract, and citation context."""
    if not url and not arxiv_id:
        return {"error": "Provide either 'url' or 'arxiv_id' parameter"}
    paper_id = None
    if arxiv_id:
        paper_id = f"arXiv:{arxiv_id}"
    elif url:
        paper_id = url
    api_url = f"https://api.semanticscholar.org/graph/v1/paper/{urllib.parse.quote(paper_id, safe='')}?fields=title,authors,year,abstract,externalIds,openAccessPdf,citationCount,url,tldr,references"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(api_url)
            if resp.status_code == 429:
                return {"error": "Rate limited by Semantic Scholar"}
            if resp.status_code == 404:
                return {"error": "Paper not found"}
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"Semantic Scholar error: {e.response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

    ext_ids = data.get("externalIds", {}) or {}
    authors = [a["name"] for a in data.get("authors", []) if a.get("name")]
    tldr_obj = data.get("tldr") or {}
    tldr_text = tldr_obj.get("text", "") if isinstance(tldr_obj, dict) else ""
    abstract = data.get("abstract") or ""
    references_raw = data.get("references", []) or []
    references = []
    for ref in references_raw[:20]:
        ref_paper = ref.get("paper", {}) or {}
        ref_tldr = ref_paper.get("tldr") or {}
        references.append({
            "title": ref_paper.get("title", "Untitled"),
            "year": str(ref_paper.get("year", "")) if ref_paper.get("year") else "",
            "url": ref_paper.get("url", ""),
            "tldr_text": ref_tldr.get("text", "") if isinstance(ref_tldr, dict) else "",
        })

    return {
        "title": data.get("title", "Untitled"),
        "authors": authors,
        "year": str(data.get("year", "")) if data.get("year") else "",
        "abstract": abstract,
        "tldr_text": tldr_text,
        "url": data.get("url", ""),
        "citation_count": data.get("citationCount", 0),
        "pdf_url": data.get("openAccessPdf", {}).get("url") if data.get("openAccessPdf") else None,
        "arxiv_id": ext_ids.get("arXiv"),
        "doi": ext_ids.get("DOI"),
        "references": references,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ─── Journal Impact Lookup ──────────────────────────────────

JOURNAL_IMPACT_TABLE = {
    "nature": {"name": "Nature", "impact_factor": 64.8, "quartile": "Q1"},
    "science": {"name": "Science", "impact_factor": 56.9, "quartile": "Q1"},
    "cell": {"name": "Cell", "impact_factor": 64.5, "quartile": "Q1"},
    "the lancet": {"name": "The Lancet", "impact_factor": 168.9, "quartile": "Q1"},
    "new england journal of medicine": {"name": "NEJM", "impact_factor": 176.1, "quartile": "Q1"},
    "nature communications": {"name": "Nature Communications", "impact_factor": 16.6, "quartile": "Q1"},
    "science advances": {"name": "Science Advances", "impact_factor": 13.6, "quartile": "Q1"},
    "pnas": {"name": "PNAS", "impact_factor": 11.1, "quartile": "Q1"},
    "proceedings of the national academy of sciences": {"name": "PNAS", "impact_factor": 11.1, "quartile": "Q1"},
    "ieee transactions on pattern analysis and machine intelligence": {"name": "IEEE TPAMI", "impact_factor": 23.6, "quartile": "Q1"},
    "ieee tpami": {"name": "IEEE TPAMI", "impact_factor": 23.6, "quartile": "Q1"},
    "neural information processing systems": {"name": "NeurIPS", "impact_factor": 15.0, "quartile": "Q1"},
    "neurips": {"name": "NeurIPS", "impact_factor": 15.0, "quartile": "Q1"},
    "international conference on machine learning": {"name": "ICML", "impact_factor": 12.0, "quartile": "Q1"},
    "icml": {"name": "ICML", "impact_factor": 12.0, "quartile": "Q1"},
    "acl": {"name": "ACL", "impact_factor": 9.5, "quartile": "Q1"},
    "emnlp": {"name": "EMNLP", "impact_factor": 8.0, "quartile": "Q1"},
    "physical review letters": {"name": "Physical Review Letters", "impact_factor": 9.2, "quartile": "Q1"},
    "journal of machine learning research": {"name": "JMLR", "impact_factor": 6.0, "quartile": "Q1"},
    "jmlr": {"name": "JMLR", "impact_factor": 6.0, "quartile": "Q1"},
    "ieee transactions on neural networks and learning systems": {"name": "IEEE TNNLS", "impact_factor": 13.8, "quartile": "Q1"},
    "ieee tnnls": {"name": "IEEE TNNLS", "impact_factor": 13.8, "quartile": "Q1"},
    "ieee transactions on visualization and computer graphics": {"name": "IEEE TVCG", "impact_factor": 5.2, "quartile": "Q1"},
    "ieee tvcg": {"name": "IEEE TVCG", "impact_factor": 5.2, "quartile": "Q1"},
    "journal of the american chemical society": {"name": "JACS", "impact_factor": 14.9, "quartile": "Q1"},
    "jacs": {"name": "JACS", "impact_factor": 14.9, "quartile": "Q1"},
    "angewandte chemie": {"name": "Angewandte Chemie", "impact_factor": 16.6, "quartile": "Q1"},
    "chem review": {"name": "Chemical Reviews", "impact_factor": 72.1, "quartile": "Q1"},
    "chemical reviews": {"name": "Chemical Reviews", "impact_factor": 72.1, "quartile": "Q1"},
    "ieee access": {"name": "IEEE Access", "impact_factor": 3.9, "quartile": "Q1"},
    "plos one": {"name": "PLOS ONE", "impact_factor": 3.7, "quartile": "Q1"},
    "scientific reports": {"name": "Scientific Reports", "impact_factor": 5.8, "quartile": "Q1"},
    "biorxiv": {"name": "bioRxiv", "impact_factor": 0.0, "quartile": "preprint"},
    "medrxiv": {"name": "medRxiv", "impact_factor": 0.0, "quartile": "preprint"},
    "arxiv": {"name": "arXiv", "impact_factor": 0.0, "quartile": "preprint"},
}


@app.get("/api/journal-impact")
async def journal_impact(name: str = Query(..., description="Journal or venue name")):
    """Look up a journal's impact factor and quartile from a built-in table."""
    if not name:
        return {"name": name, "impact_factor": None, "quartile": None}
    key = name.strip().lower()
    # Try exact match first, then partial match
    if key in JOURNAL_IMPACT_TABLE:
        return JOURNAL_IMPACT_TABLE[key]
    # Partial match: check if any known journal name is contained in the query
    for known_key, info in JOURNAL_IMPACT_TABLE.items():
        if known_key in key or key in known_key:
            return info
    return {"name": name, "impact_factor": None, "quartile": None}


# ─── Custom Query Runner ────────────────────────────────────


@app.get("/api/custom-query")
async def custom_query(
    source: str = Query(..., description="Source to query: arxiv, semantic_scholar, openalex, crossref, openlibrary"),
    query: str = Query(..., description="Raw query string"),
    max_results: int = Query(10, ge=1, le=50, description="Max results to return"),
    sort_by: str = Query("relevance", description="Sort order: relevance, date, citations"),
):
    """Run a raw query against a specified academic source and return unprocessed results.
    
    This is a developer API endpoint — results are returned as-is without dedup
    or topic extraction.
    """
    import httpx
    import urllib.parse

    source_map = {
        "arxiv": {
            "url": lambda q, n, s: f"https://export.arxiv.org/api/query?search_query=all:{urllib.parse.quote(q.replace(' ', '+'))}&max_results={n}&sortBy={'submittedDate' if s == 'date' else 'relevance'}&sortOrder={'descending' if s == 'date' else 'descending'}",
            "headers": {"User-Agent": "ScholarSift/2.0 (custom-query; mailto:scholarsift@demo.dev)", "Accept": "application/xml"},
        },
        "semantic_scholar": {
            "url": lambda q, n, s: f"https://api.semanticscholar.org/graph/v1/paper/search?query={urllib.parse.quote(q)}&limit={n}&fields=title,authors,year,abstract,externalIds,openAccessPdf,citationCount,url,tldr,venue",
            "headers": {"User-Agent": "ScholarSift/2.0"},
        },
        "openalex": {
            "url": lambda q, n, s: f"https://api.openalex.org/works?search={urllib.parse.quote(q)}&per_page={n}&sort={'publication_year:desc' if s == 'date' else 'relevance_score:desc'}",
            "headers": {"User-Agent": "ScholarSift/2.0"},
        },
        "crossref": {
            "url": lambda q, n, s: f"https://api.crossref.org/works?query={urllib.parse.quote(q)}&rows={n}&mailto=scholarsift@demo.dev&sort={'published' if s == 'date' else 'relevance'}",
            "headers": {"User-Agent": "ScholarSift/2.0"},
        },
        "openlibrary": {
            "url": lambda q, n, s: f"https://openlibrary.org/search.json?q={urllib.parse.quote(q)}&limit={n}",
            "headers": {"User-Agent": "ScholarSift/2.0"},
        },
    }

    source_config = source_map.get(source.lower())
    if not source_config:
        raise HTTPException(status_code=400, detail=f"Unknown source '{source}'. Available: {', '.join(source_map.keys())}")

    url = source_config["url"](query, max_results, sort_by)
    headers = source_config["headers"]

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "xml" in content_type:
                raw = resp.text
            else:
                try:
                    raw = resp.json()
                except Exception:
                    raw = resp.text
        return {
            "source": source,
            "query": query,
            "max_results": max_results,
            "sort_by": sort_by,
            "raw_response": raw,
            "status": "success",
        }
    except Exception as e:
        return {
            "source": source,
            "query": query,
            "max_results": max_results,
            "sort_by": sort_by,
            "raw_response": str(e),
            "status": "error",
        }


@app.get("/api/openalex/works/{work_id}")
async def openalex_work_detail(work_id: str):
    """Get a single OpenAlex work with its references."""
    import httpx
    # If it's a bare ID like W2741809802, prefix it
    if not work_id.startswith("https://"):
        work_id = f"https://api.openalex.org/W{work_id.lstrip('W')}" if not work_id.startswith("W") else f"https://api.openalex.org/{work_id}"
    url = f"{work_id}?select=id,title,authorships,publication_year,cited_by_count,referenced_works,concepts"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return {"error": "Work not found", "id": work_id}
            resp.raise_for_status()
            work = resp.json()
    except Exception as e:
        print(f"[OpenAlex detail] error: {e}")
        return {"error": str(e), "id": work_id}

    authors = [
        a.get("author", {}).get("display_name", "Unknown")
        for a in work.get("authorships", []) if a.get("author")
    ]
    concepts = [
        {"name": c.get("display_name", ""), "score": c.get("score", 0)}
        for c in work.get("concepts", []) if c.get("display_name")
    ]

    # Fetch referenced works in batch
    referenced_works_raw = work.get("referenced_works", [])
    referenced_works = []
    if referenced_works_raw:
        batch_size = 25
        for i in range(0, min(len(referenced_works_raw), 50), batch_size):
            batch = referenced_works_raw[i:i+batch_size]
            ids_param = "|".join(ref.strip() for ref in batch)
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    batch_resp = await client.get(
                        f"https://api.openalex.org/works?filter=ids:{ids_param}&select=id,title,publication_year&per_page={batch_size}"
                    )
                    if batch_resp.status_code == 200:
                        batch_data = batch_resp.json()
                        for ref in batch_data.get("results", []):
                            ref_id = ref.get("id", "")
                            referenced_works.append({
                                "id": ref_id,
                                "title": ref.get("title", "Untitled"),
                                "year": str(ref.get("publication_year", "")) if ref.get("publication_year") else "",
                            })
            except Exception as e:
                print(f"[OpenAlex references batch] error: {e}")

    return {
        "id": work.get("id", ""),
        "title": work.get("title", "Untitled"),
        "authors": authors,
        "year": str(work.get("publication_year", "")) if work.get("publication_year") else "",
        "cited_by_count": work.get("cited_by_count", 0),
        "referenced_works": referenced_works,
        "concepts": concepts,
    }


@app.get("/api/citation-chain")
async def citation_chain(
    work_id: str = Query(..., description="OpenAlex work ID"),
    depth: int = Query(2, ge=1, le=3, description="Chain depth (1-3)"),
):
    """Fetch a citation chain tree from OpenAlex.
    
    Fetches the work's references from OpenAlex, then for each reference
    fetches its references (up to depth). Returns a tree structure.
    """
    import httpx
    
    async def fetch_work(wid: str) -> dict | None:
        """Fetch a single OpenAlex work's metadata."""
        if not wid.startswith("https://"):
            wid = f"https://api.openalex.org/W{wid.lstrip('W')}" if not wid.startswith("W") else f"https://api.openalex.org/{wid}"
        url = f"{wid}?select=id,title,publication_year"
        try:
            async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "ScholarSift/2.0 (citation-chain; mailto:scholarsift@demo.dev)"}) as client:
                resp = await client.get(url)
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                return resp.json()
        except Exception:
            return None

    async def fetch_refs(wid: str, max_refs: int = 15) -> list[str]:
        """Fetch referenced work IDs for a given work."""
        if not wid.startswith("https://"):
            wid = f"https://api.openalex.org/W{wid.lstrip('W')}" if not wid.startswith("W") else f"https://api.openalex.org/{wid}"
        url = f"{wid}?select=id,referenced_works"
        try:
            async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "ScholarSift/2.0 (citation-chain; mailto:scholarsift@demo.dev)"}) as client:
                resp = await client.get(url)
                if resp.status_code == 404:
                    return []
                resp.raise_for_status()
                data = resp.json()
                return (data.get("referenced_works") or [])[:max_refs]
        except Exception:
            return []

    async def build_tree(wid: str, current_depth: int) -> dict | None:
        """Recursively build a citation tree node."""
        # For recursive calls, ensure we work with the raw full URL from OpenAlex
        work = await fetch_work(wid)
        if not work:
            return None
        
        raw_id = work.get("id", wid)
        
        node = {
            "id": raw_id,
            "title": work.get("title", "Untitled"),
            "year": str(work.get("publication_year", "")) if work.get("publication_year") else "",
            "children": [],
        }
        
        if current_depth < depth:
            ref_ids = await fetch_refs(raw_id)
            if ref_ids:
                children = []
                for rid in ref_ids:
                    child = await build_tree(rid, current_depth + 1)
                    if child:
                        children.append(child)
                node["children"] = children
        
        return node

    root = await build_tree(work_id, 0)
    if not root:
        return {"error": "Work not found", "tree": None}
    
    return {"tree": root}


# ─── AI Chat Assistant ────────────────────────────────────────────────


class ChatRequest(BaseModel):
    messages: list[dict]
    context: dict | None = None


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """AI chat assistant endpoint. Uses same LLM approach as AI Overview."""
    context = req.context or {}
    query = context.get("query", "")
    results_summary = context.get("results_summary", [])

    # Build conversation for LLM
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if api_key:
        try:
            from openai import OpenAI
            base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
            client = OpenAI(api_key=api_key, base_url=base_url)

            system_msg = (
                "You are an AI research assistant helping a scholar explore academic literature. "
                "You have access to search results about the user's query. Answer questions about "
                "papers, authors, concepts, and research directions. Be concise, accurate, and insightful. "
                "Use the provided search context to ground your responses. "
                "Do not use markdown — just plain text."
            )

            # Inject context as a system message
            context_str = ""
            if query:
                context_str += f"User's current search query: {query}\n"
            if results_summary:
                context_str += f"\nCurrent search results (titles):\n" + "\n".join(results_summary[:15])

            chat_messages = [{"role": "system", "content": system_msg}]
            if context_str:
                chat_messages.append({"role": "system", "content": f"Search Context:\n{context_str}"})
            chat_messages.extend(req.messages[-10:])  # Last 10 messages for context window

            response = client.chat.completions.create(
                model=os.environ.get("CHAT_MODEL", "deepseek/deepseek-chat"),
                messages=chat_messages,
                temperature=0.5,
                max_tokens=600,
            )
            reply = response.choices[0].message.content.strip()
            return {"response": reply}
        except Exception as e:
            print(f"[Chat] LLM error: {e}")

    # Fallback: generate response from results data
    if not query and not results_summary:
        return {"response": "I'm your research assistant! Try searching for a topic and I can help analyze the results."}

    fallback_parts = []
    if query:
        fallback_parts.append(f"I found information about '{query}' in the scholarly databases.")
    if results_summary:
        fallback_parts.append(f"Here are some relevant papers I found:")
        for i, title in enumerate(results_summary[:8], 1):
            fallback_parts.append(f"  {i}. {title}")
        fallback_parts.append(f"\nYou can ask me about specific papers, authors, or concepts from these results.")

    return {"response": "\n".join(fallback_parts)}


# ─── Research Timeline ────────────────────────────────────────────────


@app.get("/api/timeline")
async def timeline(q: str = Query(..., description="Search query")):
    """Group search results by year for a timeline visualization."""
    results, _ = await search_all(q, max_results=30)
    from collections import defaultdict
    years = defaultdict(lambda: {"count": 0, "max_citation": 0, "papers": []})
    for r in results:
        year = r.get("year", "Unknown")
        if not year or year == "":
            year = "Unknown"
        years[year]["count"] += 1
        citation = r.get("citation_count") or 0
        if citation > years[year]["max_citation"]:
            years[year]["max_citation"] = citation
        years[year]["papers"].append({
            "title": r.get("title", "Untitled"),
            "citation_count": citation,
            "source": r.get("source", ""),
        })
    # Sort years
    sorted_years = []
    for y in sorted(years.keys(), key=lambda x: (x == "Unknown", int(x) if x.isdigit() else 9999)):
        sorted_years.append({
            "year": y,
            "count": years[y]["count"],
            "max_citation": years[y]["max_citation"],
            "papers": years[y]["papers"],
        })
    return {"years": sorted_years}


# ─── Co-Author Network Graph ─────────────────────────────────────────


@app.get("/api/coauthor-graph")
async def coauthor_graph(author: str = Query(..., description="Author name")):
    """Build a force-directed co-author network graph from OpenAlex."""
    import urllib.parse
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Search for the author
            search_url = f"https://api.openalex.org/authors?search={urllib.parse.quote(author)}&per_page=5"
            resp = await client.get(search_url)
            if resp.status_code != 200:
                return {"nodes": [{"id": "center", "label": author, "size": 30}], "edges": []}
            data = resp.json()
            results = data.get("results", [])
            if not results:
                return {"nodes": [{"id": "center", "label": author, "size": 30}], "edges": []}

            author_obj = results[0]
            author_id = author_obj.get("id", "")
            author_name = author_obj.get("display_name", author)

            # Get their works to find co-authors
            works_url = f"https://api.openalex.org/works?filter=authorships.author.id:{author_id.split('/')[-1]}&per_page=50&sort=publication_year:desc"
            works_resp = await client.get(works_url)
            coauthor_counts = {}
            coauthor_papers = {}
            if works_resp.status_code == 200:
                works_data = works_resp.json()
                for work in works_data.get("results", []):
                    authorships = work.get("authorships", [])
                    for a in authorships:
                        a_obj = a.get("author", {})
                        a_id = a_obj.get("id", "")
                        a_name = a_obj.get("display_name", "")
                        if a_id and a_name and a_id != author_id:
                            coauthor_counts[a_name] = coauthor_counts.get(a_name, 0) + 1
                            if a_name not in coauthor_papers:
                                coauthor_papers[a_name] = a_obj.get("id", a_name)

            # Build nodes
            nodes = [{"id": "center", "label": author_name, "size": 30, "is_center": True}]
            edges = []
            max_count = max(coauthor_counts.values()) if coauthor_counts else 1
            for c_name, c_count in sorted(coauthor_counts.items(), key=lambda x: -x[1])[:20]:
                size = 8 + int((c_count / max_count) * 16)
                cid = f"co_{c_name.replace(' ', '_')}"
                nodes.append({"id": cid, "label": c_name, "size": size, "paper_count": c_count})
                edges.append({"source": "center", "target": cid, "weight": c_count})

            # Add co-author to co-author edges (if they collaborated on papers together)
            coauthor_ids = [n["id"] for n in nodes if n["id"] != "center"]
            for i, cid1 in enumerate(coauthor_ids):
                for cid2 in coauthor_ids[i+1:]:
                    # Simple heuristic: if they appear together in papers, add edge
                    pass  # Skip for now to keep graph clean

            return {"nodes": nodes, "edges": edges}

    except Exception as e:
        print(f"[CoAuthorGraph] error: {e}")
        return {"nodes": [{"id": "center", "label": author, "size": 30}], "edges": []}


# ─── PDF Export ─────────────────────────────────────────────────────────


@app.get("/api/export-pdf")
async def export_pdf(q: str = Query(..., description="Search query"), results_json: str = Query(..., description="JSON-encoded results array")):
    """Generate a professional academic PDF export of search results."""
    try:
        results = json.loads(results_json)
    except (json.JSONDecodeError, TypeError):
        results = []

    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.platypus.flowables import HRFlowable

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.8*inch, rightMargin=0.8*inch,
        topMargin=0.8*inch, bottomMargin=0.8*inch,
    )
    styles = getSampleStyleSheet()
    gold_color = HexColor("#b89230")

    title_style = ParagraphStyle(
        "CustomTitle", fontName="Times-Bold", fontSize=22,
        leading=28, textColor=HexColor("#1a1a2e"), spaceAfter=6,
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle", fontName="Times-Roman", fontSize=11,
        leading=14, textColor=HexColor("#666666"), spaceAfter=4,
        alignment=1,
    )
    h2_style = ParagraphStyle(
        "H2", fontName="Times-Bold", fontSize=13,
        leading=17, textColor=HexColor("#1a1a2e"),
        spaceBefore=12, spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body", fontName="Times-Roman", fontSize=10,
        leading=14, textColor=HexColor("#333333"),
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "Meta", fontName="Times-Italic", fontSize=9,
        leading=12, textColor=HexColor("#666666"),
        spaceAfter=2,
    )
    abstract_style = ParagraphStyle(
        "Abstract", fontName="Times-Roman", fontSize=9,
        leading=12, textColor=HexColor("#444444"),
        leftIndent=12, spaceAfter=10,
    )
    separator_style = ParagraphStyle(
        "Sep", fontName="Times-Roman", fontSize=6,
        textColor=HexColor("#cccccc"), spaceBefore=4, spaceAfter=2,
        alignment=1,
    )

    elements = []

    # Title page
    elements.append(Spacer(1, 1.2*inch))
    elements.append(Paragraph("ScholarSift", title_style))
    elements.append(Paragraph("Academic Research Report", subtitle_style))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(HRFlowable(width="60%", thickness=1, color=gold_color, spaceAfter=12))
    elements.append(Paragraph(f"<b>Search Query:</b> {q}", subtitle_style))
    from datetime import datetime
    elements.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%B %d, %Y')}", subtitle_style))
    elements.append(Paragraph(f"<b>Results:</b> {len(results)} scholarly sources", subtitle_style))
    elements.append(Spacer(1, 0.5*inch))

    if results:
        elements.append(PageBreak())
        elements.append(Paragraph(f"Search Results for: {q}", h2_style))
        elements.append(Spacer(1, 6))

        for i, r in enumerate(results, 1):
            title = r.get("title", "Untitled")
            authors = r.get("authors", [])
            year = r.get("year", "")
            abstract = r.get("abstract", "") or ""
            source = r.get("source", "")
            url = r.get("url", "")

            author_str = ", ".join(authors[:5]) if authors else "Unknown"
            if len(authors) > 5:
                author_str += " et al."

            elements.append(Paragraph(f"{i}. <b>{title}</b>", body_style))
            meta_parts = []
            if author_str:
                meta_parts.append(author_str)
            if year:
                meta_parts.append(f"({year})")
            if source:
                meta_parts.append(f"[{source}]")
            elements.append(Paragraph(" · ".join(meta_parts), meta_style))
            if url:
                elements.append(Paragraph(f"<a href='{url}'>{url}</a>", meta_style))
            if abstract and abstract != "No description":
                # Clean HTML tags from abstract
                import re
                clean = re.sub(r"<[^>]+>", "", abstract)
                if len(clean) > 400:
                    clean = clean[:400] + "..."
                elements.append(Paragraph(clean, abstract_style))
            elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#dddddd"), spaceBefore=4, spaceAfter=6))

    else:
        elements.append(Paragraph("No results found for the given query.", body_style))

    doc.build(elements)
    buf.seek(0)

    safe_query = q.replace(" ", "_")[:50] if q else "results"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="scholarsift_{safe_query}.pdf"'},
    )


# ─── Translation Endpoint (Multi-Language Search) ─────────────────────


TRANSLATION_TABLE = {
    "en": {"name": "English", "flag": "🇬🇧"},
    "es": {"name": "Spanish", "flag": "🇪🇸"},
    "fr": {"name": "French", "flag": "🇫🇷"},
    "de": {"name": "German", "flag": "🇩🇪"},
    "zh": {"name": "Chinese", "flag": "🇨🇳"},
    "ja": {"name": "Japanese", "flag": "🇯🇵"},
    "it": {"name": "Italian", "flag": "🇮🇹"},
    "pt": {"name": "Portuguese", "flag": "🇵🇹"},
    "ru": {"name": "Russian", "flag": "🇷🇺"},
    "ko": {"name": "Korean", "flag": "🇰🇷"},
}

# Simple lookup-based translation map (common academic phrases)
COMMON_TRANSLATIONS = {
    "es": {
        "philosophy": "filosofía", "physics": "física", "psychology": "psicología",
        "history": "historia", "mathematics": "matemáticas", "biology": "biología",
        "chemistry": "química", "literature": "literatura", "art": "arte",
        "science": "ciencia", "research": "investigación", "theory": "teoría",
        "machine learning": "aprendizaje automático", "artificial intelligence": "inteligencia artificial",
        "quantum": "cuántica", "neural": "neuronal", "genetics": "genética",
        "philosopher": "filósofo", "scientist": "científico", "network": "red",
        "algorithm": "algoritmo", "data": "datos", "analysis": "análisis",
    },
    "fr": {
        "philosophy": "philosophie", "physics": "physique", "psychology": "psychologie",
        "history": "histoire", "mathematics": "mathématiques", "biology": "biologie",
        "chemistry": "chimie", "literature": "littérature", "art": "art",
        "science": "science", "research": "recherche", "theory": "théorie",
        "machine learning": "apprentissage automatique", "artificial intelligence": "intelligence artificielle",
        "quantum": "quantique", "neural": "neuronal", "genetics": "génétique",
        "philosopher": "philosophe", "scientist": "scientifique", "network": "réseau",
        "algorithm": "algorithme", "data": "données", "analysis": "analyse",
    },
    "de": {
        "philosophy": "Philosophie", "physics": "Physik", "psychology": "Psychologie",
        "history": "Geschichte", "mathematics": "Mathematik", "biology": "Biologie",
        "chemistry": "Chemie", "literature": "Literatur", "art": "Kunst",
        "science": "Wissenschaft", "research": "Forschung", "theory": "Theorie",
        "machine learning": "maschinelles Lernen", "artificial intelligence": "künstliche Intelligenz",
        "quantum": "Quanten", "neural": "neural", "genetics": "Genetik",
        "philosopher": "Philosoph", "scientist": "Wissenschaftler", "network": "Netzwerk",
        "algorithm": "Algorithmus", "data": "Daten", "analysis": "Analyse",
    },
    "zh": {
        "philosophy": "哲学", "physics": "物理学", "psychology": "心理学",
        "history": "历史", "mathematics": "数学", "biology": "生物学",
        "chemistry": "化学", "literature": "文学", "art": "艺术",
        "science": "科学", "research": "研究", "theory": "理论",
        "machine learning": "机器学习", "artificial intelligence": "人工智能",
        "quantum": "量子", "neural": "神经", "genetics": "遗传学",
        "philosopher": "哲学家", "scientist": "科学家",
    },
    "ja": {
        "philosophy": "哲学", "physics": "物理学", "psychology": "心理学",
        "history": "歴史", "mathematics": "数学", "biology": "生物学",
        "chemistry": "化学", "literature": "文学", "art": "芸術",
        "science": "科学", "research": "研究", "theory": "理論",
        "machine learning": "機械学習", "artificial intelligence": "人工知能",
        "quantum": "量子", "neural": "ニューラル", "genetics": "遺伝学",
        "philosopher": "哲学者", "scientist": "科学者",
    },
}


@app.get("/api/translate")
async def translate(text: str = Query(..., description="Text to translate"), target: str = Query("en", description="Target language code (e.g., es, fr, de)")):
    """Translate a search query to/from another language using lookup table + LLM fallback.

    Args:
        text: The text to translate.
        target: Target language code (es, fr, de, zh, ja, it, pt, ru, ko).
    """
    if target == "en":
        return {"translated_text": text, "target": target, "method": "passthrough"}

    lang_info = TRANSLATION_TABLE.get(target)
    if not lang_info:
        return {"translated_text": text, "target": target, "method": "passthrough", "note": f"Unsupported language: {target}"}

    # Try lookup table first (word-by-word replacement)
    lang_table = COMMON_TRANSLATIONS.get(target, {})
    if lang_table:
        translated = text.lower()
        # Sort by length descending to match multi-word phrases first
        for src_word in sorted(lang_table.keys(), key=len, reverse=True):
            if src_word in translated:
                translated = translated.replace(src_word, lang_table[src_word])
        if translated != text.lower():
            return {"translated_text": translated, "target": target, "method": "lookup"}

    # Try LLM fallback if API key available
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if api_key:
        try:
            from openai import OpenAI
            base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
            client = OpenAI(api_key=api_key, base_url=base_url)
            lang_name = lang_info["name"]
            resp = client.chat.completions.create(
                model=os.environ.get("OVERVIEW_MODEL", "deepseek/deepseek-chat"),
                messages=[
                    {"role": "system", "content": f"You are a translator. Translate the following text to {lang_name}. Return ONLY the translated text, nothing else."},
                    {"role": "user", "content": text},
                ],
                temperature=0.1,
                max_tokens=200,
            )
            translated = resp.choices[0].message.content.strip()
            return {"translated_text": translated, "target": target, "method": "llm"}
        except Exception as e:
            print(f"[Translate] LLM error: {e}")

    return {"translated_text": text, "target": target, "method": "passthrough", "note": f"No translation available for {target}"}


# ─── WebSocket Real-Time Collaboration ─────────────────────────────────


class ConnectionManager:
    """Manages WebSocket connections grouped by room."""

    def __init__(self):
        self.rooms: dict[str, list[dict]] = {}  # room_id -> [{websocket, username}]

    async def connect(self, websocket: WebSocket, room: str, username: str):
        await websocket.accept()
        if room not in self.rooms:
            self.rooms[room] = []
        self.rooms[room].append({"websocket": websocket, "username": username})
        # Broadcast join event
        await self.broadcast(room, {
            "type": "user_joined",
            "username": username,
            "users": [u["username"] for u in self.rooms[room]],
        })

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.rooms:
            self.rooms[room] = [u for u in self.rooms[room] if u["websocket"] != websocket]
            if not self.rooms[room]:
                del self.rooms[room]

    async def broadcast(self, room: str, message: dict, exclude: WebSocket | None = None):
        if room not in self.rooms:
            return
        dead = []
        for conn in self.rooms[room]:
            if conn["websocket"] == exclude:
                continue
            try:
                await conn["websocket"].send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn["websocket"], room)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time collaboration on collections."""
    current_room = None
    current_user = None
    try:
        # Wait for join message
        data = await websocket.receive_json()
        if data.get("type") == "join":
            room = data.get("room", "")
            token = data.get("token", "")

            # Validate token
            payload = decode_token(token)
            if not payload:
                await websocket.send_json({"type": "error", "message": "Invalid or expired token"})
                await websocket.close()
                return

            current_room = room
            current_user = payload.get("username", "anonymous")
            await manager.connect(websocket, room, current_user)

            # Send connection confirmed
            await websocket.send_json({
                "type": "connected",
                "room": room,
                "username": current_user,
                "users": [u["username"] for u in manager.rooms.get(room, [])],
            })

            # Listen for messages
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type", "")

                if msg_type == "paper_added":
                    await manager.broadcast(room, {
                        "type": "paper_added",
                        "username": current_user,
                        "paper": data.get("paper", {}),
                    }, exclude=websocket)

                elif msg_type == "paper_removed":
                    await manager.broadcast(room, {
                        "type": "paper_removed",
                        "username": current_user,
                        "paper_url": data.get("paper_url", ""),
                    }, exclude=websocket)

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        if current_room:
            manager.disconnect(websocket, current_room)
            if current_room in manager.rooms:
                await manager.broadcast(current_room, {
                    "type": "user_left",
                    "username": current_user,
                    "users": [u["username"] for u in manager.rooms[current_room]],
                })
    except Exception as e:
        print(f"[WebSocket] Error: {e}")
        if current_room:
            manager.disconnect(websocket, current_room)


# ─── Static File Serving (MUST be last) ────────────────────────────────

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
