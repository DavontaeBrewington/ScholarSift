/* ===== ScholarSift — App Logic ===== */

const DOM = {
    form: document.getElementById('search-form'),
    input: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorText: document.getElementById('error-text'),
    resultsSection: document.getElementById('results-section'),
    refineBar: document.getElementById('refine-bar'),
    topicsArea: document.getElementById('topics-area'),
    topicsChips: document.getElementById('topics-chips'),
    sourceFilters: document.getElementById('source-filters'),
    yearFilter: document.getElementById('year-filter'),
    filterInput: document.getElementById('filter-input'),
    activeFilterBar: document.getElementById('active-filter-bar'),
    activeFilterTags: document.getElementById('active-filter-tags'),
    clearAllBtn: document.getElementById('clear-all-filters'),
    resultsCount: document.getElementById('results-count'),
    resultsGrid: document.getElementById('results-grid'),
    emptyState: document.getElementById('empty-state'),
    recShuffle: document.getElementById('rec-shuffle'),
    recTickerTrack: document.getElementById('rec-ticker-track'),
    themeToggle: document.getElementById('theme-toggle'),
    aiOverview: document.getElementById('ai-overview'),
    aiOverviewContent: document.getElementById('ai-overview-content'),
    aiOverviewClose: document.getElementById('ai-overview-close'),
    citationGraph: document.getElementById('citation-graph'),
    citationGraphCanvas: document.getElementById('citation-graph-canvas'),
    citationGraphClose: document.getElementById('citation-graph-close'),
    // Topic graph elements
    topicGraph: document.getElementById('topic-graph'),
    topicGraphCanvas: document.getElementById('topic-graph-canvas'),
    topicGraphClose: document.getElementById('topic-graph-close'),
    topicGraphBtn: document.getElementById('topic-graph-btn'),
    // Timeline elements
    timelineSection: document.getElementById('timeline-section'),
    timelineCanvas: document.getElementById('timeline-canvas'),
    timelineClose: document.getElementById('timeline-close'),
    timelineBtn: document.getElementById('timeline-btn'),
    // Coauthor graph elements
    coauthorGraph: document.getElementById('coauthor-graph'),
    coauthorGraphCanvas: document.getElementById('coauthor-graph-canvas'),
    coauthorGraphClose: document.getElementById('coauthor-graph-close'),
    coauthorBtn: document.getElementById('coauthor-btn'),
    // Chat assistant elements
    chatAssistant: document.getElementById('chat-assistant'),
    chatToggle: document.getElementById('chat-toggle'),
    chatClose: document.getElementById('chat-assistant-close'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    chatSendBtn: document.getElementById('chat-send-btn'),
    // Collections search
    collectionsSearchInput: document.getElementById('collections-search-input'),
    collectionsSearchResults: document.getElementById('collections-search-results'),
    exportMdBtn: document.getElementById('export-md-btn'),
    // Filter presets elements
    saveFilterPresetBtn: document.getElementById('save-filter-preset'),
    filterPresetsBar: document.getElementById('filter-presets-bar'),
    filterPresetsChips: document.getElementById('filter-presets-chips'),
    // Auth elements
    authModal: document.getElementById('auth-modal'),
    authModalTitle: document.getElementById('auth-modal-title'),
    authForm: document.getElementById('auth-form'),
    authUsername: document.getElementById('auth-username'),
    authPassword: document.getElementById('auth-password'),
    authError: document.getElementById('auth-error'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    authModalClose: document.getElementById('auth-modal-close'),
    loginBtn: document.getElementById('login-btn'),
    registerBtn: document.getElementById('register-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    usernameDisplay: document.getElementById('username-display'),
    // Trending elements
    trendingBtn: document.getElementById('trending-btn'),
    trendingSection: document.getElementById('trending-section'),
    trendingGrid: document.getElementById('trending-grid'),
    trendingClose: document.getElementById('trending-close'),
    // PDF viewer
    pdfViewer: document.getElementById('pdf-viewer'),
    pdfViewerTitle: document.getElementById('pdf-viewer-title'),
    pdfViewerFrame: document.getElementById('pdf-viewer-frame'),
    pdfViewerClose: document.getElementById('pdf-viewer-close'),
};

let state = {
    query: '',
    allResults: [],
    filteredResults: [],
    displayedCount: 12,
    topics: [],
    activeTopic: null,
    activeFilter: 'all',
    activeYearRange: 'all',
    currentRecs: [],
    selectedIndex: -1,
    bookmarks: JSON.parse(localStorage.getItem('scholarsift_bookmarks') || '[]'),
    filterQuery: '',
    citedBy: null,
    authorSearch: null,
    sortMode: 'relevance',
    collections: JSON.parse(localStorage.getItem('scholarsift_collections') || '[]'),
    fullHistory: JSON.parse(localStorage.getItem('scholarsift_full_history') || '[]'),
    // Auth state
    token: localStorage.getItem('scholarsift_token') || null,
    username: localStorage.getItem('scholarsift_username') || null,
    isRegistering: false,
};

const REC_CATEGORIES = [
    { label: '🏛️  Philosophers', items: ['Plato', 'Aristotle', 'Immanuel Kant', 'Friedrich Nietzsche', 'Marcus Aurelius', 'Socrates', 'Confucius', 'René Descartes', 'David Hume', 'Ludwig Wittgenstein', 'Jean-Paul Sartre', 'Simone de Beauvoir', 'John Stuart Mill', 'Thomas Aquinas', 'Karl Popper', 'Hannah Arendt', 'Michel Foucault'] },
    { label: '🔬 Scientists & Theories', items: ['Quantum Mechanics', 'Relativity', 'Natural Selection', 'DNA', 'Artificial Intelligence', 'Neural Networks', 'Game Theory', 'Turing Machine', 'String Theory', 'CRISPR', 'Dark Matter', 'Evolutionary Biology', 'Cognitive Science', 'Climate Science'] },
    { label: '🧠 Psychology & Mind', items: ['Cognitive Behavioral Therapy', 'Freud psychoanalysis', 'Maslow hierarchy', 'Jung archetypes', 'Neuroplasticity', 'Theory of Mind', 'Attachment Theory', 'Behaviorism', 'Flow State', 'Placebo Effect'] },
    { label: '📖 Literature & Art', items: ['Shakespeare tragedy', 'Modernism', 'Postmodernism', 'Surrealism', 'Homer Odyssey', 'Dante Divine Comedy', 'Renaissance Art', 'Baroque Music'] },
    { label: '🌍 History & Society', items: ['Roman Empire', 'French Revolution', 'Industrial Revolution', 'Cold War', 'Ancient Egypt', 'Silk Road', 'Colonialism', 'Enlightenment Period'] },
    { label: '📐 Mathematics', items: ['Gödel Incompleteness', 'Riemann Hypothesis', 'Set Theory', 'Bayesian Inference', 'Chaos Theory', 'Complex Numbers', 'Prime Numbers'] },
];

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function formatAuthors(authors) {
    if (!authors || authors.length === 0) return 'Unknown author';
    if (authors.length <= 3) return authors.join(', ');
    return authors.slice(0, 3).join(', ') + ' et al.';
}

function getSourceBadgeClass(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('arxiv')) return 'arxiv';
    if (s.includes('semantic')) return 'semantic-scholar';
    if (s.includes('open library')) return 'open-library';
    if (s.includes('crossref')) return 'crossref';
    if (s.includes('openalex')) return 'openalex';
    return '';
}

function getSourceIcon(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('arxiv')) return '📄';
    if (s.includes('semantic')) return '🎓';
    if (s.includes('open library')) return '📖';
    if (s.includes('crossref')) return '📋';
    if (s.includes('openalex')) return '🔓';
    return '📚';
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function shuffleArray(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function generateRecs() {
    const items = [];
    REC_CATEGORIES.forEach(cat => cat.items.forEach(item => items.push(item)));
    return shuffleArray(items);
}

function renderRecs(recs) {
    const track = DOM.recTickerTrack;
    if (!track) return;
    track.innerHTML = '';
    const buildChips = (items) => {
        items.forEach(item => {
            const chip = document.createElement('button');
            chip.className = 'rec-chip';
            chip.textContent = item;
            chip.addEventListener('click', () => { DOM.input.value = item; clearAllFilters(); doSearch(item); });
            track.appendChild(chip);
        });
    };
    const display = recs.slice(0, 30);
    buildChips(display); buildChips(display);
    track.addEventListener('mouseenter', () => track.classList.add('paused'));
    track.addEventListener('mouseleave', () => track.classList.remove('paused'));
}

function generateBibtex(r) {
    let type = 'misc';
    const t = (r.type || '').toLowerCase();
    if (t.includes('journal') || t.includes('article')) type = 'article';
    else if (t.includes('book') || t.includes('monograph')) type = 'book';
    else if (t.includes('paper')) type = 'inproceedings';
    const key = r.authors && r.authors[0] ? r.authors[0].split(' ').pop().toLowerCase() + (r.year || '0000') : 'anonymous' + (r.year || '0000');
    const authorStr = r.authors && r.authors.length ? r.authors.map(a => a.replace(/[{}]/g, '')).join(' and ') : 'Unknown';
    const titleClean = r.title.replace(/[{}]/g, '').replace(/&/g, '\\\\&');
    let bib = `@${type}{${key},\\n  title     = {${titleClean}},\\n  author    = {${authorStr}},\\n`;
    if (r.year) bib += `  year      = {${r.year}},\\n`;
    if (r.url) bib += `  url       = {${r.url}},\\n`;
    bib += `}`;
    return bib;
}

/* ===== Theme ===== */
function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    localStorage.setItem('scholarsift_theme', isLight ? 'light' : 'dark');
    if (DOM.themeToggle) DOM.themeToggle.textContent = isLight ? '🌙' : '☀️';
}
function applySavedTheme() {
    const saved = localStorage.getItem('scholarsift_theme');
    if (saved === 'light') { document.documentElement.classList.add('light-mode'); if (DOM.themeToggle) DOM.themeToggle.textContent = '🌙'; }
}

/* ===== Auth ===== */
function updateAuthUI() {
    if (state.token && state.username) {
        hide(DOM.loginBtn);
        hide(DOM.registerBtn);
        show(DOM.logoutBtn);
        show(DOM.usernameDisplay);
        DOM.usernameDisplay.textContent = `👤 ${state.username}`;
    } else {
        show(DOM.loginBtn);
        show(DOM.registerBtn);
        hide(DOM.logoutBtn);
        hide(DOM.usernameDisplay);
    }
}

function openAuthModal(isRegister) {
    state.isRegistering = isRegister;
    DOM.authModalTitle.textContent = isRegister ? 'Register' : 'Log In';
    DOM.authSubmitBtn.textContent = isRegister ? 'Register' : 'Log In';
    DOM.authError.classList.add('hidden');
    DOM.authUsername.value = '';
    DOM.authPassword.value = '';
    show(DOM.authModal);
    setTimeout(() => DOM.authUsername.focus(), 100);
}

function closeAuthModal() {
    hide(DOM.authModal);
}

async function registerUser(username, password) {
    const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Registration failed');
    }
    return await resp.json();
}

async function loginUser(username, password) {
    const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Login failed');
    }
    return await resp.json();
}

function logoutUser() {
    state.token = null;
    state.username = null;
    localStorage.removeItem('scholarsift_token');
    localStorage.removeItem('scholarsift_username');
    updateAuthUI();
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = DOM.authUsername.value.trim();
    const password = DOM.authPassword.value;
    if (!username || !password) {
        DOM.authError.textContent = 'Please fill in all fields';
        show(DOM.authError);
        return;
    }
    if (password.length < 4) {
        DOM.authError.textContent = 'Password must be at least 4 characters';
        show(DOM.authError);
        return;
    }
    hide(DOM.authError);
    DOM.authSubmitBtn.disabled = true;
    DOM.authSubmitBtn.textContent = 'Working...';
    try {
        let data;
        if (state.isRegistering) {
            data = await registerUser(username, password);
        } else {
            data = await loginUser(username, password);
        }
        state.token = data.token;
        state.username = data.username;
        localStorage.setItem('scholarsift_token', state.token);
        localStorage.setItem('scholarsift_username', state.username);
        updateAuthUI();
        closeAuthModal();
        await syncData();
    } catch (err) {
        DOM.authError.textContent = err.message;
        show(DOM.authError);
    } finally {
        DOM.authSubmitBtn.disabled = false;
        DOM.authSubmitBtn.textContent = state.isRegistering ? 'Register' : 'Log In';
    }
}

async function syncData() {
    if (!state.token) return;
    try {
        // Push local bookmarks to server
        await fetch('/api/sync/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: state.token, bookmarks: state.bookmarks }),
        });
        // Push local collections to server
        const collectionsData = state.collections.map(c => ({
            name: c.name,
            papers: c.papers || [],
        }));
        await fetch('/api/sync/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: state.token, collections: collectionsData }),
        });
        // Pull server bookmarks
        const bmResp = await fetch(`/api/sync/bookmarks?token=${encodeURIComponent(state.token)}`);
        if (bmResp.ok) {
            const bmData = await bmResp.json();
            state.bookmarks = bmData.bookmarks || [];
            localStorage.setItem('scholarsift_bookmarks', JSON.stringify(state.bookmarks));
            updateBookmarksBar();
        }
        // Pull server collections
        const colResp = await fetch(`/api/sync/collections?token=${encodeURIComponent(state.token)}`);
        if (colResp.ok) {
            const colData = await colResp.json();
            state.collections = colData.collections || [];
            localStorage.setItem('scholarsift_collections', JSON.stringify(state.collections));
        }
    } catch (e) {
        console.error('[Sync] error:', e);
    }
}

// Re-run sync when bookmarks or collections change locally
function saveBookmarks() {
    localStorage.setItem('scholarsift_bookmarks', JSON.stringify(state.bookmarks));
    if (state.token) {
        clearTimeout(window._syncTimeout);
        window._syncTimeout = setTimeout(() => {
            fetch('/api/sync/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: state.token, bookmarks: state.bookmarks }),
            }).catch(() => {});
        }, 1000);
    }
}

function saveCollections() {
    localStorage.setItem('scholarsift_collections', JSON.stringify(state.collections));
    if (state.token) {
        clearTimeout(window._syncCollectionsTimeout);
        window._syncCollectionsTimeout = setTimeout(() => {
            const collectionsData = state.collections.map(c => ({
                name: c.name,
                papers: c.papers || [],
            }));
            fetch('/api/sync/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: state.token, collections: collectionsData }),
            }).catch(() => {});
        }, 1000);
    }
}

/* ===== Trending Feed (lazy-loaded) ===== */
let _trendingPapers = [];

async function fetchTrending() {
    const grid = DOM.trendingGrid;
    if (!grid) return;
    grid.innerHTML = '<div class="trending-loading">Loading trending papers...</div>';
    try {
        const resp = await fetch('/api/trending');
        if (!resp.ok) throw new Error('Failed to fetch trending');
        const data = await resp.json();
        _trendingPapers = data.results || [];
        renderTrending(_trendingPapers);
    } catch (e) {
        grid.innerHTML = `<div class="trending-loading" style="color:var(--rose)">Error: ${e.message}</div>`;
    }
}

