"""Pytest fixtures for ScholarSift API tests."""

import os
import sys

# Remove the hermes-agent venv from path — it has a broken pydantic_core for this Python
sys.path = [p for p in sys.path if ".hermes/hermes-agent" not in p]

# Ensure the project root is on sys.path so we can import scholarly_app
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

import pytest
from httpx import AsyncClient, ASGITransport

# Override DB path so tests use a temporary database in the project directory
os.environ.setdefault("SCHOLARSIFT_DB", ":memory:")

# Enable async test support via pytest-asyncio
pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(scope="module")
def event_loop():
    """Create a single event loop per test module for async fixtures."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
async def client():
    """Create an async HTTP client pointed at the test app."""
    from scholarly_app.scholarly_app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(scope="module")
async def registered_user(client):
    """Register and return a test user with token (uses unique name)."""
    import uuid
    username = f"loginfixture_{uuid.uuid4().hex[:8]}"
    resp = await client.post(
        "/api/auth/register",
        json={"username": username, "password": "testpass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    return {"username": data["username"], "token": data["token"]}
