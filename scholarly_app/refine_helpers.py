"""Semantic helpers for ScholarSift refinement.

Maps fuzzy refinement phrases to concrete scholarly queries and produces
query-specific topic chips when the LLM is unavailable.
"""

# --- Wikipedia topic expansion (uses the same REST summary the wiki card does) ---
import urllib.parse

WIKI_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/"


def _wiki_title_to_plain(title: str) -> str:
    """Normalize a Wikipedia title into a usable search phrase."""
    return title.replace("_", " ").strip()


async def wikipedia_first_sentence(httpx_client, query: str) -> str | None:
    """Return the first sentence of the Wikipedia summary for a query, if found."""
    encoded = urllib.parse.quote(query.replace(" ", "_"))
    try:
        resp = await httpx_client.get(
            WIKI_BASE + encoded,
            headers={"User-Agent": "ScholarSift/2.0 (academic research tool; mailto:scholarsift@demo.dev)"},
            follow_redirects=True,
            timeout=8,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        if data.get("type") == "disambiguation" or not data.get("extract"):
            return None
        first = data["extract"].split(". ")[0].strip() + "."
        return first[:400]
    except Exception as e:
        print(f"[WikiExpand] error: {e}")
        return None


# --- WordNet-style topic suggestions (built-in mini thesaurus) ---
TOPIC_HINTS: dict[str, list[str]] = {
    "stoicism": ["Stoic Ethics", "Virtue Ethics", "Logos", "Apatheia", "Roman Stoicism", "Stoic Physics"],
    "stoic": ["Stoic Ethics", "Virtue Ethics", "Logos", "Apatheia", "Roman Stoicism"],
    "nietzsche": ["Übermensch", "Will to Power", "Eternal Recurrence", "Master-Slave Morality", "Nihilism", "Thus Spoke Zarathustra"],
    "nietzschean": ["Übermensch", "Will to Power", "Eternal Recurrence", "Master-Slave Morality", "Nihilism"],
    "kant": ["Categorical Imperative", "Transcendental Idealism", "Critique of Pure Reason", "Deontology"],
    "kantian": ["Categorical Imperative", "Transcendental Idealism", "Critique of Pure Reason", "Deontology"],
    "plato": ["Theory of Forms", "The Republic", "Socratic Method", "Allegory of the Cave", "Platonic Idealism"],
    "aristotle": ["Nicomachean Ethics", "Virtue Ethics", "Metaphysics", "Categorical Syllogism", "Four Causes"],
    "marcus aurelius": ["Meditations", "Stoic Ethics", "Memento Mori", "Roman Empire", "Virtue Ethics"],
    "epictetus": ["Enchiridion", "Stoic Ethics", "Dichotomy of Control", "Apatheia"],
    "seneca": ["Letters to Lucilius", "Stoic Ethics", "On the Shortness of Life", "Roman Stoicism"],
    "socrates": ["Socratic Method", "Socratic Irony", "Socratic Paradox", "Apology", "Virtue Epistemology"],
    "descartes": ["Cogito Ergo Sum", "Mind-Body Dualism", "Meditations on First Philosophy", "Method of Doubt"],
    "hume": ["Empiricism", "Problem of Induction", "Bundle Theory of Self", "An Enquiry Concerning Human Understanding"],
    "kierkegaard": ["Existentialism", "Fear and Trembling", "Leap of Faith", "Angst", "Knight of Faith"],
    "hegel": ["Dialectic", "Phenomenology of Spirit", "Absolute Spirit", "Master-Slave Dialectic"],
    "schopenhauer": ["The World as Will and Representation", "Will to Live", "Pessimism", "Asceticism"],
    "wittgenstein": ["Tractatus Logico-Philosophicus", "Language Games", "Private Language Argument", "Philosophical Investigations"],
    "sartre": ["Existentialism", "Bad Faith", "Being and Nothingness", "Existential Freedom"],
    "beauvoir": ["The Second Sex", "Existential Feminism", "Otherness", "Ethics of Ambiguity"],
    "foucault": ["Power-Knowledge", "Panopticon", "Discourse", "Discipline and Punish", "Biopower"],
    "freud": ["Psychoanalysis", "Oedipus Complex", "Unconscious", "Id-Ego-Superego"],
    "jung": ["Archetypes", "Collective Unconscious", "Individuation", "Shadow Self"],
    "camus": ["Absurdism", "The Myth of Sisyphus", "The Stranger", "Rebellion"],
    "arendt": ["The Banality of Evil", "The Human Condition", "Totalitarianism", "Natality"],
    "karl popper": ["Falsifiability", "Open Society", "Critical Rationalism", "Paradox of Tolerance"],
    "thomas aquinas": ["Thomism", "Five Ways", "Natural Law", "Summa Theologica", "Scholasticism"],
    "stoicism": ["Stoic Ethics", "Virtue Ethics", "Logos", "Apatheia", "Roman Stoicism"],
    "epicureanism": ["Hedonism", "Atomism", "Tetrapharmakos", "Ataraxia"],
    "utilitarianism": ["Jeremy Bentham", "John Stuart Mill", "Greatest Happiness Principle", "Act vs Rule Utilitarianism"],
    "existentialism": ["Authenticity", "Bad Faith", "Freedom", "Absurdism", "Angst"],
    "phenomenology": ["Husserl", "Intentionality", "Epoché", "Lifeworld", "Heidegger"],
    "marxism": ["Dialectical Materialism", "Alienation", "Class Struggle", "Das Kapital", "Historical Materialism"],
    "capitalism": ["Market Economy", "Division of Labor", "Invisible Hand", "Crony Capitalism"],
    "democracy": ["Deliberative Democracy", "Representative Democracy", "Civic Participation", "Social Contract"],
    "artificial intelligence": ["Machine Learning", "Neural Networks", "Deep Learning", "LLM", "AGI", "Reinforcement Learning"],
    "machine learning": ["Neural Networks", "Deep Learning", "Supervised Learning", "Unsupervised Learning", "Overfitting"],
    "deep learning": ["Neural Networks", "Convolutional Networks", "Transformers", "Backpropagation"],
    "quantum mechanics": ["Wave-Particle Duality", "Schrödinger Equation", "Entanglement", "Superposition", "Copenhagen Interpretation"],
    "relativity": ["Special Relativity", "General Relativity", "Spacetime", "Gravitational Waves", "Einstein Field Equations"],
    "evolution": ["Natural Selection", "Common Descent", "Adaptation", "Sexual Selection", "Speciation"],
    "psychology": ["Cognitive Psychology", "Behaviorism", "Psychoanalysis", "Neuropsychology", "Social Psychology"],
    "cognitive behavioral therapy": ["CBT", "Beck", "Cognitive Restructuring", "Exposure Therapy"],
    "neuroplasticity": ["Synaptic Pruning", "Hebbian Learning", "Brain-Derived Neurotrophic Factor", "Critical Periods"],
    "game theory": ["Nash Equilibrium", "Prisoner's Dilemma", "Minimax", "Cooperative Games"],
    "climate change": ["Greenhouse Effect", "Carbon Emissions", "Global Warming", "Climate Policy", "Sea Level Rise"],
    "cryptocurrency": ["Blockchain", "Bitcoin", "Smart Contracts", "Decentralized Ledger"],
    "blockchain": ["Distributed Ledger", "Smart Contracts", "Consensus Mechanisms", "Immutability"],
}


def refine_phrase_to_query(phrase: str) -> str:
    """Turn a fuzzy refinement phrase into a concrete scholarly query.

    e.g. 'the stoic physics of Marcus Aurelius' -> 'stoic physics'
    """
    p = phrase.strip().lower()
    # Order by longest hint first so "machine learning" matches before "machine"
    for key in sorted(TOPIC_HINTS, key=len, reverse=True):
        if key in p:
            return key.title()
    # Cheap heuristic: drop filler words, keep 1-3 meaningful tokens
    stopwords = {"the", "a", "an", "of", "and", "or", "in", "on", "for", "to", "with", "about", "regarding", "work", "works", "theory", "theories"}
    words = [w for w in p.split() if w not in stopwords][:3]
    return " ".join(words).title() if words else phrase


def topic_hints_for(query: str) -> list[str]:
    """Return known sub-topic hint labels for a query (or [] if unknown)."""
    q = query.strip().lower()
    for key in sorted(TOPIC_HINTS, key=len, reverse=True):
        if q == key or q.startswith(key + " ") or (" " + key) in q:
            return TOPIC_HINTS[key]
    return []