function renderTrending(papers) {
    const grid = DOM.trendingGrid;
    if (!grid) return;
    if (!papers || papers.length === 0) {
        grid.innerHTML = '<div class="trending-loading">No recent papers found</div>';
        return;
    }
    grid.innerHTML = papers.map(p => {
        const authors = formatAuthors(p.authors || []);
        const abstract = (p.abstract || '').substring(0, 250);
        return `<div class="trending-card">
            <div class="trending-card-title">
                <a href="${p.url || '#'}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
            </div>
            <div class="trending-card-meta">
                <span>${escapeHtml(authors)}</span>
                ${p.year ? `<span class="trending-year">${p.year}</span>` : ''}
                <span class="trending-source">📄 arXiv</span>
            </div>
            ${abstract ? `<div class="trending-card-abstract">${escapeHtml(abstract)}${p.abstract && p.abstract.length > 250 ? '...' : ''}</div>` : ''}
            <div class="trending-card-links">
                ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" class="trending-link">🔗 View</a>` : ''}
                ${p.arxiv_id ? `<a href="https://arxiv.org/pdf/${p.arxiv_id}" target="_blank" rel="noopener" class="trending-link">📕 PDF</a>` : ''}
            </div>
        </div>`;
    }).join('');
}

function toggleTrending() {
    const isHidden = DOM.trendingSection.classList.contains('hidden');
    if (isHidden) {
        show(DOM.trendingSection);
        fetchTrending();
    } else {
        hide(DOM.trendingSection);
    }
}

/* ===== Topics ===== */
function renderTopics(topics) {
    DOM.topicsChips.innerHTML = '';
    if (!topics || topics.length === 0) { hide(DOM.topicsArea); return; }
    topics.forEach((topic) => {
        const count = state.allResults.filter(r => { const text = ((r.title || '') + ' ' + (r.abstract || '')).toLowerCase(); return text.includes(topic.label.toLowerCase()); }).length;
        const chip = document.createElement('button');
        chip.className = 'topic-chip';
        if (state.activeTopic === topic.label) chip.classList.add('active');
        chip.textContent = `${topic.label} (${count})`;
        chip.title = topic.description || '';
        chip.addEventListener('click', () => { state.activeTopic = state.activeTopic === topic.label ? null : topic.label; state.displayedCount = 12; applyAllFilters(); });
        DOM.topicsChips.appendChild(chip);
    });
    show(DOM.topicsArea);
}

function getSortFn(mode) {
    if (mode === 'newest') return (a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
    if (mode === 'citations') return (a, b) => (b.citation_count || 0) - (a.citation_count || 0);
    // Relevance: prefer title matches, then abstract matches, then citation/recency
    return (a, b) => {
        const q = (state.query || '').toLowerCase().trim();
        if (!q) return (b.citation_count || 0) - (a.citation_count || 0);
        const score = (r) => {
            const rawTitle = (r.title || '').toLowerCase();
            const abs = (r.abstract || '').toLowerCase();
            const qWords = q.split(/\s+/).filter(w => w.length > 2);
            let s = 0;
            const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            if (norm(r.title) === norm(q)) s += 100;
            qWords.forEach(w => {
                if (rawTitle.includes(w)) s += 5;
                else if (abs.includes(w)) s += 2;
            });
            const cit = r.citation_count || 0;
            if (cit) s += Math.min(8, Math.pow(cit, 0.3) * 0.5);
            const yr = parseInt(r.year) || 0;
            s += Math.max(0, (yr - 2000) / 100);
            return s;
        };
        return score(b) - score(a);
    };
}

function renderResults(results) {
    DOM.resultsGrid.innerHTML = '';
    if (!results || results.length === 0) { show(DOM.emptyState); hide(DOM.resultsSection); return; }
    hide(DOM.emptyState);

    let display = results;
    if (state.filterQuery) {
        const fq = state.filterQuery.toLowerCase();
        display = results.filter(r => ((r.title || '') + ' ' + (r.abstract || '')).toLowerCase().includes(fq));
    }

    const sorted = [...display].sort(getSortFn(state.sortMode));
    const showCount = Math.min(state.displayedCount || 12, sorted.length);
    const toShow = sorted.slice(0, showCount);
    const hasMore = showCount < sorted.length;

    DOM.resultsCount.textContent = `Showing ${showCount} of ${sorted.length} scholarly source${sorted.length !== 1 ? 's' : ''}`;

    // Show extra buttons
    show(DOM.timelineBtn);
    show(DOM.coauthorBtn);

    // Batch DOM reads first, then single write
    const bookmarksSet = new Set(state.bookmarks.map(b => b.url));
    const collectionsSet = new Set();
    state.collections.forEach(c => (c.papers || []).forEach(p => collectionsSet.add(p.url)));
    const selectedIdx = state.selectedIndex;

    let cardsHtml = '';
    toShow.forEach((r, idx) => {
        const sourceBadgeClass = getSourceBadgeClass(r.source);
        const isBookmarked = bookmarksSet.has(r.url);
        const isInCollection = collectionsSet.has(r.url);
        let statsHtml = '';
        const statParts = [];
        if (r.citation_count !== null && r.citation_count !== undefined) statParts.push(`<span class="stat-item">📊 ${r.citation_count}</span>`);
        if (r.container) statParts.push(`<span class="stat-item">📰 ${escapeHtml(r.container)}</span>`);
        if (statParts.length > 0) statsHtml = `<div class="result-stats">${statParts.join('')}</div>`;

        const authorSpans = (r.authors || []).map(a => `<span data-author="${escapeHtml(a)}">${escapeHtml(a)}</span>`).join(', ');

        const selectedClass = idx === selectedIdx ? ' selected' : '';
        const inColl = collectionsSet.has(r.url);
        cardsHtml += `<div class="result-card appearing${selectedClass}${isBookmarked ? ' bookmarked' : ''}">
            <div class="result-title"><a href="${r.url || '#'}" target="_blank" rel="noopener" class="result-link-title">${escapeHtml(r.title)}</a></div>
            <div class="result-meta">
                <span class="result-authors">${authorSpans || 'Unknown author'}</span>
                ${r.year ? `<span class="result-year">${r.year}</span>` : ''}
                <span class="source-badge ${sourceBadgeClass}">${getSourceIcon(r.source)} ${r.source || ''}</span>
                ${r.venue ? `<span class="journal-badge" data-journal="${escapeHtml(r.venue)}">${escapeHtml(r.venue)}</span>` : ''}
                <span class="type-badge">${r.type || ''}</span>
                <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-url="${escapeHtml(r.url)}" data-title="${escapeHtml(r.title)}" data-year="${r.year || ''}" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-source="${escapeHtml(r.source || '')}" title="Bookmark">★</button>
                <button class="save-collection-btn ${inColl ? 'in-collection' : ''}" data-url="${escapeHtml(r.url)}" data-title="${escapeHtml(r.title)}" data-year="${r.year || ''}" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-source="${escapeHtml(r.source || '')}" title="Save to collection">📁</button>
            </div>
            ${r.abstract ? `<div class="result-abstract">${escapeHtml(r.abstract)}</div>` : ''}
            ${statsHtml}
            <div class="journal-impact-info" id="journal-impact-${idx}" style="font-size:0.78rem;margin-top:6px;color:var(--text-dim)"></div>
            <div class="result-links">
                ${r.url ? `<a href="${r.url}" target="_blank" rel="noopener" class="result-link">🔗 View Source</a>` : ''}
                ${r.pdf_url ? `<button class="result-link pdf-viewer-btn" data-pdf-url="${escapeHtml(r.pdf_url)}" data-title="${escapeHtml(r.title)}">📕 PDF</button>` : ''}
                ${r.arxiv_id ? `<a href="https://arxiv.org/abs/${r.arxiv_id}" target="_blank" rel="noopener" class="result-link">📄 arXiv</a>` : ''}
                <button class="result-link summarize-btn" data-title="${escapeHtml(r.title)}" data-abstract="${escapeHtml(r.abstract || '')}" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-source="${escapeHtml(r.source || '')}">✨ Summarize</button>
                <button class="result-link workspace-add-btn" data-title="${escapeHtml(r.title)}" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-year="${r.year || ''}" data-source="${escapeHtml(r.source || '')}" data-url="${escapeHtml(r.url || '')}">🗺️ Add to Workspace</button>
                ${r.citation_count > 0 && r.arxiv_id ? `<button class="result-link cited-by-btn" data-arxiv="${escapeHtml(r.arxiv_id)}" data-title="${escapeHtml(r.title)}">📊 Cited by ${r.citation_count}</button>` : (r.citation_count > 0 ? `<span class="result-link" style="color:var(--text-dim);cursor:default">📊 ${r.citation_count} citations</span>` : '')}
                <button class="result-link bibtex-btn" data-title="${escapeHtml(r.title)}" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-year="${r.year || ''}" data-url="${escapeHtml(r.url || '')}" data-type="${escapeHtml(r.type || '')}">📋 BibTeX</button>
                ${r.authors && r.authors[0] ? `<button class="result-link similar-btn" data-title="${escapeHtml(r.title)}" data-author="${escapeHtml(r.authors[0].split(' ')[0])}">🔍 Similar</button>` : ''}
                ${r.citation_count > 0 && r.openalex_id ? `<button class="result-link citation-graph-btn" data-work-id="${escapeHtml(r.openalex_id)}" data-title="${escapeHtml(r.title)}">🕸️ Citation Graph</button>` : ''}
                ${r.openalex_id ? `<button class="result-link citation-chain-btn" data-work-id="${escapeHtml(r.openalex_id)}" data-title="${escapeHtml(r.title)}">🔗 Citation Chain</button>` : ''}
            </div>`;
    });

    DOM.resultsGrid.innerHTML = cardsHtml;
    // Trigger animation removal via rAF to avoid forced reflow
    requestAnimationFrame(() => {
        document.querySelectorAll('.result-card.appearing').forEach(card => {
            setTimeout(() => card.classList.remove('appearing'), 800);
        });
    });

    if (hasMore) {
        const lm = document.createElement('div');
        lm.className = 'load-more';
        lm.textContent = '↓ Scroll for more results';
        lm.id = 'load-more-indicator';
        DOM.resultsGrid.appendChild(lm);
    }

    state.selectedIndex = -1;
    show(DOM.resultsSection);
    show(DOM.filterInput);

    // Attach listeners (uses delegation — single listener per action type)
    document.querySelectorAll('.bookmark-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleBookmark(btn); }));
    document.querySelectorAll('.bibtex-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = { title: btn.dataset.title, authors: JSON.parse(btn.dataset.authors || '[]'), year: btn.dataset.year, url: btn.dataset.url, type: btn.dataset.type };
        const bib = generateBibtex(r);
        navigator.clipboard.writeText(bib).then(() => { const orig = btn.textContent; btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = orig, 2000); }).catch(() => {
            const ta = document.createElement('textarea'); ta.value = bib; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            const orig = btn.textContent; btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = orig, 2000);
        });
    }));
    document.querySelectorAll('.cited-by-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); doCitedBySearch(btn.dataset.arxiv, btn.dataset.title); }));
    document.querySelectorAll('.citation-graph-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); renderCitationGraph(btn.dataset.workId, btn.dataset.title); }));
    // PDF viewer buttons
    document.querySelectorAll('.pdf-viewer-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPdfViewer(btn.dataset.pdfUrl, btn.dataset.title);
    }));
    // Citation chain buttons
    document.querySelectorAll('.citation-chain-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        renderCitationChain(btn.dataset.workId, btn.dataset.title);
    }));
    document.querySelectorAll('.result-authors span[data-author]').forEach(el => {
        el.addEventListener('mouseenter', (e) => showAuthorTooltip(e, el.dataset.author));
        el.addEventListener('mouseleave', () => hideAuthorTooltip());
    });
    document.querySelectorAll('.similar-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Prefer a semantic "paper-to-paper" similarity via Semantic Scholar recs;
        // fall back to the old author-firstname related search.
        const title = btn.dataset.title;
        if (title) {
            doSimilarPapers(title);
        } else {
            doSearch('related:' + btn.dataset.author);
        }
    }));
    document.querySelectorAll('.save-collection-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showCollectionDropdown(btn);
    }));
    // Summarize buttons
    document.querySelectorAll('.summarize-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        summarizePaper({
            title: btn.dataset.title,
            abstract: btn.dataset.abstract,
            authors: JSON.parse(btn.dataset.authors || '[]'),
            source: btn.dataset.source,
        });
    }));
    // Add to workspace buttons
    document.querySelectorAll('.workspace-add-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addPaperToWorkspace({
            title: btn.dataset.title,
            authors: JSON.parse(btn.dataset.authors || '[]'),
            year: btn.dataset.year,
            source: btn.dataset.source,
            url: btn.dataset.url,
        });
        // Open workspace if not already open
        const overlay = document.getElementById('workspace-overlay');
        if (overlay && overlay.classList.contains('hidden')) {
            toggleWorkspace();
        }
    }));
    // Run consolidated post-render tasks
    setTimeout(_runPostRenderTasks, 150);
}

/* ===== Bookmarks ===== */
function toggleBookmark(btn) {
    const url = btn.dataset.url;
    const idx = state.bookmarks.findIndex(b => b.url === url);
    if (idx >= 0) { state.bookmarks.splice(idx, 1); btn.classList.remove('bookmarked'); btn.closest('.result-card').classList.remove('bookmarked'); }
    else { state.bookmarks.push({ url, title: btn.dataset.title, year: btn.dataset.year, authors: JSON.parse(btn.dataset.authors || '[]'), source: btn.dataset.source }); btn.classList.add('bookmarked'); btn.closest('.result-card').classList.add('bookmarked'); }
    saveBookmarks();
    updateBookmarksBar();
}
function updateBookmarksBar() {
    let bar = document.getElementById('bookmarks-bar');
    if (state.bookmarks.length === 0) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'bookmarks-bar'; bar.className = 'bookmarks-bar'; DOM.resultsSection.parentNode.insertBefore(bar, DOM.resultsSection); }
    bar.innerHTML = `<span class="bookmarks-label">⭐ ${state.bookmarks.length} bookmarked</span><button class="clear-bookmarks-btn" title="Clear all">✕</button>`;
    bar.querySelector('.clear-bookmarks-btn').addEventListener('click', () => { state.bookmarks = []; saveBookmarks(); updateBookmarksBar(); document.querySelectorAll('.bookmark-btn').forEach(b => b.classList.remove('bookmarked')); document.querySelectorAll('.result-card').forEach(c => c.classList.remove('bookmarked')); });
}

/* ===== Search History ===== */
function saveSearchHistory(query) {
    state.history = JSON.parse(localStorage.getItem('scholarsift_history') || '[]');
    state.history = state.history.filter(h => h !== query);
    state.history.unshift(query);
    if (state.history.length > 10) state.history.pop();
    localStorage.setItem('scholarsift_history', JSON.stringify(state.history));
}

/* ===== Collections ===== */
function renderCollectionsPanel() {
    const list = document.getElementById('collections-list');
    if (!list) return;
    list.innerHTML = '';
    if (state.collections.length === 0) { list.innerHTML = '<div style="padding:12px;color:var(--text-dim);font-size:0.85rem">No collections yet. Save papers to create one.</div>'; return; }
    state.collections.forEach((col, ci) => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.innerHTML = `<div class="collection-card-header"><strong>${escapeHtml(col.name)}</strong> <span style="font-size:0.78rem;color:var(--text-muted)">${col.papers.length} papers</span> <button class="collection-delete-btn" data-ci="${ci}" style="margin-left:auto;background:none;border:1px solid var(--surface-border);border-radius:4px;padding:1px 6px;color:var(--text-muted);cursor:pointer;font-size:0.75rem">✕ Collection</button></div><div class="collection-papers" style="display:none;margin-top:8px">${col.papers.map((p, pi) => `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--surface-border)"><span style="cursor:pointer;flex:1;font-size:0.82rem;color:var(--accent)" onclick="DOM.input.value='${escapeHtml(p.title)}';clearAllFilters();doSearch('${escapeHtml(p.title)}')">${escapeHtml(p.title)}</span> <span style="font-size:0.72rem;color:var(--text-dim)">${p.year||''}</span> <button class="paper-delete-btn" data-ci="${ci}" data-pi="${pi}" style="background:none;border:none;color:var(--rose);cursor:pointer;font-size:0.75rem">✕</button></div>`).join('')}</div>`;
        list.appendChild(card);
        card.querySelector('.collection-card-header').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') { const p = card.querySelector('.collection-papers'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; } });
        card.querySelector('.collection-delete-btn').addEventListener('click', () => { state.collections.splice(ci, 1); saveCollections(); renderCollectionsPanel(); });
        card.querySelectorAll('.paper-delete-btn').forEach(btn => btn.addEventListener('click', () => { const c = parseInt(btn.dataset.ci), p = parseInt(btn.dataset.pi); state.collections[c].papers.splice(p, 1); if (state.collections[c].papers.length === 0) state.collections.splice(c, 1); saveCollections(); renderCollectionsPanel(); }));
    });
}

function showCollectionDropdown(btn) {
    const existing = document.querySelector('.collection-dropdown');
    if (existing) existing.remove();
    const dd = document.createElement('div');
    dd.className = 'collection-dropdown';
    dd.style.cssText = 'position:absolute;z-index:100;background:var(--surface);border:1px solid var(--surface-border);border-radius:8px;padding:6px 0;min-width:180px;backdrop-filter:blur(16px)';
    const rect = btn.getBoundingClientRect();
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    state.collections.forEach((col, i) => {
        const saved = col.papers.some(p => p.url === btn.dataset.url);
        const item = document.createElement('button');
        item.style.cssText = 'display:block;width:100%;padding:6px 14px;text-align:left;font-size:0.82rem;color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit';
        item.textContent = (saved ? '✓ ' : '') + col.name;
        item.addEventListener('click', () => {
            if (!saved) { col.papers.push({ url: btn.dataset.url, title: btn.dataset.title, year: btn.dataset.year, authors: JSON.parse(btn.dataset.authors || '[]'), source: btn.dataset.source }); saveCollections(); }
            dd.remove();
            btn.classList.add('in-collection'); btn.classList.remove('in-collection-off');
            btn.textContent = '✓ Saved!'; setTimeout(() => btn.textContent = '📁', 2000);
        });
        dd.appendChild(item);
    });
    const newItem = document.createElement('button');
    newItem.style.cssText = 'display:block;width:100%;padding:6px 14px;text-align:left;font-size:0.82rem;color:var(--accent);background:none;border:none;cursor:pointer;font-family:inherit;border-top:1px solid var(--surface-border);margin-top:4px';
    newItem.textContent = '+ New collection...';
    newItem.addEventListener('click', () => {
        const name = prompt('Collection name:');
        if (name) { state.collections.push({ id: Date.now(), name, created_at: new Date().toISOString(), papers: [{ url: btn.dataset.url, title: btn.dataset.title, year: btn.dataset.year, authors: JSON.parse(btn.dataset.authors || '[]'), source: btn.dataset.source }] }); saveCollections(); }
        dd.remove();
        btn.textContent = '✓ Saved!'; setTimeout(() => btn.textContent = '📁', 2000);
    });
    dd.appendChild(newItem);
    document.body.appendChild(dd);
    setTimeout(() => document.addEventListener('click', function closeDD(e) { if (!dd.contains(e.target) && e.target !== btn) { dd.remove(); document.removeEventListener('click', closeDD); } }), 10);
}

/* ===== Recommendations ===== */
function renderRecommendations() {
    const section = document.getElementById('recommended-section');
    const grid = document.getElementById('recommended-grid');
    if (!section || !grid) return;
    const candidates = state.allResults.filter(r => r.citation_count > 0);
    const savedUrls = new Set();
    state.collections.forEach(c => (c.papers || []).forEach(p => savedUrls.add(p.url)));
    const fresh = candidates.filter(r => !savedUrls.has(r.url));
    const pool = fresh.length >= 3 ? fresh : candidates;
    if (pool.length < 3) { hide(section); return; }
    const shuffled = shuffleArray(pool).slice(0, 3);
    const bookmarksSet = new Set(state.bookmarks.map(b => b.url));
    grid.innerHTML = shuffled.map(r => {
        const authors = formatAuthors(r.authors);
        const isBookmarked = bookmarksSet.has(r.url);
        const inCol = savedUrls.has(r.url);
        return `<div class=\"recommended-card\"><div class=\"result-title\" style=\"font-size:0.88rem\"><a href=\"${r.url || '#'}\" target=\"_blank\">${escapeHtml(r.title)}</a></div><div class=\"result-meta\" style=\"font-size:0.75rem\"><span>${escapeHtml(authors)}</span>${r.year ? `<span class=\"result-year\">${r.year}</span>` : ''}<span class=\"stat-item\">📊 ${r.citation_count}</span></div><div class=\"rec-card-actions\"><button class=\"bookmark-btn rec-save-btn ${isBookmarked ? 'bookmarked' : ''}\" data-url=\"${escapeHtml(r.url || '')}\" data-title=\"${escapeHtml(r.title)}\" data-year=\"${r.year || ''}\" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-source=\"${escapeHtml(r.source || '')}\" title=\"Bookmark\">★</button><button class=\"save-collection-btn rec-save-btn ${inCol ? 'in-collection' : ''}\" data-url=\"${escapeHtml(r.url || '')}\" data-title=\"${escapeHtml(r.title)}\" data-year=\"${r.year || ''}\" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-source=\"${escapeHtml(r.source || '')}\" title=\"Save to collection\">📁</button></div></div>`;
    }).join('');
    // wire rec-card .bookmark-btn
    grid.querySelectorAll('.bookmark-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleBookmark(btn); }));
    // wire rec-card .save-collection-btn
    grid.querySelectorAll('.save-collection-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); showCollectionDropdown(btn); }));
    show(section);
}

/* ===== Full History (capped at 100 entries) ===== */
function renderHistoryPanel() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    if (state.fullHistory.length === 0) { list.innerHTML = '<div style="padding:12px;color:var(--text-dim);font-size:0.85rem">No search history yet.</div>'; return; }
    [...state.fullHistory].reverse().slice(-50).forEach(h => {
        const item = document.createElement('button');
        item.style.cssText = 'display:block;width:100%;padding:8px 14px;text-align:left;font-size:0.82rem;color:var(--text-secondary);background:none;border:none;cursor:pointer;font-family:inherit;border-bottom:1px solid var(--surface-border)';
        const date = new Date(h.timestamp);
        item.innerHTML = `<span>${escapeHtml(h.query)}</span> <span style="float:right;font-size:0.7rem;color:var(--text-dim)">${date.toLocaleDateString()} ${date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`;
        item.addEventListener('click', () => { DOM.input.value = h.query; clearAllFilters(); doSearch(h.query); document.getElementById('history-panel')?.classList.add('hidden'); });
        list.appendChild(item);
    });
}

