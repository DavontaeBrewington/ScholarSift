"""Simple JWT-like auth for ScholarSift using hashlib and base64."""

import hashlib
import json
import base64
import time
from typing import Optional

TOKEN_EXPIRY_SECONDS = 86400 * 7  # 7 days


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with a salt."""
    salt = hashlib.sha256(password.encode()).hexdigest()[:16]
    return hashlib.sha256((salt + password).encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(password) == password_hash


def create_token(username: str) -> str:
    """Create a simple base64-encoded JWT-like token."""
    payload = {
        "username": username,
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
    }
    payload_str = json.dumps(payload, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload_str.encode()).decode()


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a token. Returns payload or None."""
    try:
        payload_str = base64.urlsafe_b64decode(token.encode()).decode()
        payload = json.loads(payload_str)
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None
