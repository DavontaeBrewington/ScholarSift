"""Automated tests for ScholarSift API endpoints.

Tests cover:
- Health check
- Search
- Wikipedia lookup
- Trending papers
- Timeline
- Topic graph
- Co-author graph
- Auth (register, login)
- Citation chain / paper details
"""

import pytest
import uuid


# ─── Health ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health(client):
    """Verify /api/health returns {'status': 'ok'}."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ─── Search ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_returns_results(client):
    """Verify /api/search with a simple query returns structured results."""
    resp = await client.get("/api/search", params={"q": "machine learning", "max_results": 5})
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert "topics" in data
    assert "total_results" in data
    assert data["total_results"] >= 0
    # Each result should have a title
    if data["results"]:
        assert "title" in data["results"][0]


# ─── Wikipedia ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_wiki_known_topic(client):
    """Verify /api/wiki returns found=true for a well-known topic."""
    resp = await client.get("/api/wiki", params={"q": "Albert Einstein"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert data["title"] is not None
    assert data["extract"] is not None


@pytest.mark.asyncio
async def test_wiki_unknown_topic(client):
    """Verify /api/wiki returns found=false for a gibberish topic."""
    resp = await client.get("/api/wiki", params={"q": "zxqwbrmxyznotarealtopic"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is False


# ─── Trending ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trending_returns_results(client):
    """Verify /api/trending returns a list of recent papers."""
    resp = await client.get("/api/trending", params={"max_results": 5})
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    if data["results"]:
        assert "title" in data["results"][0]
        assert "authors" in data["results"][0]


# ─── Timeline ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_timeline_returns_years(client):
    """Verify /api/timeline returns year-grouped results."""
    resp = await client.get("/api/timeline", params={"q": "artificial intelligence"})
    assert resp.status_code == 200
    data = resp.json()
    assert "years" in data
    if data["years"]:
        assert "year" in data["years"][0]
        assert "count" in data["years"][0]


# ─── Topic Graph ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_topic_graph_returns_nodes(client):
    """Verify /api/topic-graph returns nodes and edges."""
    resp = await client.get("/api/topic-graph", params={"q": "quantum computing"})
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 1  # At least the center query node


# ─── Co-Author Graph ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_coauthor_graph_returns_structure(client):
    """Verify /api/coauthor-graph returns expected structure."""
    resp = await client.get("/api/coauthor-graph", params={"author": "Geoffrey Hinton"})
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 1  # At least the center node


# ─── Auth (Register & Login) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_auth_register(client):
    """Verify user registration flow."""
    username = f"testuser_{uuid.uuid4().hex[:8]}"
    resp = await client.post(
        "/api/auth/register",
        json={"username": username, "password": "testpass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"] is not None
    assert data["username"] == username


@pytest.mark.asyncio
async def test_auth_login(client, registered_user):
    """Verify login with correct credentials returns a token."""
    resp = await client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "testpass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"] is not None
    assert "token" in data


@pytest.mark.asyncio
async def test_auth_login_wrong_password(client):
    """Verify login with wrong password returns 401."""
    username = f"logintest_{uuid.uuid4().hex[:8]}"
    # Register first
    await client.post(
        "/api/auth/register",
        json={"username": username, "password": "correctpw"},
    )
    # Login with wrong password
    resp = await client.post(
        "/api/auth/login",
        json={"username": username, "password": "wrongpw"},
    )
    assert resp.status_code == 401
    assert "detail" in resp.json()


# ─── Paper Details / Citation Chain ────────────────────────────────────


@pytest.mark.asyncio
async def test_paper_details_with_arxiv_id(client):
    """Verify /api/paper-details returns expected structure given an arxiv_id."""
    resp = await client.get(
        "/api/paper-details",
        params={"arxiv_id": "2303.08774"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # May be error if Semantic Scholar API is unreachable, but should have title or error field
    if "error" not in data:
        assert "title" in data
        assert "authors" in data
        assert "citation_count" in data


@pytest.mark.asyncio
async def test_paper_details_no_params(client):
    """Verify /api/paper-details returns error when no params given."""
    resp = await client.get("/api/paper-details")
    assert resp.status_code == 200
    data = resp.json()
    assert "error" in data