/* ===== Filter Logic ===== */
function parseYearRange(range) { if (range === 'all') return null; const parts = range.split('-'); return { min: parseInt(parts[0]), max: parseInt(parts[1] || '9999') }; }
function getResultType(r) {
    const t = (r.type || '').toLowerCase();
    if (t.includes('journal') || t.includes('article')) return 'article';
    if (t.includes('paper')) return 'paper';
    if (t.includes('book') || t.includes('monograph') || t.includes('chapter')) return 'book';
    const s = (r.source || '').toLowerCase();
    if (s.includes('arxiv') || s.includes('semantic') || s.includes('openalex')) return 'paper';
    if (s.includes('open library')) return 'book';
    if (s.includes('crossref')) return 'article';
    return 'paper';
}

function applyAllFilters() {
    let results = [...state.allResults];
    if (state.activeFilter !== 'all') results = results.filter(r => getResultType(r) === state.activeFilter);
    const range = parseYearRange(state.activeYearRange);
    if (range) results = results.filter(r => { const y = parseInt(r.year); return y ? y >= range.min && y <= range.max : false; });
    if (state.activeTopic) results = results.filter(r => { const text = ((r.title || '') + ' ' + (r.abstract || '')).toLowerCase(); return text.includes(state.activeTopic.toLowerCase()); });
    state.filteredResults = results;
    state.displayedCount = 12;
    updateFilterBar();
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === state.activeFilter));
    document.querySelectorAll('.year-chip').forEach(c => c.classList.toggle('active', c.dataset.years === state.activeYearRange));
    document.querySelectorAll('.topic-chip').forEach(c => c.classList.toggle('active', c.textContent.startsWith(state.activeTopic)));
    if (state.allResults.length > 0) { show(DOM.sourceFilters); show(DOM.yearFilter); }
    renderResults(results);
    renderRecommendations();
}

function updateFilterBar() {
    DOM.activeFilterTags.innerHTML = '';
    const tags = [];
    if (state.activeTopic) tags.push(`Topic: ${state.activeTopic}`);
    if (state.activeFilter !== 'all') tags.push(`Type: ${state.activeFilter}`);
    const range = parseYearRange(state.activeYearRange);
    if (range) tags.push(`Year: ${range.min}–${range.max > 2026 ? 'present' : range.max}`);
    if (tags.length === 0) { hide(DOM.activeFilterBar); return; }
    show(DOM.activeFilterBar);
    tags.forEach(t => { const tag = document.createElement('span'); tag.className = 'filter-tag'; tag.textContent = t; DOM.activeFilterTags.appendChild(tag); });
}

function clearAllFilters() { state.activeTopic = null; state.activeFilter = 'all'; state.activeYearRange = 'all'; hide(DOM.activeFilterBar); applyAllFilters(); }

/* ===== AI Overview ===== */
let _aiOverviewCancel = false;
async function fetchAiOverview(query) {
    _aiOverviewCancel = false;
    show(DOM.aiOverview);
    DOM.aiOverviewContent.innerHTML = '<div class="ai-overview-loading">Generating overview...</div>';
    try {
        const resp = await fetch(`/api/ai-overview?q=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        if (_aiOverviewCancel) return;
        DOM.aiOverviewContent.innerHTML = data.overview.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    } catch (e) {
        if (!_aiOverviewCancel) DOM.aiOverviewContent.innerHTML = 'Could not generate overview.';
    }
}
DOM.aiOverviewClose.addEventListener('click', () => { _aiOverviewCancel = true; hide(DOM.aiOverview); });

/* ===== Wikipedia Card ===== */
async function renderWikiCard(query) {
    const oldCard = document.getElementById('wiki-card');
    if (oldCard) oldCard.remove();
    try {
        const resp = await fetch(`/api/wiki?q=${encodeURIComponent(query)}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.found) return;
        const card = document.createElement('div');
        card.id = 'wiki-card'; card.className = 'wiki-card';
        let extract = data.extract || '';
        if (extract.length > 300) extract = extract.slice(0, 300) + '... ';
        card.innerHTML = `${data.thumbnail ? `<img class=\"wiki-thumb\" src=\"${data.thumbnail}\" alt=\"${escapeHtml(data.title)}\">` : ''}<div class=\"wiki-content\"><div class=\"wiki-title\"><a href=\"${data.url || '#'}\" target=\"_blank\" rel=\"noopener\">${escapeHtml(data.title)}</a></div><div class=\"wiki-extract\">${escapeHtml(extract)}${data.url ? `<a href=\"${data.url}\" target=\"_blank\" rel=\"noopener\"> Read more →</a>` : ''}</div></div>`;
        const refineBar = document.getElementById('refine-bar');
        if (refineBar && refineBar.parentNode) refineBar.parentNode.insertBefore(card, refineBar.nextSibling);
    } catch (e) { /* silent */ }
}

/* ===== Provider Status Chips ===== */
function renderProviderStatus(status) {
    const refBar = document.getElementById('refine-bar');
    if (!refBar) return;
    let old = document.getElementById('provider-status-chips');
    if (old) old.remove();
    if (!status || typeof status !== 'object') return;
    const entries = Object.entries(status);
    const okCount = entries.filter(([, v]) => v === 'ok').length;
    const degraded = entries.filter(([, v]) => v !== 'ok');
    if (degraded.length === 0) return; // all good — no need to clutter
    const chips = document.createElement('div');
    chips.id = 'provider-status-chips';
    chips.className = 'provider-status-chips';
    chips.innerHTML = `<span class="provider-status-label">Sources: ${okCount}/${entries.length} responded</span>` +
        degraded.map(([name, v]) => {
            const cls = v === 'rate-limited' ? 'degraded rate-limited' : 'degraded';
            const label = v === 'rate-limited' ? `${name} ⏳ rate-limited` : `${name} ∅ no results`;
            return `<span class="provider-status-chip ${cls}" title="${name}: ${v}">${label}</span>`;
        }).join('');
    refBar.appendChild(chips);
}

/* ===== Author Tooltip ===== */
let _authorTooltipTimer = null;
function showAuthorTooltip(e, author) {
    if (_authorTooltipTimer) clearTimeout(_authorTooltipTimer);
    const existing = document.querySelector('.author-tooltip');
    if (existing) existing.remove();
    const tip = document.createElement('div');
    tip.className = 'author-tooltip';
    tip.textContent = `Loading info for ${author}...`;
    tip.style.left = (e.clientX + 15) + 'px';
    tip.style.top = (e.clientY + 10) + 'px';
    document.body.appendChild(tip);
    fetch(`/api/wiki?q=${encodeURIComponent(author)}`).then(r => r.json()).then(data => {
        if (data.found && data.extract) { const ext = data.extract.length > 200 ? data.extract.slice(0, 200) + '...' : data.extract; tip.innerHTML = `<strong>${escapeHtml(data.title)}</strong><br>${escapeHtml(ext)}`; }
        else { tip.textContent = `Search for \"${author}\" papers`; }
    }).catch(() => { tip.textContent = `Search for \"${author}\" papers`; });
}
function hideAuthorTooltip() { _authorTooltipTimer = setTimeout(() => { const t = document.querySelector('.author-tooltip'); if (t) t.remove(); }, 300); }

/* ===== Similar Papers (Semantic Recs) ===== */
async function doSimilarPapers(title) {
    const section = document.getElementById('similar-section');
    const grid = document.getElementById('similar-grid');
    const sourceTitle = document.getElementById('similar-source-title');
    if (!section || !grid) return;
    if (sourceTitle) sourceTitle.textContent = title;
    show(section);
    grid.innerHTML = '<div class="similar-loading">Finding similar papers...</div>';
    try {
        const resp = await fetch(`/api/similar?title=${encodeURIComponent(title)}&max_results=8`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
            grid.innerHTML = data.results.map(r => {
                const authors = formatAuthors(r.authors);
                return `<div class="similar-card"><div class="result-title"><a href="${r.url || '#'}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a></div><div class="result-meta"><span>${escapeHtml(authors)}</span>${r.year ? `<span class="result-year">${r.year}</span>` : ''}${r.citation_count != null ? `<span class="stat-item">📊 ${r.citation_count}</span>` : ''}</div></div>`;
            }).join('');
        } else {
            grid.innerHTML = '<div class="similar-loading">No similar papers found.</div>';
        }
    } catch (e) {
        grid.innerHTML = '<div class="similar-loading" style="color:var(--rose)">Could not load similar papers.</div>';
        console.error('[Similar]', e);
    }
}

/* ===== Cited-by Panel ===== */
function closeCitedByPanel() {
    const panel = document.querySelector('.cited-by-panel');
    if (panel) { panel.classList.remove('open'); setTimeout(() => panel.remove(), 350); }
}
async function doCitedBySearch(arxivId, paperTitle) {
    closeCitedByPanel();
    const panel = document.createElement('div');
    panel.className = 'cited-by-panel';
    panel.innerHTML = `<div class=\"cited-by-panel-header\"><span class=\"cited-by-panel-title\">Papers citing: ${escapeHtml(paperTitle)}</span><button class=\"cited-by-panel-close\" onclick=\"closeCitedByPanel()\">✕</button></div><div class=\"cited-by-panel-results\"><div style=\"text-align:center;padding:20px;color:var(--text-dim)\">Searching...</div></div>`;
    document.body.appendChild(panel);
    setTimeout(() => panel.classList.add('open'), 10);
    try {
        const resp = await fetch(`/api/search?q=cited:${arxivId}&max_results=20`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        const resultsDiv = panel.querySelector('.cited-by-panel-results');
        if (data.results && data.results.length > 0) {
            resultsDiv.innerHTML = `<div style=\"font-size:0.82rem;color:var(--text-muted);margin-bottom:8px\">${data.results.length} citing papers</div>` + data.results.map(r => {
                const authors = formatAuthors(r.authors);
                return `<div class=\"cited-by-mini-card\"><div class=\"result-title\"><a href=\"${r.url || '#'}\" target=\"_blank\">${escapeHtml(r.title)}</a></div><div class=\"result-meta\"><span>${escapeHtml(authors)}</span>${r.year ? `<span class=\"result-year\">${r.year}</span>` : ''}<span class=\"source-badge ${getSourceBadgeClass(r.source)}\">${r.source || ''}</span><button class=\"result-link cited-by-save-btn\" data-url=\"${escapeHtml(r.url || '')}\" data-title=\"${escapeHtml(r.title)}\" data-year=\"${r.year || ''}\" data-authors='${escapeHtml(JSON.stringify(r.authors || []))}' data-source=\"${escapeHtml(r.source || '')}\">📁 Save</button></div></div>`;
            }).join('');
        } else {
            resultsDiv.innerHTML = '<div style=\"text-align:center;padding:20px;color:var(--text-dim)\">No citing papers found</div>';
        }
    } catch (e) { panel.querySelector('.cited-by-panel-results').innerHTML = '<div style=\"text-align:center;padding:20px;color:var(--rose)\">Error</div>'; }
    // Save-to-collection from cited-by mini cards
    panel.querySelectorAll('.cited-by-save-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = document.createElement('button');
        target.className = 'save-collection-btn';
        target.dataset.url = btn.dataset.url;
        target.dataset.title = btn.dataset.title;
        target.dataset.year = btn.dataset.year;
        target.dataset.authors = btn.dataset.authors;
        target.dataset.source = btn.dataset.source;
        document.body.appendChild(target);
        showCollectionDropdown(target);
        setTimeout(() => { target.remove(); }, 10);
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📁 Save'; }, 2000);
    }));
}

/* ===== Citation Graph (lazy-init) ===== */
async function renderCitationGraph(workId, title) {
    const container = DOM.citationGraph;
    const canvas = DOM.citationGraphCanvas;
    if (!container || !canvas) return;
    container.classList.remove('hidden');
    container.querySelector('.citation-graph-title').textContent = `🕸️ Citation Graph: ${title}`;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth || 800;
    const H = canvas.height = 400;
    let nodes = [], edges = [], centerNode = null;
    try {
        const resp = await fetch(`/api/openalex/works/${workId}`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        centerNode = { id: data.id, label: data.title.substring(0, 40), x: W/2, y: H/2, radius: 12, isCenter: true };
        nodes = [centerNode];
        (data.referenced_works || []).slice(0, 20).forEach((ref, i) => {
            const angle = (i / 20) * Math.PI * 2;
            const r = 130 + Math.random() * 40;
            nodes.push({ id: ref.id, label: (ref.title || 'Untitled').substring(0, 30), x: W/2 + Math.cos(angle) * r, y: H/2 + Math.sin(angle) * r, radius: 6, isCenter: false, url: ref.url });
            edges.push({ from: data.id, to: ref.id });
        });
    } catch (e) { ctx.fillStyle = '#8a78b0'; ctx.font = '14px Inter'; ctx.textAlign = 'center'; ctx.fillText('Error loading graph', W/2, H/2); return; }

    let dragNode = null;
    function draw() {
        ctx.clearRect(0, 0, W, H);
        nodes.forEach((n, i) => {
            if (n.isCenter) return;
            const dx = centerNode.x - n.x, dy = centerNode.y - n.y;
            n.x += dx * 0.01; n.y += dy * 0.01;
            nodes.forEach((m, j) => {
                if (i === j) return;
                const dx2 = n.x - m.x, dy2 = n.y - m.y;
                const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
                if (dist < 100) { n.x += dx2 / dist * 0.5; n.y += dy2 / dist * 0.5; }
            });
        });
        ctx.strokeStyle = 'rgba(176,138,255,0.15)'; ctx.lineWidth = 0.5;
        edges.forEach(e => { const fn = nodes.find(n => n.id === e.from), tn = nodes.find(n => n.id === e.to); if (fn && tn) { ctx.beginPath(); ctx.moveTo(fn.x, fn.y); ctx.lineTo(tn.x, tn.y); ctx.stroke(); } });
        nodes.forEach(n => {
            if (n.isCenter) {
                const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 30);
                grad.addColorStop(0, 'rgba(176,138,255,0.3)'); grad.addColorStop(1, 'rgba(176,138,255,0)');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(n.x, n.y, 30, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#b08aff'; ctx.beginPath(); ctx.arc(n.x, n.y, 12, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(n.label.substring(0, 30), n.x, n.y + 16);
            } else {
                ctx.fillStyle = 'rgba(200,180,255,0.6)'; ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI*2); ctx.fill();
            }
        });
        requestAnimationFrame(draw);
    }
    draw();
    // Clean up old click listeners by replacing the element
    const newClose = DOM.citationGraphClose.cloneNode(true);
    DOM.citationGraphClose.parentNode.replaceChild(newClose, DOM.citationGraphClose);
    DOM.citationGraphClose = newClose;
    DOM.citationGraphClose.addEventListener('click', () => { container.classList.add('hidden'); });
    
    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const clicked = nodes.find(n => !n.isCenter && Math.hypot(n.x - mx, n.y - my) < 15);
        if (clicked) renderCitationGraph(clicked.id, clicked.label);
    };
}

