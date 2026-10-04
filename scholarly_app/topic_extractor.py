"""AI-powered topic extraction from scholarly search results."""
import json
import hashlib
import os
from openai import OpenAI

# In-memory cache: keyed by query hash
_cache: dict[str, list[dict]] = {}

# Default to OpenRouter free tier. Override with env vars.
OPENROUTER_MODEL = os.environ.get("TOPIC_MODEL", "deepseek/deepseek-chat")  # Cheap & capable

_client = None


def get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
        base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
        if api_key:
            _client = OpenAI(api_key=api_key, base_url=base_url)
        else:
            _client = None
    return _client


def _cache_key(query: str, results_hash: str) -> str:
    raw = f"{query}:{results_hash}"
    return hashlib.md5(raw.encode()).hexdigest()


def _hint_topic(label: str) -> dict:
    """Build a topic dict from a hint label."""
    return {"label": label, "description": f"Works and scholarship related to {label}"}


def extract_topics(query: str, results: list[dict]) -> list[dict]:
    """
    Given a search query and a list of result dicts, use an LLM to extract
    5-10 salient sub-topics / key concepts a researcher might filter by.
    Returns list of {label, description}.
    """
    # If we know concrete sub-topics for this exact query, use them directly —
    # they're far better than anything generation produces for famous figures.
    try:
        from .refine_helpers import topic_hints_for
    except ImportError:
        topic_hints_for = None
    hints = topic_hints_for(query) if topic_hints_for else []
    if hints:
        return [_hint_topic(h) for h in hints]

    client = get_client()
    if not client:
        return _fallback_topics(query)

    # Build a compact summary of results
    result_summaries = []
    for r in results[:15]:  # Limit tokens
        title = r.get("title", "Untitled")
        abstract = r.get("abstract", "")[:200]
        result_summaries.append(f"- {title}: {abstract}")

    results_text = "\n".join(result_summaries)
    cache_key = _cache_key(query, results_text[:100])

    if cache_key in _cache:
        return _cache[cache_key]

    system_prompt = (
        "You are a research librarian and subject-matter expert. Given a search query and "
        "the titles/abstracts of scholarly results, extract the 5-10 most salient "
        "sub-topics, schools of thought, key concepts, or categories a researcher would "
        "want to filter by. These should be concrete, well-defined topics — not generic tags. "
        "For example: for 'Marcus Aurelius', topics might include 'Stoicism', 'Meditations', "
        "'Roman Empire', 'Virtue Ethics', 'Memento Mori', 'Leadership'. "
        "For 'Nietzsche', topics might include 'Übermensch', 'Will to Power', 'Eternal Recurrence', "
        "'Master-Slave Morality', 'Thus Spoke Zarathustra', 'Nihilism'."
    )

    user_prompt = (
        f"Search query: {query}\n\n"
        f"Relevant search results (titles + abstracts):\n{results_text}\n\n"
        "Return ONLY a valid JSON array of objects, each with 'label' (short topic name) and "
        "'description' (one-sentence explanation). Example:\n"
        '[{"label": "Stoicism", "description": "Ancient Greek philosophy focused on virtue, reason, and resilience"}, '
        '{"label": "Meditations", "description": "Marcus Aurelius\' personal writings on Stoic philosophy"}]\n'
        "Return the raw JSON array with no markdown formatting, no code fences."
    )

    try:
        response = client.chat.completions.create(
            model=os.environ.get("TOPIC_MODEL", OPENROUTER_MODEL),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=1024,
        )
        content = response.choices[0].message.content.strip()

        # Remove markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])

        topics = json.loads(content)
        if isinstance(topics, list):
            _cache[cache_key] = topics
            return topics
    except Exception as e:
        print(f"Topic extraction error: {e}")

    return _fallback_topics(query)


def _fallback_topics(query: str) -> list[dict]:
    """Generate heuristic topics when the LLM is unavailable."""
    try:
        from .refine_helpers import topic_hints_for
    except ImportError:
        topic_hints_for = None
    hints = topic_hints_for(query) if topic_hints_for else []
    if hints:
        return [_hint_topic(h) for h in hints]
    topics = [
        {"label": "Historical Context", "description": f"Historical background and era of {query}"},
        {"label": "Primary Sources", "description": f"Original writings and direct works by/on {query}"},
        {"label": "Modern Scholarship", "description": f"Contemporary academic analysis of {query}"},
        {"label": "Influence & Legacy", "description": f"Impact and lasting significance of {query}"},
    ]
    return topics