/* ===== AI Topic Graph (lazy-init, with canvas cleanup) ===== */
let _topicGraphAnim = null;
async function fetchAndRenderTopicGraph(query) {
    const container = DOM.topicGraph;
    const canvas = DOM.topicGraphCanvas;
    if (!container || !canvas) return;
    container.classList.remove('hidden');
    const titleEl = container.querySelector('.topic-graph-title');
    if (titleEl) titleEl.textContent = `🔬 Topic Graph: ${query}`;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth || 800;
    const H = canvas.height = 400;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#8a78b0';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Loading topic graph...', W/2, H/2);

    try {
        const resp = await fetch(`/api/topic-graph?q=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        if (!data.nodes || data.nodes.length === 0) {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#8a78b0';
            ctx.font = '14px Inter';
            ctx.fillText('No topic data available', W/2, H/2);
            return;
        }

        const nodes = data.nodes.map(n => ({
            ...n,
            x: W/2 + (Math.random() - 0.5) * W * 0.5,
            y: H/2 + (Math.random() - 0.5) * H * 0.5,
            vx: 0, vy: 0
        }));
        const edges = data.edges || [];
        const centerNode = nodes.find(n => n.id === 'query') || nodes[0];
        if (centerNode) { centerNode.x = W/2; centerNode.y = H/2; }

        function simulate() {
            for (let i = 0; i < 20; i++) {
                for (const n of nodes) {
                    if (n.id === 'query') { n.x = W/2; n.y = H/2; continue; }
                    const dx = W/2 - n.x, dy = H/2 - n.y;
                    n.vx += dx * 0.005;
                    n.vy += dy * 0.005;
                }
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i+1; j < nodes.length; j++) {
                        const a = nodes[i], b = nodes[j];
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        if (dist < 150) {
                            const force = 2 / (dist + 1);
                            a.vx += dx / dist * force;
                            a.vy += dy / dist * force;
                            b.vx -= dx / dist * force;
                            b.vy -= dy / dist * force;
                        }
                    }
                }
                for (const e of edges) {
                    const a = nodes.find(n => n.id === e.source);
                    const b = nodes.find(n => n.id === e.target);
                    if (a && b) {
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        const spring = (dist - 80) * 0.01;
                        a.vx -= dx / dist * spring;
                        a.vy -= dy / dist * spring;
                        b.vx += dx / dist * spring;
                        b.vy += dy / dist * spring;
                    }
                }
                for (const n of nodes) {
                    if (n.id === 'query') continue;
                    n.vx *= 0.9; n.vy *= 0.9;
                    n.x += n.vx; n.y += n.vy;
                    n.x = Math.max(30, Math.min(W-30, n.x));
                    n.y = Math.max(30, Math.min(H-30, n.y));
                }
            }
            draw();
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(212,168,68,0.12)';
            ctx.lineWidth = 1;
            for (const e of edges) {
                const a = nodes.find(n => n.id === e.source);
                const b = nodes.find(n => n.id === e.target);
                if (a && b) {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
            ctx.strokeStyle = 'rgba(110,231,183,0.08)';
            ctx.lineWidth = 0.5;
            for (const e of edges) {
                const a = nodes.find(n => n.id === e.source);
                const b = nodes.find(n => n.id === e.target);
                if (a && b && e.source !== 'query' && e.target !== 'query') {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
            for (const n of nodes) {
                if (n.id === 'query') {
                    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 40);
                    grad.addColorStop(0, 'rgba(212,168,68,0.3)');
                    grad.addColorStop(1, 'rgba(212,168,68,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 40, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = '#d4a844';
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 16, 0, Math.PI*2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(212,168,68,0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 22, 0, Math.PI*2);
                    ctx.stroke();
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(n.label.substring(0, 35), n.x, n.y + 24);
                } else {
                    const baseSize = n.size || 10;
                    const radius = Math.max(5, Math.min(baseSize, 16));
                    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius + 10);
                    grad.addColorStop(0, 'rgba(110,231,183,0.15)');
                    grad.addColorStop(1, 'rgba(110,231,183,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius + 10, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(110,231,183,0.7)';
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(110,231,183,0.3)';
                    ctx.strokeStyle = 'rgba(110,231,183,0.2)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius, 0, Math.PI*2);
                    ctx.stroke();
                    ctx.fillStyle = '#c0d8d0';
                    ctx.font = '9px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(n.label.substring(0, 25), n.x, n.y + radius + 4);
                }
            }
        }

        simulate();

        canvas.onclick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const clicked = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < 25);
            if (clicked && clicked.id !== 'query' && clicked.label) {
                DOM.input.value = clicked.label;
                clearAllFilters();
                doSearch(clicked.label);
                container.classList.add('hidden');
            }
        };
    } catch (e) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#8a78b0';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading topic graph', W/2, H/2);
        console.error('[TopicGraph]', e);
    }
}

// Topic graph button
if (DOM.topicGraphBtn) {
    DOM.topicGraphBtn.addEventListener('click', () => {
        if (state.query) fetchAndRenderTopicGraph(state.query);
    });
}

// Topic graph close
DOM.topicGraphClose?.addEventListener('click', () => {
    DOM.topicGraph.classList.add('hidden');
});

/* ===== Reading List Notes ===== */
function addNoteToCollectionPaper(paperUrl, noteText) {
    const notes = JSON.parse(localStorage.getItem('scholarsift_collection_notes') || '{}');
    notes[paperUrl] = noteText;
    // Cap collection notes at 50 papers
    const keys = Object.keys(notes);
    if (keys.length > 50) {
        delete notes[keys[0]];
    }
    localStorage.setItem('scholarsift_collection_notes', JSON.stringify(notes));
}

function getNoteForPaper(paperUrl) {
    const notes = JSON.parse(localStorage.getItem('scholarsift_collection_notes') || '{}');
    return notes[paperUrl] || '';
}

function enhanceCollectionsWithNotes() {
    document.querySelectorAll('.collection-papers > div').forEach(paperDiv => {
        const spans = paperDiv.querySelectorAll('span');
        let paperUrl = '';
        spans.forEach(s => {
            const onclick = s.getAttribute('onclick') || '';
            const match = onclick.match(/doSearch\('(.+?)'\)/);
            if (match) paperUrl = match[1];
        });
        if (!paperUrl) return;
        if (paperDiv.querySelector('.collection-paper-note')) return;
        const noteDiv = document.createElement('div');
        noteDiv.className = 'collection-paper-note';
        const existingNote = getNoteForPaper(paperUrl);
        noteDiv.innerHTML = `<textarea placeholder="Add note..." data-url="${paperUrl}" rows="1">${escapeHtml(existingNote)}</textarea>`;
        paperDiv.appendChild(noteDiv);
        const textarea = noteDiv.querySelector('textarea');
        textarea.addEventListener('blur', () => {
            addNoteToCollectionPaper(paperUrl, textarea.value);
        });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            }
        });
    });
}

function addNoteIndicators() {
    document.querySelectorAll('.result-card .save-collection-btn').forEach(btn => {
        const url = btn.dataset.url;
        const note = getNoteForPaper(url);
        if (note) {
            const card = btn.closest('.result-card');
            if (card && !card.querySelector('.note-indicator')) {
                const indicator = document.createElement('button');
                indicator.className = 'note-indicator';
                indicator.textContent = '✏️';
                indicator.title = `Note: ${note}`;
                indicator.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert(`Note: ${note}`);
                });
                btn.parentNode.insertBefore(indicator, btn.nextSibling);
            }
        }
    });
}

/* ===== Recommendation Engine ===== */
function getRecommendationBadges() {
    const badges = {};
    const savedPapers = [];
    state.collections.forEach(col => {
        (col.papers || []).forEach(p => savedPapers.push(p));
    });
    state.allResults.forEach(r => {
        const matches = savedPapers.filter(sp => {
            const rAuthors = (r.authors || []).map(a => a.toLowerCase());
            const spAuthors = (sp.authors || []).map(a => a.toLowerCase());
            const authorMatch = rAuthors.some(a => spAuthors.includes(a));
            const rWords = (r.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const spWords = (sp.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const wordMatch = rWords.some(w => spWords.includes(w));
            return authorMatch || wordMatch;
        });
        if (matches.length > 0) {
            badges[r.url] = matches.length;
        }
    });
    return badges;
}

function renderCollectionRecommendations() {
    const sectionId = 'collection-recs-section';
    let section = document.getElementById(sectionId);
    const refBar = document.getElementById('refine-bar');
    if (!refBar) return;
    const queryWords = (state.query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matchingSaved = [];
    state.collections.forEach(col => {
        (col.papers || []).forEach(p => {
            const titleLower = (p.title || '').toLowerCase();
            const authorLower = (p.authors || []).join(' ').toLowerCase();
            const text = titleLower + ' ' + authorLower;
            if (queryWords.some(w => text.includes(w))) {
                matchingSaved.push({ ...p, collectionName: col.name });
            }
        });
    });
    state.allResults.forEach(r => {
        const rAuthors = (r.authors || []).map(a => a.toLowerCase());
        const rWords = (r.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
        state.collections.forEach(col => {
            (col.papers || []).forEach(p => {
                const spAuthors = (p.authors || []).map(a => a.toLowerCase());
                const spWords = (p.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
                const authorMatch = rAuthors.some(a => spAuthors.includes(a));
                const wordMatch = rWords.some(w => spWords.includes(w));
                if ((authorMatch || wordMatch) && !matchingSaved.some(m => m.url === p.url)) {
                    matchingSaved.push({ ...p, collectionName: col.name });
                }
            });
        });
    });
    const seen = new Set();
    const unique = matchingSaved.filter(p => {
        if (seen.has(p.url)) return false;
        seen.add(p.url);
        return true;
    }).slice(0, 5);
    if (unique.length === 0) {
        if (section) section.classList.add('hidden');
        return;
    }
    if (!section) {
        section = document.createElement('div');
        section.id = sectionId;
        section.className = 'recommended-section';
        refBar.parentNode.insertBefore(section, refBar.nextSibling);
    }
    section.classList.remove('hidden');
    section.innerHTML = `
        <div class=\"recommended-header\">
            <span class=\"recommended-label\">📌 Recommended from your collections</span>
        </div>
        <div class=\"recommended-grid\">
            ${unique.map(p => {
                const authors = formatAuthors(p.authors || []);
                return `<div class=\"recommended-card\">
                    <div class=\"result-title\" style=\"font-size:0.88rem\">
                        <a href=\"${p.url || '#'}\" target=\"_blank\">${escapeHtml(p.title)}</a>
                    </div>
                    <div class=\"result-meta\" style=\"font-size:0.75rem\">
                        <span>${escapeHtml(authors)}</span>
                        ${p.year ? `<span class=\"result-year\">${p.year}</span>` : ''}
                        <span style=\"font-size:0.7rem;color:var(--green)\">📁 ${escapeHtml(p.collectionName || 'Saved')}</span>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

function addRecBadges() {
    const badges = getRecommendationBadges();
    document.querySelectorAll('.result-card').forEach(card => {
        const btn = card.querySelector('.bookmark-btn');
        if (!btn) return;
        const url = btn.dataset.url;
        if (badges[url] && !card.querySelector('.collection-rec-badge')) {
            const actions = card.querySelector('.result-meta');
            if (actions) {
                const badge = document.createElement('span');
                badge.className = 'collection-rec-badge';
                badge.textContent = `📌 Related (${badges[url]})`;
                actions.appendChild(badge);
            }
        }
    });
}

/* ===== Filter Presets ===== */
function saveFilterPreset() {
    const presets = JSON.parse(localStorage.getItem('scholarsift_filter_presets') || '[]');
    const state_to_save = {
        id: Date.now(),
        name: `Filter ${presets.length + 1}`,
        topic: state.activeTopic,
        sourceType: state.activeFilter,
        yearRange: state.activeYearRange,
        query: state.query,
        created: new Date().toISOString()
    };
    const name = prompt('Name this filter preset:', state_to_save.name);
    if (!name) return;
    state_to_save.name = name;
    presets.push(state_to_save);
    localStorage.setItem('scholarsift_filter_presets', JSON.stringify(presets));
    renderFilterPresets();
}

function renderFilterPresets() {
    const presets = JSON.parse(localStorage.getItem('scholarsift_filter_presets') || '[]');
    const bar = DOM.filterPresetsBar;
    const chips = DOM.filterPresetsChips;
    if (!bar || !chips) return;
    chips.innerHTML = '';
    if (presets.length === 0) { hide(bar); return; }
    show(bar);
    presets.forEach((p, i) => {
        const chip = document.createElement('span');
        chip.className = 'preset-chip';
        chip.innerHTML = `${escapeHtml(p.name)} <span class=\"preset-delete\" data-i=\"${i}\">✕</span>`;
        chip.addEventListener('click', (e) => {
            if (e.target.classList.contains('preset-delete')) {
                presets.splice(i, 1);
                localStorage.setItem('scholarsift_filter_presets', JSON.stringify(presets));
                renderFilterPresets();
                return;
            }
            if (p.topic) state.activeTopic = p.topic;
            state.activeFilter = p.sourceType || 'all';
            state.activeYearRange = p.yearRange || 'all';
            state.displayedCount = 12;
            if (p.query) {
                DOM.input.value = p.query;
                doSearch(p.query, p.topic);
            } else {
                applyAllFilters();
            }
        });
        chips.appendChild(chip);
    });
}

if (DOM.saveFilterPresetBtn) {
    DOM.saveFilterPresetBtn.addEventListener('click', saveFilterPreset);
}

/* ===== Export Markdown ===== */
function generateMarkdown(results, query) {
    const date = new Date().toISOString().split('T')[0];
    let md = `# ScholarSift Search Results\n\n`;
    md += `**Search Query:** ${query || 'N/A'}\n`;
    md += `**Date:** ${date}\n`;
    md += `**Results:** ${results.length}\n\n`;
    md += `---\n\n`;
    results.forEach((r, i) => {
        const authors = (r.authors || []).join(', ') || 'Unknown author';
        const year = r.year || 'N/A';
        const source = r.source || '';
        const type = r.type || '';
        const abstract = (r.abstract || '').substring(0, 300);
        const url = r.url || '';
        md += `### ${i+1}. ${r.title || 'Untitled'}\n\n`;
        md += `- **Authors:** ${authors}\n`;
        md += `- **Year:** ${year}\n`;
        if (source) md += `- **Source:** ${source}\n`;
        if (type) md += `- **Type:** ${type}\n`;
        if (url) md += `- **URL:** ${url}\n`;
        if (r.citation_count !== null && r.citation_count !== undefined) {
            md += `- **Citations:** ${r.citation_count}\n`;
        }
        if (abstract) {
            md += `\n**Abstract:**\n\n${abstract}${(r.abstract || '').length > 300 ? '...' : ''}\n`;
        }
        if (url) {
            md += `\n[View Paper](${url})\n`;
        }
        md += `\n---\n\n`;
    });
    md += `\n*Generated by [ScholarSift](https://scholarsift.app)*\n`;
    return md;
}

function downloadMarkdown() {
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.allResults;
    if (!results || results.length === 0) return;
    const md = generateMarkdown(results, state.query);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholarsift_${state.query || 'export'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    const btn = DOM.exportMdBtn;
    if (btn) {
        btn.textContent = '✓ Exported!';
        btn.classList.add('exported');
        setTimeout(() => { btn.textContent = '📋 Export MD'; btn.classList.remove('exported'); }, 2000);
    }
}

if (DOM.exportMdBtn) {
    DOM.exportMdBtn.addEventListener('click', downloadMarkdown);
}

/* ===== PDF Viewer with Canvas PDF.js + Highlights ===== */

let _pdfDoc = null;
let _pdfPageNum = 1;
let _pdfScale = 1.0;
let _pdfUrl = null;
let _pdfHighlights = {};
let _pdfSelectedText = '';
let _pdfSelectedPage = 1;

function loadPdfViewer(pdfUrl, paperTitle, paperData) {
    if (!DOM.pdfViewer) return;
    DOM.pdfViewerTitle.textContent = paperTitle || 'Paper PDF';
    _pdfUrl = pdfUrl;
    _pdfPageNum = 1;
    _pdfScale = 1.0;
    show(DOM.pdfViewer);
    document.body.style.overflow = 'hidden';

    const container = document.getElementById('pdf-canvas-container');
    container.innerHTML = '<div class="pdf-loading">Loading PDF...</div>';

    // Load PDF.js from CDN (lazy — only on first PDF click)
    if (typeof pdfjsLib === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                renderPdf(pdfUrl, paperTitle);
            };
            script.onerror = () => {
                container.innerHTML = '<div class="pdf-error">Could not load the PDF viewer (CDN unreachable). <button id="pdf-retry-external" class="result-link">Open PDF externally →</button></div>';
                const retryBtn = document.getElementById('pdf-retry-external');
                if (retryBtn) retryBtn.addEventListener('click', () => window.open(pdfUrl, '_blank'));
            };
        document.head.appendChild(script);
    } else {
        renderPdf(pdfUrl, paperTitle);
    }

    loadHighlightsForPaper(pdfUrl);
}

function renderPdf(pdfUrl, paperTitle) {
    const container = document.getElementById('pdf-canvas-container');
    container.innerHTML = '<div class="pdf-loading">Rendering PDF...</div>';

    pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
        _pdfDoc = pdf;
        document.getElementById('pdf-page-indicator').textContent = `1 / ${pdf.numPages}`;
        container.innerHTML = '';
        renderPage(_pdfPageNum);
    }).catch(err => {
        container.innerHTML = `<div class=\"pdf-error\">Failed to load PDF: ${err.message}. <button id=\"pdf-retry-external\" class=\"result-link\">Try opening externally →</button></div>`;
        const retryBtn = document.getElementById('pdf-retry-external');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                window.open(pdfUrl, '_blank');
            });
        }
    });
}

function renderPage(num) {
    if (!_pdfDoc) return;
    const container = document.getElementById('pdf-canvas-container');
    _pdfPageNum = num;

    _pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale: _pdfScale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        // Clean up previous canvas if any
        container.innerHTML = '';
        container.appendChild(canvas);

        const renderContext = {
            canvasContext: ctx,
            transform: transform,
            viewport: viewport,
        };

        page.render(renderContext).promise.then(() => {
            applyHighlightsToPage(num, canvas, viewport);

            page.getTextContent().then(textContent => {
                const textLayerDiv = document.createElement('div');
                textLayerDiv.className = 'pdf-text-layer';
                textLayerDiv.style.width = canvas.style.width;
                textLayerDiv.style.height = canvas.style.height;
                textLayerDiv.style.position = 'absolute';
                textLayerDiv.style.top = '0';
                textLayerDiv.style.left = '0';
                textLayerDiv.style.overflow = 'hidden';
                textLayerDiv.style.opacity = '0.2';
                textLayerDiv.style.pointerEvents = 'none';
                canvas.parentNode.style.position = 'relative';
                canvas.parentNode.appendChild(textLayerDiv);

                textContent.items.forEach(item => {
                    const tx = document.createElement('span');
                    tx.textContent = item.str;
                    tx.style.position = 'absolute';
                    tx.style.left = item.transform[4] * _pdfScale + 'px';
                    tx.style.top = (viewport.height - item.transform[5] * _pdfScale) + 'px';
                    tx.style.fontSize = (item.height * _pdfScale) + 'px';
                    tx.style.fontFamily = 'sans-serif';
                    tx.style.whiteSpace = 'pre';
                    tx.style.color = 'transparent';
                    textLayerDiv.appendChild(tx);
                });
            });

            enableTextSelection(canvas, page, num);
        });

        document.getElementById('pdf-page-indicator').textContent = `${num} / ${_pdfDoc.numPages}`;
    });
}

function enableTextSelection(canvas, page, pageNum) {
    let isSelecting = false;
    let startX, startY, endX, endY;
    let selDiv = null;

    canvas.style.cursor = 'text';
    canvas.style.userSelect = 'text';

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isSelecting = true;

        selDiv = document.createElement('div');
        selDiv.className = 'pdf-selection-overlay';
        selDiv.style.position = 'absolute';
        selDiv.style.background = 'rgba(212,168,68,0.15)';
        selDiv.style.border = '1px solid rgba(212,168,68,0.3)';
        selDiv.style.pointerEvents = 'none';
        selDiv.style.left = startX + 'px';
        selDiv.style.top = startY + 'px';
        selDiv.style.width = '0';
        selDiv.style.height = '0';
        canvas.parentNode.appendChild(selDiv);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isSelecting || !selDiv) return;
        const rect = canvas.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;

        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        selDiv.style.left = left + 'px';
        selDiv.style.top = top + 'px';
        selDiv.style.width = Math.abs(endX - startX) + 'px';
        selDiv.style.height = Math.abs(endY - startY) + 'px';
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isSelecting) return;
        isSelecting = false;

        const rect = canvas.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;

        const selWidth = Math.abs(endX - startX);
        const selHeight = Math.abs(endY - startY);
        if (selWidth < 5 && selHeight < 5) {
            if (selDiv) { selDiv.remove(); selDiv = null; }
            return;
        }

        _pdfSelectedPage = pageNum;
        page.getTextContent().then(textContent => {
            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);

            const selectedItems = textContent.items.filter(item => {
                const itemX = item.transform[4] * _pdfScale;
                const itemY = (rect.height - item.transform[5] * _pdfScale);
                const itemW = item.width * _pdfScale;
                const itemH = item.height * _pdfScale;
                return itemX < maxX && (itemX + itemW) > minX &&
                       itemY < maxY && (itemY + itemH) > minY;
            });

            let selectedText = selectedItems.map(item => item.str).join(' ');
            selectedText = selectedText.replace(/\s+/g, ' ').trim();

            if (selectedText.length > 5) {
                _pdfSelectedText = selectedText;
                showHighlightPopup(startX, startY, pageNum, selectedText);
            } else {
                if (selDiv) { selDiv.remove(); selDiv = null; }
            }
        });

        if (selDiv) { setTimeout(() => { if (selDiv) selDiv.remove(); }, 200); }
    });
}

function showHighlightPopup(x, y, pageNum, text) {
    const popup = document.getElementById('pdf-highlight-popup');
    if (!popup) return;
    popup.style.left = Math.min(x, window.innerWidth - 250) + 'px';
    popup.style.top = Math.min(y, window.innerHeight - 100) + 'px';
    popup.classList.remove('hidden');
}

function addHighlight() {
    const color = document.getElementById('pdf-highlight-color').value;
    const popup = document.getElementById('pdf-highlight-popup');
    popup.classList.add('hidden');

    if (!_pdfSelectedText || !_pdfUrl) return;

    const highlights = getHighlightsForPaper(_pdfUrl);
    highlights.push({
        page: _pdfSelectedPage,
        text: _pdfSelectedText,
        color: color,
        note: '',
        timestamp: Date.now(),
    });
    saveHighlightsForPaper(_pdfUrl, highlights);
    renderHighlightsSidebar(_pdfUrl);

    renderPage(_pdfPageNum);
}

function getHighlightsForPaper(pdfUrl) {
    const all = JSON.parse(localStorage.getItem('scholarsift_pdf_highlights') || '{}');
    return all[pdfUrl] || [];
}

function saveHighlightsForPaper(pdfUrl, highlights) {
    const all = JSON.parse(localStorage.getItem('scholarsift_pdf_highlights') || '{}');
    all[pdfUrl] = highlights;
    localStorage.setItem('scholarsift_pdf_highlights', JSON.stringify(all));
}

function loadHighlightsForPaper(pdfUrl) {
    renderHighlightsSidebar(pdfUrl);
}

function renderHighlightsSidebar(pdfUrl) {
    const list = document.getElementById('pdf-highlights-list');
    if (!list) return;
    const highlights = getHighlightsForPaper(pdfUrl);
    if (highlights.length === 0) {
        list.innerHTML = '<div class=\"pdf-highlights-empty\">No highlights yet. Select text on a page to add one.</div>';
        return;
    }
    list.innerHTML = highlights.map((h, i) => `
        <div class=\"pdf-highlight-item\" data-index=\"${i}\">
            <div class=\"pdf-highlight-item-header\">
                <span class=\"pdf-highlight-page\">p.${h.page}</span>
                <span class=\"pdf-highlight-color-dot\" style=\"background:${h.color}\"></span>
                <button class=\"pdf-highlight-delete\" data-index=\"${i}\" title=\"Delete\">✕</button>
            </div>
            <div class=\"pdf-highlight-text\">${escapeHtml(h.text.substring(0, 120))}${h.text.length > 120 ? '...' : ''}</div>
        </div>
    `).join('');

    list.querySelectorAll('.pdf-highlight-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('pdf-highlight-delete')) return;
            const idx = parseInt(item.dataset.index);
            const h = highlights[idx];
            if (h && h.page) {
                _pdfPageNum = h.page;
                renderPage(h.page);
            }
        });
    });

    list.querySelectorAll('.pdf-highlight-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            const highlights = getHighlightsForPaper(_pdfUrl);
            highlights.splice(idx, 1);
            saveHighlightsForPaper(_pdfUrl, highlights);
            renderHighlightsSidebar(_pdfUrl);
            if (_pdfDoc) renderPage(_pdfPageNum);
        });
    });
}

function applyHighlightsToPage(pageNum, canvas, viewport) {
    const highlights = getHighlightsForPaper(_pdfUrl || '');
    const pageHighlights = highlights.filter(h => h.page === pageNum);
    if (pageHighlights.length === 0) return;
    const ctx = canvas.getContext('2d');
    pageHighlights.forEach(h => {
        ctx.fillStyle = h.color.replace('#', '') + '40';
        ctx.globalAlpha = 0.25;
        const yOffset = (pageHighlights.indexOf(h) * 30) + 10;
        ctx.fillRect(10, yOffset, viewport.width - 20, 20);
        ctx.globalAlpha = 1.0;
    });
}

function openPdfViewer(url, title, paperData) {
    loadPdfViewer(url, title, paperData);
}

function closePdfViewer() {
    hide(DOM.pdfViewer);
    document.body.style.overflow = '';
    _pdfDoc = null;
    _pdfUrl = null;
    const container = document.getElementById('pdf-canvas-container');
    if (container) container.innerHTML = '';
}

// Wire up PDF viewer controls
if (DOM.pdfViewerClose) {
    DOM.pdfViewerClose.addEventListener('click', closePdfViewer);
}
if (DOM.pdfViewer) {
    DOM.pdfViewer.addEventListener('click', (e) => {
        if (e.target === DOM.pdfViewer) closePdfViewer();
    });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.pdfViewer && !DOM.pdfViewer.classList.contains('hidden')) {
        closePdfViewer();
    }
});

document.getElementById('pdf-prev-page')?.addEventListener('click', () => {
    if (_pdfDoc && _pdfPageNum > 1) renderPage(_pdfPageNum - 1);
});
document.getElementById('pdf-next-page')?.addEventListener('click', () => {
    if (_pdfDoc && _pdfPageNum < _pdfDoc.numPages) renderPage(_pdfPageNum + 1);
});
document.getElementById('pdf-zoom-in')?.addEventListener('click', () => {
    _pdfScale = Math.min(_pdfScale * 1.25, 3);
    document.getElementById('pdf-zoom-level').textContent = Math.round(_pdfScale * 100) + '%';
    if (_pdfDoc) renderPage(_pdfPageNum);
});
document.getElementById('pdf-zoom-out')?.addEventListener('click', () => {
    _pdfScale = Math.max(_pdfScale / 1.25, 0.25);
    document.getElementById('pdf-zoom-level').textContent = Math.round(_pdfScale * 100) + '%';
    if (_pdfDoc) renderPage(_pdfPageNum);
});
document.getElementById('pdf-fit-width')?.addEventListener('click', () => {
    const container = document.getElementById('pdf-canvas-container');
    if (container && _pdfDoc) {
        _pdfDoc.getPage(_pdfPageNum).then(page => {
            const vp = page.getViewport({ scale: 1 });
            const cw = container.clientWidth - 20;
            _pdfScale = cw / vp.width;
            document.getElementById('pdf-zoom-level').textContent = Math.round(_pdfScale * 100) + '%';
            renderPage(_pdfPageNum);
        });
    }
});
document.getElementById('pdf-highlight-add')?.addEventListener('click', addHighlight);
document.getElementById('pdf-highlights-close')?.addEventListener('click', () => {
    const sidebar = document.getElementById('pdf-highlights-sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
});

/* ===== AI Paper Summarizer ===== */
function openSummaryPanel() {
    const panel = document.getElementById('summary-panel');
    if (panel) panel.classList.remove('hidden');
}
function closeSummaryPanel() {
    const panel = document.getElementById('summary-panel');
    if (panel) panel.classList.add('hidden');
}
document.getElementById('summary-panel-close')?.addEventListener('click', closeSummaryPanel);

async function summarizePaper(paperData) {
    const panel = document.getElementById('summary-panel');
    const content = document.getElementById('summary-panel-content');
    if (!panel || !content) return;
    panel.classList.remove('hidden');
    content.innerHTML = '<div class=\"summary-loading\">✨ Generating AI summary...</div>';
    try {
        const resp = await fetch('/api/summarize-paper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: paperData.title || '',
                abstract: paperData.abstract || '',
                authors: paperData.authors || [],
                source: paperData.source || '',
            }),
        });
        if (!resp.ok) throw new Error('Failed to summarize');
        const data = await resp.json();
        const s = data.summary || {};
        const findingsHtml = (s.key_findings || []).map(f => `<li>${escapeHtml(f)}</li>`).join('');
        const limitationsHtml = (s.limitations || []).map(l => `<li>${escapeHtml(l)}</li>`).join('');
        content.innerHTML = `
            <div class=\"summary-section\">
                <div class=\"summary-label\">📋 TL;DR</div>
                <div class=\"summary-text\">${escapeHtml(s.tldr || 'No summary available')}</div>
            </div>
            ${findingsHtml ? `
            <div class=\"summary-section\">
                <div class=\"summary-label\">🔬 Key Findings</div>
                <ul class=\"summary-list\">${findingsHtml}</ul>
            </div>` : ''}
            ${s.methodology ? `
            <div class=\"summary-section\">
                <div class=\"summary-label\">⚙️ Methodology</div>
                <div class=\"summary-text\">${escapeHtml(s.methodology)}</div>
            </div>` : ''}
            ${limitationsHtml ? `
            <div class=\"summary-section\">
                <div class=\"summary-label\">⚠️ Limitations</div>
                <ul class=\"summary-list limitations\">${limitationsHtml}</ul>
            </div>` : ''}
        `;
    } catch (e) {
        content.innerHTML = `<div class=\"summary-loading\" style=\"color:var(--rose)\">Error: ${escapeHtml(e.message)}</div>`;
    }
}

/* ===== Research Workspace / Mind Map ===== */
let _workspaceState = {
    nodes: [],
    edges: [],
    connectMode: false,
    connectFirst: null,
    dragNode: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
};

function toggleWorkspace() {
    const overlay = document.getElementById('workspace-overlay');
    if (!overlay) return;
    const isHidden = overlay.classList.contains('hidden');
    if (isHidden) {
        overlay.classList.remove('hidden');
        loadWorkspace();
        renderWorkspace();
    } else {
        overlay.classList.add('hidden');
    }
}

document.getElementById('workspace-close')?.addEventListener('click', () => {
    document.getElementById('workspace-overlay')?.classList.add('hidden');
});

function loadWorkspace() {
    const saved = JSON.parse(localStorage.getItem('scholarsift_workspace') || 'null');
    if (saved) {
        _workspaceState.nodes = saved.nodes || [];
        _workspaceState.edges = saved.edges || [];
    }
}

function saveWorkspaceToStorage() {
    localStorage.setItem('scholarsift_workspace', JSON.stringify({
        nodes: _workspaceState.nodes,
        edges: _workspaceState.edges,
    }));
}

async function saveWorkspaceToServer() {
    saveWorkspaceToStorage();
    try {
        await fetch('/api/workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: state.token || '',
                name: 'My Workspace',
                nodes: _workspaceState.nodes,
                edges: _workspaceState.edges,
            }),
        });
    } catch (e) {
        console.warn('[Workspace] server save failed, using localStorage:', e);
    }
}

function renderWorkspace() {
    const canvas = document.getElementById('workspace-canvas');
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 48;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(3,1,6,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(212,168,68,0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    _workspaceState.edges.forEach(e => {
        const fromNode = _workspaceState.nodes.find(n => n.id === e.from);
        const toNode = _workspaceState.nodes.find(n => n.id === e.to);
        if (fromNode && toNode) {
            ctx.strokeStyle = 'rgba(212,168,68,0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            ctx.stroke();

            const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
            const headLen = 10;
            ctx.fillStyle = 'rgba(212,168,68,0.6)';
            ctx.beginPath();
            ctx.moveTo(toNode.x, toNode.y);
            ctx.lineTo(toNode.x - headLen * Math.cos(angle - 0.3), toNode.y - headLen * Math.sin(angle - 0.3));
            ctx.lineTo(toNode.x - headLen * Math.cos(angle + 0.3), toNode.y - headLen * Math.sin(angle + 0.3));
            ctx.closePath();
            ctx.fill();
        }
    });

    if (_workspaceState.connectMode && _workspaceState.connectFirst) {
        ctx.strokeStyle = 'rgba(110,231,183,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(_workspaceState.connectFirst.x, _workspaceState.connectFirst.y);
        ctx.lineTo(_workspaceState._mouseX || _workspaceState.connectFirst.x, _workspaceState._mouseY || _workspaceState.connectFirst.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _workspaceState.nodes.forEach(n => {
        const isPaper = n.type === 'paper';
        const radius = isPaper ? 18 : 14;
        const color = isPaper ? '#d4a844' : '#6ee7b7';

        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius + 15);
        grad.addColorStop(0, isPaper ? 'rgba(212,168,68,0.2)' : 'rgba(110,231,183,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isPaper ? 'rgba(212,168,68,0.3)' : 'rgba(110,231,183,0.3)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = n.content && n.content.title ? n.content.title.substring(0, 30) : (n.content || 'Node');
        ctx.fillStyle = '#f0e8d8';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label.substring(0, 25), n.x, n.y + radius + 4);

        if (isPaper) {
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📄', n.x, n.y - 1);
        }
    });
}

function setupWorkspaceInteractions() {
    const canvas = document.getElementById('workspace-canvas');
    if (!canvas) return;

    let dragNode = null;
    let dragOffX = 0, dragOffY = 0;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        _workspaceState._mouseX = mx;
        _workspaceState._mouseY = my;

        const clicked = _workspaceState.nodes.find(n => {
            const r = n.type === 'paper' ? 18 : 14;
            return Math.hypot(n.x - mx, n.y - my) < r + 5;
        });

        if (clicked) {
            if (_workspaceState.connectMode) {
                if (!_workspaceState.connectFirst) {
                    _workspaceState.connectFirst = clicked;
                } else if (_workspaceState.connectFirst.id !== clicked.id) {
                    const exists = _workspaceState.edges.some(e =>
                        (e.from === _workspaceState.connectFirst.id && e.to === clicked.id) ||
                        (e.from === clicked.id && e.to === _workspaceState.connectFirst.id)
                    );
                    if (!exists) {
                        _workspaceState.edges.push({
                            from: _workspaceState.connectFirst.id,
                            to: clicked.id,
                        });
                        saveWorkspaceToServer();
                    }
                    _workspaceState.connectFirst = null;
                }
                renderWorkspace();
                return;
            }

            dragNode = clicked;
            dragOffX = mx - clicked.x;
            dragOffY = my - clicked.y;
        } else if (!_workspaceState.connectMode) {
            _workspaceState.connectFirst = null;
            renderWorkspace();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        _workspaceState._mouseX = mx;
        _workspaceState._mouseY = my;

        if (dragNode) {
            dragNode.x = mx - dragOffX;
            dragNode.y = my - dragOffY;
            renderWorkspace();
        } else if (_workspaceState.connectMode && _workspaceState.connectFirst) {
            renderWorkspace();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (dragNode) {
            dragNode = null;
            saveWorkspaceToServer();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (dragNode) {
            dragNode = null;
            saveWorkspaceToServer();
        }
    });
}

document.getElementById('workspace-add-text')?.addEventListener('click', () => {
    const text = prompt('Enter note text:');
    if (text) {
        _workspaceState.nodes.push({
            id: 'node_' + Date.now(),
            x: 150 + Math.random() * 400,
            y: 150 + Math.random() * 300,
            type: 'text',
            content: text,
        });
        renderWorkspace();
        saveWorkspaceToServer();
    }
});

document.getElementById('workspace-connect-mode')?.addEventListener('click', (btn) => {
    _workspaceState.connectMode = !_workspaceState.connectMode;
    _workspaceState.connectFirst = null;
    btn.target.classList.toggle('active');
    renderWorkspace();
});

document.getElementById('workspace-save')?.addEventListener('click', async () => {
    await saveWorkspaceToServer();
    const btn = document.getElementById('workspace-save');
    const orig = btn.textContent;
    btn.textContent = '✅ Saved!';
    setTimeout(() => btn.textContent = orig, 2000);
});

document.getElementById('workspace-export')?.addEventListener('click', () => {
    const canvas = document.getElementById('workspace-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'research-workspace.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

document.getElementById('workspace-clear')?.addEventListener('click', () => {
    if (confirm('Clear entire workspace?')) {
        _workspaceState.nodes = [];
        _workspaceState.edges = [];
        _workspaceState.connectFirst = null;
        saveWorkspaceToServer();
        renderWorkspace();
    }
});

function addPaperToWorkspace(paperData) {
    const nodeId = 'paper_' + Date.now();
    _workspaceState.nodes.push({
        id: nodeId,
        x: 100 + Math.random() * 500,
        y: 100 + Math.random() * 300,
        type: 'paper',
        content: paperData,
    });
    renderWorkspace();
    saveWorkspaceToServer();
}

document.getElementById('workspace-btn')?.addEventListener('click', toggleWorkspace);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('workspace-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
    }
});

setTimeout(setupWorkspaceInteractions, 1000);

/* ===== Citation Chain Explorer ===== */
let _citationChainPanel = null;

function closeCitationChain() {
    if (_citationChainPanel) {
        _citationChainPanel.classList.remove('open');
        setTimeout(() => { if (_citationChainPanel) { _citationChainPanel.remove(); _citationChainPanel = null; } }, 350);
    }
}

async function renderCitationChain(workId, title, depth) {
    closeCitationChain();
    depth = depth || 2;

    const panel = document.createElement('div');
    panel.className = 'citation-chain-panel';
    panel.innerHTML = `
        <div class=\"citation-chain-header\">
            <span class=\"citation-chain-title\">🔗 Citation Chain: ${escapeHtml(title)}</span>
            <button class=\"citation-chain-close\" onclick=\"closeCitationChain()\">✕</button>
        </div>
        <div class=\"citation-chain-body\">
            <div class=\"citation-chain-loading\">Loading citation chain...</div>
        </div>`;
    document.body.appendChild(panel);
    _citationChainPanel = panel;
    setTimeout(() => panel.classList.add('open'), 10);

    const body = panel.querySelector('.citation-chain-body');

    try {
        const resp = await fetch(`/api/citation-chain?work_id=${encodeURIComponent(workId)}&depth=${depth}`);
        if (!resp.ok) throw new Error('Failed to fetch citation chain');
        const data = await resp.json();
        if (data.error || !data.tree) {
            body.innerHTML = `<div class=\"citation-chain-error\">${escapeHtml(data.error || 'No citation data found')}</div>`;
            return;
        }
        body.innerHTML = '';
        renderCitationTreeNode(data.tree, body, 0, true);
    } catch (e) {
        body.innerHTML = `<div class=\"citation-chain-error\">Error: ${escapeHtml(e.message)}</div>`;
    }
}

function renderCitationTreeNode(node, container, level, isExpanded) {
    const div = document.createElement('div');
    div.className = 'citation-tree-node';

    const hasChildren = node.children && node.children.length > 0;
    const toggleSpan = document.createElement('span');
    toggleSpan.className = 'citation-tree-toggle';
    toggleSpan.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '·';
    if (hasChildren) {
        toggleSpan.addEventListener('click', () => {
            const childrenDiv = div.nextElementSibling;
            if (childrenDiv) {
                const expanded = childrenDiv.classList.toggle('expanded');
                toggleSpan.textContent = expanded ? '▼' : '▶';
            }
        });
    }
    div.appendChild(toggleSpan);

    const content = document.createElement('div');
    content.className = 'citation-tree-content';
    const metaParts = [];
    if (node.year) metaParts.push(node.year);
    const metaStr = metaParts.length > 0 ? ` — ${metaParts.join(', ')}` : '';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'citation-tree-title';
    titleSpan.textContent = node.title || 'Untitled';
    titleSpan.addEventListener('click', () => {
        const input = DOM.input;
        if (input) {
            input.value = node.title;
            clearAllFilters();
            doSearch(node.title);
            closeCitationChain();
        }
    });
    content.appendChild(titleSpan);

    if (metaStr) {
        const meta = document.createElement('div');
        meta.className = 'citation-tree-meta';
        meta.textContent = metaStr;
        content.appendChild(meta);
    }
    div.appendChild(content);
    container.appendChild(div);

    if (hasChildren) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'citation-tree-children' + (isExpanded ? ' expanded' : '');
        node.children.forEach(child => {
            if (child) {
                renderCitationTreeNode(child, childrenDiv, level + 1, false);
            }
        });
        container.appendChild(childrenDiv);
    }
}

/* ===== Semantic Search Fallback ===== */
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'by', 'with', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'it', 'its', 'this', 'that', 'these', 'those',
]);

async function semanticFallbackSearch(originalQuery, originalResults) {
    if (originalResults.length >= 3) return null;
    const terms = originalQuery
        .toLowerCase()
        .split(/[^a-zA-Z0-9]+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t));
    if (terms.length < 2) return null;
    const allResults = [];
    const seenUrls = new Set();
    originalResults.forEach(r => {
        const urlKey = r.url || r.title;
        if (urlKey && !seenUrls.has(urlKey)) {
            seenUrls.add(urlKey);
            allResults.push(r);
        }
    });
    for (const term of terms.slice(0, 5)) {
        try {
            const resp = await fetch(`/api/search?q=${encodeURIComponent(term)}&max_results=10`);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (data.results) {
                data.results.forEach(r => {
                    const urlKey = r.url || r.title;
                    if (urlKey && !seenUrls.has(urlKey)) {
                        seenUrls.add(urlKey);
                        allResults.push(r);
                    }
                });
            }
        } catch (e) {
            continue;
        }
    }
    if (allResults.length <= originalResults.length) return null;
    return { results: allResults, expandedTerms: terms };
}

/* ===== Modified doSearch with semantic fallback ===== */
async function doSearch(query, topic) {
    state.query = query;
    state.activeTopic = topic || null;
    state.displayedCount = 12;
    state.citedBy = null;
    state.authorSearch = null;
    hide(DOM.resultsSection); hide(DOM.error); hide(DOM.emptyState); hide(DOM.filterInput); hide(DOM.aiOverview);
    const trendingSection = document.getElementById('trending-section');
    if (trendingSection) hide(trendingSection);
    const queryRunner = document.getElementById('query-runner-section');
    if (queryRunner) hide(queryRunner);
    closeCitedByPanel();
    closeCitationChain();
    if (DOM.citationGraph) DOM.citationGraph.classList.add('hidden');
    const oldNote = document.querySelector('.semantic-fallback-note');
    if (oldNote) oldNote.remove();
    show(DOM.loading);
    const params = new URLSearchParams({ q: query, max_results: 25 });
    if (topic) params.set('topic', topic);
    // Show topic chips for stops/related/cited queries too, so users can explore
    const isPrefixedQuery = /^(stops?|related|cited):/i.test(query.trim());
    if (!isPrefixedQuery) {
        try {
            const topicResp = await fetch(`/api/search?q=${encodeURIComponent(query)}&max_results=1`);
            if (topicResp.ok) {
                const topicData = await topicResp.json();
                state.topics = topicData.topics || [];
            }
        } catch (e) { state.topics = []; }
    }
    try {
        const resp = await fetch(`/api/search?${params.toString()}`);
        if (!resp.ok) throw new Error(`Server error ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        hide(DOM.loading);
        if (query) {
            state.fullHistory.push({ query, timestamp: Date.now() });
            // Cap full history at 100 entries
            if (state.fullHistory.length > 100) state.fullHistory = state.fullHistory.slice(state.fullHistory.length - 100);
            localStorage.setItem('scholarsift_full_history', JSON.stringify(state.fullHistory));
        }
        if (data.results && data.results.length > 0) {
            state.allResults = data.results;
            if (state.topics.length === 0 && data.topics) state.topics = data.topics;
            saveSearchHistory(query);
            renderTopics(state.topics);
            applyAllFilters();
            renderWikiCard(query);
            fetchAiOverview(query);
            fetchJournalImpacts(data.results);
            renderProviderStatus(data.provider_status);
        } else {
            const fallback = await semanticFallbackSearch(query, data.results || []);
            if (fallback) {
                state.allResults = fallback.results;
                try {
                    const topicResp = await fetch(`/api/search?q=${encodeURIComponent(query)}&max_results=1`);
                    if (topicResp.ok) {
                        const topicData = await topicResp.json();
                        state.topics = topicData.topics || [];
                    }
                } catch (e) { state.topics = []; }
                saveSearchHistory(query);
                renderTopics(state.topics);
                applyAllFilters();
                const note = document.createElement('div');
                note.className = 'semantic-fallback-note';
                note.innerHTML = `<span class=\"note-icon\">🔍</span> Tried expanding your search — searched individual terms: <strong>${escapeHtml(fallback.expandedTerms.join(', '))}</strong>`;
                const refBar = document.getElementById('refine-bar');
                if (refBar && refBar.parentNode) {
                    refBar.parentNode.insertBefore(note, refBar.nextSibling);
                }
                renderWikiCard(query);
                fetchAiOverview(query);
                if (fallback.results) fetchJournalImpacts(fallback.results);
            } else {
                show(DOM.emptyState);
                hide(DOM.resultsSection);
                hide(DOM.topicsArea);
                hide(DOM.sourceFilters);
                hide(DOM.yearFilter);
            }
        }
    } catch (err) {
        hide(DOM.loading); hide(DOM.resultsSection); hide(DOM.topicsArea); hide(DOM.sourceFilters); hide(DOM.yearFilter);
        DOM.errorText.textContent = err.message; show(DOM.error);
    }
}

/* ===== Journal Impact Badges ===== */
async function fetchJournalImpacts(results) {
    const venues = new Set();
    results.forEach(r => {
        if (r.venue && r.venue.trim()) venues.add(r.venue.trim());
    });
    if (venues.size === 0) return;
    const venueArr = Array.from(venues);
    const impactData = {};
    const promises = venueArr.map(async (v) => {
        try {
            const resp = await fetch(`/api/journal-impact?name=${encodeURIComponent(v)}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.impact_factor !== null) {
                    impactData[v.toLowerCase()] = data;
                }
            }
        } catch (e) { /* silent */ }
    });
    await Promise.allSettled(promises);
    document.querySelectorAll('.journal-badge').forEach(el => {
        const journalName = el.dataset.journal;
        const key = (journalName || '').trim().toLowerCase();
        const info = impactData[key];
        if (info) {
            el.classList.add('has-impact');
            const badge = document.createElement('span');
            badge.className = 'impact-factor-badge';
            badge.textContent = `IF: ${info.impact_factor}`;
            badge.title = `${info.name} — Q${info.quartile}`;
            el.appendChild(badge);
        }
    });
}

/* ===== PDF Export ===== */
function generatePDF() {
    const style = document.createElement('style');
    style.id = 'print-stylesheet';
    style.textContent = `
        @page { margin: 1.5cm; }
        body { background: white !important; color: black !important; font-family: Georgia, 'Times New Roman', serif !important; }
        * { background: white !important; color: black !important; box-shadow: none !important; text-shadow: none !important; }
        #milky-way, #nebula, #star-field, #moon, .rec-section, .footer, #theme-toggle,
        .search-form, #search-form, .loading, .header-btn, .theme-toggle, .bookmark-btn,
        .save-collection-btn, .result-link, .bibtex-btn, .cited-by-btn, .similar-btn,
        .citation-graph-btn, .sort-controls, .export-bibtex-btn, .export-ris-btn,
        .export-csv-btn, .export-pdf-btn, #export-pdf-btn, #ai-overview,
        #citation-graph, .citation-graph, .recommended-section, .similar-section,
        #bookmarks-bar, .bookmarks-bar, #collections-panel, #history-panel,
        .slide-down-panel, #rec-ticker-track, .rec-ticker-wrapper, .rec-header,
        .rec-chip, .rec-ticker-track, #rec-shuffle, .rec-section,
        .author-tooltip, .shortcuts-overlay, .shortcuts-modal, .back-link,
        .filter-chip, .year-chip, .topic-chip, #filter-input, .active-filter-bar,
        #source-filters, #year-filter, .load-more, .empty-state, button {
            display: none !important;
        }
        .container { max-width: 100% !important; padding: 0 !important; }
        .header { padding: 20px 0 10px !important; }
        .logo { font-family: Georgia, serif !important; font-size: 1.8rem !important; color: #000 !important; }
        .logo-accent { background: none !important; -webkit-text-fill-color: #000 !important; color: #000 !important; }
        .tagline { color: #444 !important; font-size: 0.9rem !important; }
        .refine-bar { display: none !important; }
        .results-header { margin-bottom: 12px !important; }
        .results-count { color: #444 !important; font-size: 0.9rem !important; }
        .results-grid { gap: 16px !important; }
        .result-card { background: white !important; border: 1px solid #ccc !important; border-radius: 4px !important; padding: 16px 20px !important; page-break-inside: avoid !important; }
        .result-card::before { display: none !important; }
        .result-title { font-size: 1.1rem !important; font-weight: 700 !important; }
        .result-title a { color: #1a0dab !important; text-decoration: underline !important; }
        .result-meta { font-size: 0.82rem !important; color: #444 !important; }
        .result-authors { color: #444 !important; }
        .result-year { color: #666 !important; background: none !important; }
        .source-badge { background: transparent !important; padding: 0 !important; }
        .type-badge { background: transparent !important; padding: 0 !important; color: #666 !important; }
        .result-abstract { color: #222 !important; font-size: 0.85rem !important; }
        .result-stats { color: #666 !important; }
        .stat-item { color: #666 !important; }
        #milky-way, #nebula, #star-field, #dust-canvas { display: none !important; }
        h1, h2, h3, h4 { color: black !important; }
        a { color: #1a0dab !important; }
        .print-title { font-family: Georgia, serif; font-size: 1.4rem; font-weight: 700; margin-bottom: 4px; }
        .print-subtitle { font-size: 0.85rem; color: #444; margin-bottom: 16px; }
        .print-overview { margin-bottom: 16px; padding: 12px; border: 1px solid #ddd; border-radius: 4px; }
        .print-overview-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; }
        .print-overview-text { font-size: 0.85rem; line-height: 1.5; }
        .wiki-card { display: none !important; }
        .header-content { text-align: left !important; }
        .logo-icon { display: none !important; }
        a[href]::after { content: \" (\" attr(href) \")\"; font-size: 0.75rem; color: #666; }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
}

/* ===== Infinite Scroll ===== */
let _scrollTimeout = null;
window.addEventListener('scroll', () => {
    if (_scrollTimeout) return;
    _scrollTimeout = setTimeout(() => {
        _scrollTimeout = null;
        const indicator = document.getElementById('load-more-indicator');
        if (!indicator) return;
        const rect = indicator.getBoundingClientRect();
        if (rect.top < window.innerHeight + 100) {
            const remaining = state.filteredResults.length - state.displayedCount;
            if (remaining > 0) { state.displayedCount += Math.min(12, remaining); applyAllFilters(); }
        }
    }, 100);
}, { passive: true });

/* ===== Keyboard Navigation ===== */
document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const cards = document.querySelectorAll('.result-card');
    if (e.key === 'j' && cards.length) { e.preventDefault(); cards.forEach(c => c.classList.remove('selected')); state.selectedIndex = Math.min(state.selectedIndex + 1, cards.length - 1); cards[state.selectedIndex].classList.add('selected'); cards[state.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else if (e.key === 'k' && cards.length) { e.preventDefault(); cards.forEach(c => c.classList.remove('selected')); state.selectedIndex = Math.max(state.selectedIndex - 1, 0); cards[state.selectedIndex].classList.add('selected'); cards[state.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else if (e.key === 'Enter' && state.selectedIndex >= 0 && cards[state.selectedIndex]) { const link = cards[state.selectedIndex].querySelector('.result-link-title') || cards[state.selectedIndex].querySelector('.result-link'); if (link) link.click(); }
});

/* ===== Event Listeners ===== */
DOM.form.addEventListener('submit', (e) => { e.preventDefault(); const q = DOM.input.value.trim(); if (!q) return; clearAllFilters(); doSearch(q); });
document.querySelectorAll('.filter-chip').forEach(chip => chip.addEventListener('click', () => { state.activeFilter = chip.dataset.filter; state.displayedCount = 12; applyAllFilters(); }));
document.querySelectorAll('.year-chip').forEach(chip => chip.addEventListener('click', () => { state.activeYearRange = chip.dataset.years; state.displayedCount = 12; applyAllFilters(); }));
DOM.clearAllBtn.addEventListener('click', clearAllFilters);
DOM.recShuffle.addEventListener('click', () => { state.currentRecs = generateRecs(); renderRecs(state.currentRecs); });
document.querySelectorAll('.empty-suggestion').forEach(chip => chip.addEventListener('click', () => { DOM.input.value = chip.dataset.query; clearAllFilters(); doSearch(chip.dataset.query); }));

document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); DOM.input.focus(); }
});

if (DOM.themeToggle) DOM.themeToggle.addEventListener('click', toggleTheme);

// Auth event listeners
if (DOM.loginBtn) DOM.loginBtn.addEventListener('click', () => openAuthModal(false));
if (DOM.registerBtn) DOM.registerBtn.addEventListener('click', () => openAuthModal(true));
if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', logoutUser);
if (DOM.authForm) DOM.authForm.addEventListener('submit', handleAuthSubmit);
if (DOM.authModalClose) DOM.authModalClose.addEventListener('click', closeAuthModal);
if (DOM.authModal) DOM.authModal.addEventListener('click', (e) => { if (e.target === DOM.authModal) closeAuthModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && DOM.authModal && !DOM.authModal.classList.contains('hidden')) closeAuthModal(); });

// Trending event listeners
if (DOM.trendingBtn) DOM.trendingBtn.addEventListener('click', toggleTrending);
if (DOM.trendingClose) DOM.trendingClose.addEventListener('click', () => hide(DOM.trendingSection));

/* ===== Custom Query Runner ===== */
const DOM_QR = {
    section: document.getElementById('query-runner-section'),
    btn: document.getElementById('query-runner-btn'),
    close: document.getElementById('query-runner-close'),
    submit: document.getElementById('query-runner-submit'),
    source: document.getElementById('query-runner-source'),
    query: document.getElementById('query-runner-query'),
    max: document.getElementById('query-runner-max'),
    sort: document.getElementById('query-runner-sort'),
    output: document.getElementById('query-runner-output'),
};

function toggleQueryRunner() {
    if (!DOM_QR.section) return;
    const isHidden = DOM_QR.section.classList.contains('hidden');
    if (isHidden) {
        DOM_QR.section.classList.remove('hidden');
    } else {
        DOM_QR.section.classList.add('hidden');
    }
}

async function runQueryRunner() {
    if (!DOM_QR.submit || !DOM_QR.output) return;
    const source = DOM_QR.source.value;
    const query = DOM_QR.query.value.trim();
    const maxResults = parseInt(DOM_QR.max.value) || 10;
    const sortBy = DOM_QR.sort.value;

    if (!query) {
        DOM_QR.output.innerHTML = '<pre style="color:var(--rose)">Error: Please enter a query string.</pre>';
        return;
    }

    DOM_QR.submit.disabled = true;
    DOM_QR.submit.textContent = 'Querying...';
    DOM_QR.output.innerHTML = '<pre style="color:var(--text-dim)">Running query...</pre>';

    try {
        const params = new URLSearchParams({ source, query, max_results: maxResults, sort_by: sortBy });
        const resp = await fetch(`/api/custom-query?${params.toString()}`);
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const data = await resp.json();
        const formatted = JSON.stringify(data, null, 2);
        DOM_QR.output.innerHTML = `<pre>${escapeHtml(formatted)}</pre>`;
    } catch (e) {
        DOM_QR.output.innerHTML = `<pre style="color:var(--rose)">Error: ${escapeHtml(e.message)}</pre>`;
    } finally {
        DOM_QR.submit.disabled = false;
        DOM_QR.submit.textContent = 'Run Query';
    }
}

if (DOM_QR.btn) DOM_QR.btn.addEventListener('click', toggleQueryRunner);
if (DOM_QR.close) DOM_QR.close.addEventListener('click', () => hide(DOM_QR.section));
if (DOM_QR.submit) DOM_QR.submit.addEventListener('click', runQueryRunner);
if (DOM_QR.query) DOM_QR.query.addEventListener('keydown', (e) => { if (e.key === 'Enter') runQueryRunner(); });

// Auto-search debounce
let _debounceTimer = null;
DOM.input.addEventListener('keyup', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => { const q = DOM.input.value.trim(); if (q && q !== state.query) { clearAllFilters(); doSearch(q); } }, 200);
});

// Filter within results
let _filterTimer = null;
DOM.filterInput.addEventListener('keyup', () => {
    clearTimeout(_filterTimer);
    _filterTimer = setTimeout(() => { state.filterQuery = DOM.filterInput.value; state.displayedCount = 12; applyAllFilters(); }, 150);
});

// Shortcuts modal
document.addEventListener('keydown', function showShortcuts(e) {
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        const existing = document.querySelector('.shortcuts-overlay');
        if (existing) { existing.remove(); document.querySelector('.shortcuts-modal')?.remove(); return; }
        const overlay = document.createElement('div'); overlay.className = 'shortcuts-overlay';
        const modal = document.createElement('div'); modal.className = 'shortcuts-modal';
        modal.innerHTML = `<h3>⌨️ Keyboard Shortcuts</h3><div class=\"shortcuts-grid\">
            <div class=\"shortcut-row\"><span class=\"shortcut-key\">/</span><span class=\"shortcut-desc\">Focus search</span></div>
            <div class=\"shortcut-row\"><span class=\"shortcut-key\">j</span><span class=\"shortcut-desc\">Next result</span></div>
            <div class=\"shortcut-row\"><span class=\"shortcut-key\">k</span><span class=\"shortcut-desc\">Previous result</span></div>
            <div class=\"shortcut-row\"><span class=\"shortcut-key\">Enter</span><span class=\"shortcut-desc\">Open selected</span></div>
            <div class=\"shortcut-row\"><span class=\"shortcut-key\">?</span><span class=\"shortcut-desc\">Toggle this help</span></div>
            <div class=\"shortcut-row\"><span class=\"shortcut-key\">Esc</span><span class=\"shortcut-desc\">Close</span></div>
        </div><div class=\"shortcuts-close-hint\">Press Esc or ? to close</div>`;
        document.body.appendChild(overlay); document.body.appendChild(modal);
        const close = () => { overlay.remove(); modal.remove(); };
        overlay.addEventListener('click', close);
        const handler = (ev) => { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); } };
        document.addEventListener('keydown', handler);
    }
});

let exportPdfBtn = document.getElementById('export-pdf-btn');
if (exportPdfBtn) exportPdfBtn.addEventListener('click', generatePDF);

/* ===== Export All BibTeX (combined) ===== */
function exportAllBibtex() {
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.allResults;
    if (!results || results.length === 0) return;
    const bib = results.map(r => generateBibtex(r)).join('\n\n');
    const blob = new Blob([bib], { type: 'application/x-bibtex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholarsift_${(state.query || 'export').replace(/\s+/g, '_')}.bib`;
    a.click();
    URL.revokeObjectURL(url);
    const btn = document.getElementById('export-all-bibtex');
    if (btn) { btn.textContent = '✓ Exported!'; btn.classList.add('exported'); setTimeout(() => { btn.textContent = '📋 Export All BibTeX'; btn.classList.remove('exported'); }, 2000); }
}
const exportAllBibtexBtn = document.getElementById('export-all-bibtex');
if (exportAllBibtexBtn) exportAllBibtexBtn.addEventListener('click', exportAllBibtex);

/* ===== Server-Side PDF Export ===== */
async function downloadServerPDF() {
    const results = state.filteredResults.length > 0 ? state.filteredResults : state.allResults;
    if (!results || results.length === 0) return;
    const resultsEncoded = encodeURIComponent(JSON.stringify(results));
    const queryEncoded = encodeURIComponent(state.query || 'results');
    const btn = document.getElementById('export-pdf-btn');
    if (btn) { btn.textContent = '⏳ Generating PDF...'; btn.disabled = true; }
    try {
        const resp = await fetch(`/api/export-pdf?q=${queryEncoded}&results_json=${resultsEncoded}`);
        if (!resp.ok) throw new Error('PDF generation failed');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scholarsift_${(state.query || 'export').replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        if (btn) { btn.textContent = '✓ PDF Downloaded!'; btn.classList.add('exported'); }
    } catch (e) {
        console.error('[PDF Export]', e);
        if (btn) { btn.textContent = '❌ Failed'; }
    } finally {
        if (btn) { setTimeout(() => { btn.textContent = '📕 Export PDF'; btn.classList.remove('exported'); btn.disabled = false; }, 3000); }
    }
}

/* ===== Multi-Language Search ===== */
const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
];

let currentLang = 'en';
let langPickerContainer = null;

function createLanguagePicker() {
    if (langPickerContainer) return;
    const searchSection = document.querySelector('.search-section');
    if (!searchSection) return;

    langPickerContainer = document.createElement('div');
    langPickerContainer.className = 'language-picker-wrapper';

    const select = document.createElement('select');
    select.id = 'lang-select';
    select.className = 'lang-select';
    LANGUAGES.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = `${l.flag} ${l.name}`;
        select.appendChild(opt);
    });

    select.addEventListener('change', async () => {
        const newLang = select.value;
        if (newLang === 'en') {
            currentLang = 'en';
            if (DOM.input.value.trim()) {
                clearAllFilters();
                doSearch(DOM.input.value.trim());
            }
            return;
        }
        const currentQuery = DOM.input.value.trim();
        if (!currentQuery) return;
        try {
            const resp = await fetch(`/api/translate?text=${encodeURIComponent(currentQuery)}&target=${newLang}`);
            if (resp.ok) {
                const data = await resp.json();
                currentLang = newLang;
                const translated = data.translated_text;
                if (translated && translated !== currentQuery) {
                    DOM.input.value = translated;
                    clearAllFilters();
                    doSearch(translated);
                }
            }
        } catch (e) {
            console.error('[Translate]', e);
        }
    });

    langPickerContainer.appendChild(select);
    searchSection.querySelector('.search-form').after(langPickerContainer);
}

/* ===== Real-Time Collaboration via WebSocket ===== */
let ws = null;
let wsConnected = false;
let wsReconnectTimer = null;

function createWsIndicator() {
    let indicator = document.getElementById('ws-status');
    if (!indicator) {
        indicator = document.createElement('span');
        indicator.id = 'ws-status';
        indicator.className = 'ws-status ws-disconnected';
        indicator.title = 'Real-time collaboration: disconnected';
        indicator.textContent = '⚫';
        const headerRight = document.querySelector('.header-right');
        if (headerRight) headerRight.prepend(indicator);
    }
}

function connectWebSocket(room) {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const token = state.token;
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'join', room, token }));
        };
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'connected') {
                    wsConnected = true;
                    const indicator = document.getElementById('ws-status');
                    if (indicator) {
                        indicator.className = 'ws-status ws-connected';
                        indicator.title = `Real-time: connected to \"${msg.room}\" (${(msg.users || []).length} user(s))`;
                        indicator.textContent = '🟢';
                    }
                    console.log(`[WS] Connected to room \"${msg.room}\" as ${msg.username}`);
                } else if (msg.type === 'user_joined' || msg.type === 'user_left') {
                    const indicator = document.getElementById('ws-status');
                    if (indicator) {
                        indicator.title = `Real-time: ${(msg.users || []).length} user(s) in room`;
                    }
                } else if (msg.type === 'paper_added') {
                    console.log(`[WS] ${msg.username} added paper:`, msg.paper);
                } else if (msg.type === 'paper_removed') {
                    console.log(`[WS] ${msg.username} removed paper: ${msg.paper_url}`);
                } else if (msg.type === 'pong') {
                } else if (msg.type === 'error') {
                    console.warn('[WS] Server error:', msg.message);
                }
            } catch (e) { /* ignore */ }
        };
        ws.onclose = () => {
            wsConnected = false;
            const indicator = document.getElementById('ws-status');
            if (indicator) {
                indicator.className = 'ws-status ws-disconnected';
                indicator.title = 'Real-time: disconnected';
                indicator.textContent = '⚫';
            }
            if (room && state.token) {
                clearTimeout(wsReconnectTimer);
                wsReconnectTimer = setTimeout(() => connectWebSocket(room), 5000);
            }
        };
        ws.onerror = () => { wsConnected = false; };
    } catch (e) {
        console.warn('[WS] Connection error:', e);
    }
}

function disconnectWebSocket() {
    clearTimeout(wsReconnectTimer);
    if (ws) { ws.close(); ws = null; }
    wsConnected = false;
    const indicator = document.getElementById('ws-status');
    if (indicator) {
        indicator.className = 'ws-status ws-disconnected';
        indicator.title = 'Real-time: disconnected';
        indicator.textContent = '⚫';
    }
}

/* ===== Offline Detection & PWA ===== */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('[SW] Registered:', reg.scope);
        }).catch(err => {
            console.warn('[SW] Registration failed:', err);
        });
    }
}

function createOfflineBanner() {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner hidden';
    banner.innerHTML = '📡 You\'re offline — showing cached results';
    const container = document.querySelector('.container');
    if (container) container.prepend(banner);
}

function handleOfflineStatus() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    function update() {
        if (!navigator.onLine) {
            banner.classList.remove('hidden');
            if (DOM.searchBtn) DOM.searchBtn.disabled = true;
        } else {
            banner.classList.add('hidden');
            if (DOM.searchBtn) DOM.searchBtn.disabled = false;
        }
    }

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

// Nebula parallax
window.addEventListener('scroll', () => {
    document.documentElement.style.setProperty('--scroll-y', window.scrollY + 'px');
}, { passive: true });

// Collections/History panel wiring
setTimeout(() => {
    const collectionsBtn = document.getElementById('collections-btn');
    const collectionsPanel = document.getElementById('collections-panel');
    const collectionsClose = document.getElementById('collections-panel-close');
    if (collectionsBtn && collectionsPanel) {
        collectionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = collectionsPanel.classList.contains('hidden');
            const hp = document.getElementById('history-panel');
            if (hp) hp.classList.add('hidden');
            if (isHidden) { renderCollectionsPanel(); collectionsPanel.classList.remove('hidden'); setTimeout(() => document.addEventListener('click', closeCollections), 10); }
            else { collectionsPanel.classList.add('hidden'); }
        });
    }
    function closeCollections(e) {
        const panel = document.getElementById('collections-panel');
        if (panel && !panel.contains(e.target) && e.target !== collectionsBtn) { panel.classList.add('hidden'); document.removeEventListener('click', closeCollections); }
    }
    if (collectionsClose && collectionsPanel) collectionsClose.addEventListener('click', () => { collectionsPanel.classList.add('hidden'); document.removeEventListener('click', closeCollections); });

    const historyBtn = document.getElementById('history-btn');
    const historyPanel = document.getElementById('history-panel');
    const historyClose = document.getElementById('history-panel-close');
    if (historyBtn && historyPanel) {
        historyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = historyPanel.classList.contains('hidden');
            const cp = document.getElementById('collections-panel');
            if (cp) cp.classList.add('hidden');
            if (isHidden) { renderHistoryPanel(); historyPanel.classList.remove('hidden'); setTimeout(() => document.addEventListener('click', closeHistory), 10); }
            else { historyPanel.classList.add('hidden'); }
        });
    }
    function closeHistory(e) {
        const panel = document.getElementById('history-panel');
        if (panel && !panel.contains(e.target) && e.target !== historyBtn) { panel.classList.add('hidden'); document.removeEventListener('click', closeHistory); }
    }
    if (historyClose && historyPanel) historyClose.addEventListener('click', () => { historyPanel.classList.add('hidden'); document.removeEventListener('click', closeHistory); });

    // Export buttons (lazy — RIS and CSV)
    const exportRisBtn = document.getElementById('export-ris-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportRisBtn) exportRisBtn.addEventListener('click', () => {
        const results = state.filteredResults.length > 0 ? state.filteredResults : state.allResults;
        if (!results || results.length === 0) return;
        let ris = results.map(r => {
            const ty = (r.type || '').toLowerCase().includes('journal') || (r.type || '').toLowerCase().includes('article') ? 'JOUR' : (r.type || '').toLowerCase().includes('book') ? 'BOOK' : 'GEN';
            let entry = `TY  - ${ty}\nTI  - ${r.title}\n`;
            (r.authors || []).forEach(a => { entry += `AU  - ${a}\n`; });
            if (r.year) entry += `PY  - ${r.year}\n`;
            if (r.url) entry += `UR  - ${r.url}\n`;
            entry += `ER  - \n`;
            return entry;
        }).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ris], {type: 'text/plain'})); a.download = `scholarsift_${state.query || 'export'}.ris`; a.click(); URL.revokeObjectURL(a.href);
        exportRisBtn.textContent = '✓ Exported!'; setTimeout(() => exportRisBtn.textContent = '📋 Export RIS', 2000);
    });
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => {
        const results = state.filteredResults.length > 0 ? state.filteredResults : state.allResults;
        if (!results || results.length === 0) return;
        let csv = 'Title,Authors,Year,Source,URL\n';
        results.forEach(r => {
            const authors = (r.authors || []).join('; ');
            csv += `"${(r.title||'').replace(/\"/g,'\"\"')}","${authors}","${r.year||''}","${r.source||''}","${r.url||''}"\n`;
        });
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'})); a.download = `scholarsift_${state.query || 'export'}.csv`; a.click(); URL.revokeObjectURL(a.href);
        exportCsvBtn.textContent = '✓ Exported!'; setTimeout(() => exportCsvBtn.textContent = '📋 Export CSV', 2000);
    });
}, 500);

/* ===== Init ===== */
state.currentRecs = generateRecs();
renderRecs(state.currentRecs);
updateBookmarksBar();
applySavedTheme();
updateAuthUI();
renderFilterPresets();
createLanguagePicker();
createWsIndicator();
createOfflineBanner();
handleOfflineStatus();
registerServiceWorker();

if (state.token) {
    syncData();
    setTimeout(() => connectWebSocket('collection:default'), 2000);
}

if (document.getElementById('export-pdf-btn')) {
    document.getElementById('export-pdf-btn').addEventListener('click', downloadServerPDF);
}

/* ===== Chat Assistant ===== */
function toggleChat() {
    const panel = DOM.chatAssistant;
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
        DOM.chatToggle.textContent = '💬 Ask AI';
    } else {
        panel.classList.remove('hidden');
        panel.classList.add('open');
        DOM.chatToggle.textContent = '✕ Close';
        setTimeout(() => DOM.chatInput.focus(), 350);
    }
}

function getSearchContext() {
    return {
        query: state.query || '',
        results_summary: state.allResults.slice(0, 15).map(r => r.title || 'Untitled'),
    };
}

function addChatMessage(role, text) {
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    const ts = document.createElement('div');
    ts.className = 'chat-timestamp';
    ts.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.appendChild(ts);
    DOM.chatMessages.appendChild(div);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function showChatThinking() {
    const div = document.createElement('div');
    div.className = 'chat-message assistant';
    div.id = 'chat-thinking';
    div.innerHTML = '<div class=\"chat-thinking\"><span class=\"chat-thinking-dot\">●</span><span class=\"chat-thinking-dot\">●</span><span class=\"chat-thinking-dot\">●</span></div>';
    DOM.chatMessages.appendChild(div);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function hideChatThinking() {
    const el = document.getElementById('chat-thinking');
    if (el) el.remove();
}

async function sendChatMessage(text) {
    if (!text || !text.trim()) return;
    addChatMessage('user', text.trim());
    DOM.chatInput.value = '';
    DOM.chatSendBtn.disabled = true;
    showChatThinking();

    try {
        const messages = [];
        document.querySelectorAll('.chat-message .chat-bubble').forEach(b => {
            const parent = b.closest('.chat-message');
            if (parent) {
                const role = parent.classList.contains('user') ? 'user' : 'assistant';
                messages.push({ role, content: b.textContent });
            }
        });

        const context = getSearchContext();
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, context }),
        });
        hideChatThinking();
        if (!resp.ok) throw new Error('Chat request failed');
        const data = await resp.json();
        addChatMessage('assistant', data.response || 'No response');
    } catch (e) {
        hideChatThinking();
        addChatMessage('assistant', 'Sorry, I had trouble processing that. Please try again.');
        console.error('[Chat]', e);
    } finally {
        DOM.chatSendBtn.disabled = false;
        DOM.chatInput.focus();
    }
}

if (DOM.chatToggle) {
    DOM.chatToggle.addEventListener('click', toggleChat);
}
if (DOM.chatClose) {
    DOM.chatClose.addEventListener('click', toggleChat);
}
if (DOM.chatSendBtn) {
    DOM.chatSendBtn.addEventListener('click', () => sendChatMessage(DOM.chatInput.value));
}
if (DOM.chatInput) {
    DOM.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage(DOM.chatInput.value);
    });
}

/* ===== Research Timeline ===== */
let _timelineData = null;

async function renderTimeline(query) {
    const section = DOM.timelineSection;
    const canvas = DOM.timelineCanvas;
    if (!section || !canvas) return;
    section.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth || 700;
    const H = canvas.height = 120;

    ctx.fillStyle = 'rgba(212,168,68,0.05)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#6a5a40';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Loading timeline...', W / 2, H / 2);

    try {
        const resp = await fetch(`/api/timeline?q=${encodeURIComponent(query)}`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        _timelineData = data;
        drawTimeline(ctx, W, H, data);
    } catch (e) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#6a5a40';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Could not load timeline', W / 2, H / 2);
    }
}

function drawTimeline(ctx, W, H, data) {
    ctx.clearRect(0, 0, W, H);
    const years = data.years || [];
    if (!years.length) {
        ctx.fillStyle = '#6a5a40';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No timeline data available', W / 2, H / 2);
        return;
    }
    const pad = 40;
    const availW = W - pad * 2;
    const yLine = H * 0.65;
    const maxCount = Math.max(...years.map(y => y.count), 1);
    const maxCitation = Math.max(...years.map(y => y.max_citation), 1);

    ctx.strokeStyle = 'rgba(212,168,68,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, yLine);
    ctx.lineTo(W - pad, yLine);
    ctx.stroke();

    years.forEach((y, i) => {
        const x = pad + (i / Math.max(years.length - 1, 1)) * availW;
        const radius = 4 + (y.count / maxCount) * 14;
        const intensity = y.max_citation / maxCitation;

        const grad = ctx.createRadialGradient(x, yLine, 0, x, yLine, radius + 8);
        grad.addColorStop(0, `rgba(212,168,68,${0.15 + intensity * 0.25})`);
        grad.addColorStop(1, 'rgba(212,168,68,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, yLine, radius + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(212,168,68,${0.5 + intensity * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, yLine, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#6a5a40';
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(y.year, x, yLine + radius + 4);

        ctx.fillStyle = 'rgba(212,168,68,0.5)';
        ctx.font = '8px Inter';
        ctx.textBaseline = 'bottom';
        ctx.fillText(y.count, x, yLine - radius - 2);
    });

    canvas._timelineData = years;
    canvas._timelinePositions = years.map((y, i) => ({
        x: pad + (i / Math.max(years.length - 1, 1)) * availW,
        y: yLine,
        radius: 4 + (y.count / maxCount) * 14,
        year: y.year,
    }));

    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const positions = canvas._timelinePositions || [];
        const clicked = positions.find(p => Math.hypot(p.x - mx, p.y - my) < p.radius + 5);
        if (clicked && clicked.year && clicked.year !== 'Unknown') {
            state.activeYearRange = `${clicked.year}-${clicked.year}`;
            state.displayedCount = 12;
            applyAllFilters();
            section.classList.add('hidden');
        }
    };
}

if (DOM.timelineBtn) {
    DOM.timelineBtn.addEventListener('click', () => {
        if (state.query) renderTimeline(state.query);
    });
}
if (DOM.timelineClose) {
    DOM.timelineClose.addEventListener('click', () => {
        DOM.timelineSection.classList.add('hidden');
    });
}

/* ===== Co-Author Network Graph ===== */
let _coauthorAnim = null;

async function renderCoauthorGraph(authorName) {
    const container = DOM.coauthorGraph;
    const canvas = DOM.coauthorGraphCanvas;
    if (!container || !canvas) return;
    container.classList.remove('hidden');
    const titleEl = container.querySelector('.coauthor-graph-title');
    if (titleEl) titleEl.textContent = `👥 Co-author Network: ${authorName}`;

    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth || 800;
    const H = canvas.height = 400;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#6a5a40';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Loading co-author network...', W / 2, H / 2);

    try {
        const resp = await fetch(`/api/coauthor-graph?author=${encodeURIComponent(authorName)}`);
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        if (!data.nodes || data.nodes.length < 2) {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#6a5a40';
            ctx.font = '13px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No co-author data found for this author', W / 2, H / 2);
            return;
        }

        const nodes = data.nodes.map(n => ({
            ...n,
            x: n.is_center ? W / 2 : W / 2 + (Math.random() - 0.5) * W * 0.6,
            y: n.is_center ? H / 2 : H / 2 + (Math.random() - 0.5) * H * 0.6,
            vx: 0, vy: 0,
        }));
        const edges = data.edges || [];
        const centerNode = nodes.find(n => n.is_center) || nodes[0];
        if (centerNode) { centerNode.x = W / 2; centerNode.y = H / 2; }

        function simulate() {
            for (let iter = 0; iter < 20; iter++) {
                for (const n of nodes) {
                    if (n.is_center) continue;
                    const dx = W / 2 - n.x;
                    const dy = H / 2 - n.y;
                    n.vx += dx * 0.003;
                    n.vy += dy * 0.003;
                }
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const a = nodes[i], b = nodes[j];
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        if (dist < 180) {
                            const force = 3 / (dist + 1);
                            a.vx += dx / dist * force;
                            a.vy += dy / dist * force;
                            b.vx -= dx / dist * force;
                            b.vy -= dy / dist * force;
                        }
                    }
                }
                for (const e of edges) {
                    const a = nodes.find(n => n.id === e.source);
                    const b = nodes.find(n => n.id === e.target);
                    if (a && b) {
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        const spring = (dist - 100) * 0.008;
                        a.vx -= dx / dist * spring;
                        a.vy -= dy / dist * spring;
                        b.vx += dx / dist * spring;
                        b.vy += dy / dist * spring;
                    }
                }
                for (const n of nodes) {
                    if (n.is_center) continue;
                    n.vx *= 0.88;
                    n.vy *= 0.88;
                    n.x += n.vx;
                    n.y += n.vy;
                    n.x = Math.max(40, Math.min(W - 40, n.x));
                    n.y = Math.max(40, Math.min(H - 40, n.y));
                }
            }
            drawGraph();
        }

        function drawGraph() {
            ctx.clearRect(0, 0, W, H);

            const maxWeight = Math.max(...edges.map(e => e.weight || 1), 1);
            for (const e of edges) {
                const a = nodes.find(n => n.id === e.source);
                const b = nodes.find(n => n.id === e.target);
                if (a && b) {
                    const thickness = 0.5 + ((e.weight || 1) / maxWeight) * 3;
                    ctx.strokeStyle = `rgba(212,168,68,${0.08 + ((e.weight || 1) / maxWeight) * 0.2})`;
                    ctx.lineWidth = thickness;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }

            for (const n of nodes) {
                if (n.is_center) {
                    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 45);
                    grad.addColorStop(0, 'rgba(212,168,68,0.3)');
                    grad.addColorStop(1, 'rgba(212,168,68,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 45, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#d4a844';
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(212,168,68,0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 24, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(n.label.substring(0, 30), n.x, n.y + 26);
                } else {
                    const radius = Math.max(6, Math.min(n.size || 10, 20));

                    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius + 8);
                    grad.addColorStop(0, 'rgba(110,231,183,0.12)');
                    grad.addColorStop(1, 'rgba(110,231,183,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius + 8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = `rgba(110,231,183,${0.4 + (n.size || 10) / 40})`;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#b0d8c8';
                    ctx.font = '9px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(n.label.substring(0, 25), n.x, n.y + radius + 3);

                    if (n.paper_count > 1) {
                        ctx.fillStyle = 'rgba(212,168,68,0.4)';
                        ctx.font = '7px Inter';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(`${n.paper_count}p`, n.x + radius + 2, n.y - radius - 1);
                    }
                }
            }
        }

        simulate();

        canvas.onclick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const clicked = nodes.find(n => {
                const radius = n.is_center ? 24 : Math.max(8, Math.min(n.size || 10, 20));
                return Math.hypot(n.x - mx, n.y - my) < radius + 5;
            });
            if (clicked && !clicked.is_center && clicked.label) {
                DOM.input.value = clicked.label;
                clearAllFilters();
                doSearch(clicked.label);
                container.classList.add('hidden');
            }
        };
    } catch (e) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#8a78b0';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading co-author graph', W / 2, H / 2);
        console.error('[CoAuthorGraph]', e);
    }
}

if (DOM.coauthorBtn) {
    DOM.coauthorBtn.addEventListener('click', () => {
        if (state.query) renderCoauthorGraph(state.query);
    });
}
if (DOM.coauthorGraphClose) {
    DOM.coauthorGraphClose.addEventListener('click', () => {
        DOM.coauthorGraph.classList.add('hidden');
    });
}

/* ===== Full-Text Search Within Saved Papers ===== */
async function fetchFullText(pdfUrl, paperUrl, paperTitle) {
    try {
        const resp = await fetch(`https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(paperUrl)}?fields=title,tldr,abstract`);
        if (!resp.ok) throw new Error('Not found');
        const data = await resp.json();
        let text = '';
        if (data.tldr && data.tldr.text) text += data.tldr.text + ' ';
        if (data.abstract) text += data.abstract;
        if (text.length > 10) {
            const fullTexts = JSON.parse(localStorage.getItem('scholarsift_full_texts') || '{}');
            fullTexts[paperUrl] = text;
            localStorage.setItem('scholarsift_full_texts', JSON.stringify(fullTexts));
            return text;
        }
        return null;
    } catch (e) { return null; }
}

function addFetchFullTextButtons() {
    document.querySelectorAll('.save-collection-btn').forEach(btn => {
        const url = btn.dataset.url;
        if (url && !btn.dataset._fulltextAdded) {
            btn.dataset._fulltextAdded = '1';
            const card = btn.closest('.result-card');
            if (!card) return;
            const pdfBtn = card.querySelector('.pdf-viewer-btn');
            const hasPdf = pdfBtn && pdfBtn.dataset.pdfUrl;

            if (hasPdf) {
                const fetchBtn = document.createElement('button');
                fetchBtn.className = 'fetch-fulltext-btn';
                fetchBtn.textContent = '📥 Fetch full text';
                fetchBtn.dataset.url = url;
                fetchBtn.dataset.pdfUrl = pdfBtn.dataset.pdfUrl;
                fetchBtn.dataset.title = btn.dataset.title;
                fetchBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    fetchBtn.textContent = '⏳ Fetching...';
                    fetchBtn.disabled = true;
                    const text = await fetchFullText(fetchBtn.dataset.pdfUrl, url, fetchBtn.dataset.title);
                    if (text) {
                        fetchBtn.textContent = '✅ Full text saved';
                        setTimeout(() => fetchBtn.textContent = '📥 Fetch full text', 3000);
                    } else {
                        fetchBtn.textContent = '❌ No full text';
                        setTimeout(() => fetchBtn.textContent = '📥 Fetch full text', 3000);
                    }
                    fetchBtn.disabled = false;
                });
                btn.parentNode.insertBefore(fetchBtn, btn.nextSibling);
            }
        }
    });
}

function searchSavedPapers(query) {
    if (!query || !query.trim()) {
        DOM.collectionsSearchResults.innerHTML = '';
        DOM.collectionsSearchResults.classList.add('hidden');
        return;
    }
    const q = query.toLowerCase().trim();
    const fullTexts = JSON.parse(localStorage.getItem('scholarsift_full_texts') || '{}');
    const notes = JSON.parse(localStorage.getItem('scholarsift_collection_notes') || '{}');
    const results = [];
    const seen = new Set();

    state.collections.forEach(col => {
        (col.papers || []).forEach(p => {
            if (seen.has(p.url)) return;
            let matched = false;
            let matchText = '';

            if ((p.title || '').toLowerCase().includes(q)) {
                matched = true;
                matchText = 'Title match';
            }
            const note = notes[p.url] || '';
            if (note.toLowerCase().includes(q)) {
                matched = true;
                matchText = matchText ? 'Title + Notes match' : 'Notes match';
            }
            const ft = fullTexts[p.url] || '';
            if (ft.toLowerCase().includes(q)) {
                matched = true;
                matchText = matchText ? 'Title + Full text match' : 'Full text match';
            }

            if (matched) {
                seen.add(p.url);
                results.push({ ...p, collectionName: col.name, matchText });
            }
        });
    });

    if (results.length === 0) {
        DOM.collectionsSearchResults.innerHTML = '<div class="collections-search-result" style="color:var(--text-dim)">No matches found</div>';
    } else {
        DOM.collectionsSearchResults.innerHTML = results.map(r =>
            `<div class="collections-search-result" onclick="DOM.input.value='${escapeHtml(r.title)}';clearAllFilters();doSearch('${escapeHtml(r.title)}')" style="cursor:pointer">
                <div class="csr-title">${escapeHtml(r.title)}</div>
                <div class="csr-meta">
                    <span class="csr-collection">📁 ${escapeHtml(r.collectionName)}</span>
                    ${r.year ? ` · ${r.year}` : ''}
                    <span class="csr-match">${r.matchText}</span>
                </div>
            </div>`
        ).join('');
    }
    DOM.collectionsSearchResults.classList.remove('hidden');
}

if (DOM.collectionsSearchInput) {
    let _searchTimer = null;
    DOM.collectionsSearchInput.addEventListener('keyup', () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => searchSavedPapers(DOM.collectionsSearchInput.value), 200);
    });
}

// Consolidate all post-render patches into a single call
function _runPostRenderTasks() {
    addNoteIndicators();
    addRecBadges();
    renderCollectionRecommendations();
    addFetchFullTextButtons();
}

/* ===== Voice Search (lazy-init) ===== */
function initVoiceSearch() {
    const btn = document.getElementById('voice-search-btn');
    if (!btn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        btn.classList.add('hidden');
        return;
    }

    btn.classList.remove('hidden');

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let isListening = false;

    btn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }

        isListening = true;
        btn.classList.add('recording');
        btn.title = 'Listening...';

        try {
            recognition.start();
        } catch (e) {
            console.warn('[Voice] start error:', e);
        }
    });

    recognition.addEventListener('result', (event) => {
        const transcript = event.results[0][0].transcript;
        DOM.input.value = transcript;
        btn.classList.remove('recording');
        btn.classList.add('listening');
        btn.title = 'Heard: ' + transcript;
        isListening = false;

        setTimeout(() => {
            btn.classList.remove('listening');
            btn.title = 'Voice search';
            clearAllFilters();
            doSearch(transcript);
        }, 500);
    });

    recognition.addEventListener('error', (event) => {
        console.warn('[Voice] error:', event.error);
        btn.classList.remove('recording');
        btn.classList.remove('listening');
        btn.title = 'Voice search';
        isListening = false;

        if (event.error === 'not-allowed') {
            btn.classList.add('hidden');
        }
    });

    recognition.addEventListener('end', () => {
        btn.classList.remove('recording');
        isListening = false;
    });
}

/* ===== Animated RGB border via CSS custom property ===== */
(function animateBorder() {
    let angle = 0;
    const wrapper = document.querySelector('.search-input-wrapper');
    if (!wrapper) return;
    // Use requestAnimationFrame instead of setInterval for better performance
    let lastTime = 0;
    function frame(time) {
        if (time - lastTime >= 30) {
            angle = (angle + 1) % 360;
            wrapper.style.setProperty('--angle', angle + 'deg');
            lastTime = time;
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
