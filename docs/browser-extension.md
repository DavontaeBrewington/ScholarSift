# ScholarSift Browser Extension — Developer Guide

Build a Chrome extension that integrates with ScholarSift to detect academic pages, extract paper metadata, and save papers to your ScholarSift collections.

## Overview

The extension provides:
- **Page detection**: Automatically detects arXiv, PubMed, and Google Scholar pages.
- **Metadata extraction**: Extracts paper title, authors, year, abstract, and URL.
- **Quick save**: One-click save to ScholarSift collections.
- **Search integration**: Search your ScholarSift account directly from the extension popup.

## Prerequisites

- Chrome or any Chromium-based browser (Edge, Brave, Opera).
- A ScholarSift account (register at your ScholarSift instance).
- Basic familiarity with Chrome Extension Manifest V3.

## Files

### `manifest.json` — Extension manifest

```json
{
  "manifest_version": 3,
  "name": "ScholarSift — Academic Paper Saver",
  "version": "1.0.0",
  "description": "Save academic papers from arXiv, PubMed, and Google Scholar to your ScholarSift collections.",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://arxiv.org/*",
    "https://pubmed.ncbi.nlm.nih.gov/*",
    "https://scholar.google.com/*",
    "*://YOUR_SCHOLARSIFT_INSTANCE/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://arxiv.org/abs/*",
        "https://pubmed.ncbi.nlm.nih.gov/*",
        "https://scholar.google.com/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

> **Note**: Replace `YOUR_SCHOLARSIFT_INSTANCE` with the actual URL of your ScholarSift deployment.

### `background.js` — Service Worker

```javascript
// ScholarSift Extension — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ScholarSift] Extension installed');
});

// Listen for tab updates to show page action on academic sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isAcademic = /arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|scholar\.google\.com/.test(tab.url);
    if (isAcademic) {
      chrome.action.setIcon({
        tabId,
        path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
      });
    }
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_PAPER') {
    savePaperToScholarSift(message.paper, message.token)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_METADATA') {
    // Forward request to content script
    chrome.tabs.sendMessage(sender.tab.id, { type: 'EXTRACT_METADATA' }, sendResponse);
    return true;
  }
});

async function savePaperToScholarSift(paper, token) {
  const API_BASE = 'YOUR_SCHOLARSIFT_INSTANCE/api';

  // First, get or create a "Browser Extension" collection
  const collectionsResp = await fetch(`${API_BASE}/sync/collections?token=${encodeURIComponent(token)}`);
  const collectionsData = await collectionsResp.json();
  let targetCollection = collectionsData.collections.find(c => c.name === 'Browser Extension');

  if (!targetCollection) {
    // Create the collection
    await fetch(`${API_BASE}/sync/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        collections: [{ name: 'Browser Extension', papers: [paper] }]
      })
    });
  } else {
    // Add paper to existing collection
    targetCollection.papers.push(paper);
    const allCollections = collectionsData.collections.map(c => {
      if (c.id === targetCollection.id) return targetCollection;
      return c;
    });
    await fetch(`${API_BASE}/sync/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, collections: allCollections })
    });
  }

  return { collection: 'Browser Extension' };
}
```

### `content.js` — Content Script

```javascript
// ScholarSift Extension — Content Script
// Extracts paper metadata from academic pages

(function() {
  'use strict';

  // Listen for metadata extraction requests from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_METADATA') {
      const metadata = extractMetadata();
      sendResponse(metadata);
    }
  });

  // Auto-detect and send metadata to background on page load
  const metadata = extractMetadata();
  if (metadata) {
    chrome.runtime.sendMessage({
      type: 'PAGE_DETECTED',
      paper: metadata
    });
  }

  function extractMetadata() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    if (hostname.includes('arxiv.org')) {
      return extractArxivMetadata(url);
    }
    if (hostname.includes('pubmed.ncbi.nlm.nih.gov')) {
      return extractPubMedMetadata(url);
    }
    if (hostname.includes('scholar.google.com')) {
      return extractGoogleScholarMetadata(url);
    }
    return null;
  }

  function extractArxivMetadata(url) {
    const titleEl = document.querySelector('h1.title, .abstract-title h1');
    const title = titleEl ? titleEl.textContent.replace(/^Title:\s*/i, '').trim() : document.title.replace(/^\[[\d.]+]\s*/, '');

    const authorEls = document.querySelectorAll('.authors a, .authors .author');
    const authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);

    const abstractEl = document.querySelector('.abstract, .abstract-short');
    let abstract = abstractEl ? abstractEl.textContent.replace(/^Abstract:\s*/i, '').trim() : '';

    // Extract arXiv ID from URL
    const idMatch = url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
    const arxivId = idMatch ? idMatch[1] : '';

    const yearMatch = document.querySelector('.dateline');
    let year = '';
    if (yearMatch) {
      const yearText = yearMatch.textContent;
      const yMatch = yearText.match(/(\d{4})/);
      if (yMatch) year = yMatch[1];
    }

    return {
      title,
      authors,
      abstract: abstract.substring(0, 500),
      year,
      source: 'arXiv',
      url,
      arxiv_id: arxivId,
    };
  }

  function extractPubMedMetadata(url) {
    const titleEl = document.querySelector('h1.heading-title');
    const title = titleEl ? titleEl.textContent.trim() : document.title;

    const authorEls = document.querySelectorAll('.authors-list .full-name');
    const authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);

    const abstractEl = document.querySelector('.abstract-content');
    const abstract = abstractEl ? abstractEl.textContent.trim() : '';

    // Extract PMID
    const pmidMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
    const pmid = pmidMatch ? pmidMatch[1] : '';

    const yearEl = document.querySelector('.cit');
    let year = '';
    if (yearEl) {
      const yMatch = yearEl.textContent.match(/(\d{4})/);
      if (yMatch) year = yMatch[1];
    }

    return {
      title,
      authors,
      abstract: abstract.substring(0, 500),
      year,
      source: 'PubMed',
      url,
      pmid,
    };
  }

  function extractGoogleScholarMetadata(url) {
    // Google Scholar search results page — extract top result
    const firstResult = document.querySelector('.gs_r.gs_or.gs_scl');
    if (!firstResult) return null;

    const titleEl = firstResult.querySelector('.gs_rt a');
    const title = titleEl ? titleEl.textContent.trim() : '';

    const authorEl = firstResult.querySelector('.gs_a');
    let authors = [];
    let year = '';
    if (authorEl) {
      const text = authorEl.textContent;
      // Authors are before the first dash, year is typically the last 4-digit number
      const parts = text.split(' - ');
      if (parts[0]) {
        authors = parts[0].split(',').map(a => a.trim()).filter(a => a && !a.includes('…'));
      }
      const yMatch = text.match(/(\d{4})/);
      if (yMatch) year = yMatch[1];
    }

    const abstractEl = firstResult.querySelector('.gs_rs');
    const abstract = abstractEl ? abstractEl.textContent.trim() : '';

    const link = titleEl ? titleEl.href : url;

    return {
      title,
      authors,
      abstract: abstract.substring(0, 500),
      year,
      source: 'Google Scholar',
      url: link,
      search_url: url,
    };
  }
})();
```

### `popup.html` — Extension Popup

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      width: 320px;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      background: #0a0710;
      color: #f0e8d8;
      margin: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(60,40,120,0.1);
    }
    .logo { font-size: 1.1rem; font-weight: 700; }
    .logo-accent { color: #d4a844; }
    .token-section { margin-bottom: 12px; }
    .token-input {
      width: 100%;
      padding: 6px 8px;
      background: rgba(14,8,30,0.45);
      border: 1px solid rgba(60,40,120,0.1);
      border-radius: 6px;
      color: #f0e8d8;
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
      box-sizing: border-box;
    }
    .token-input:focus { border-color: #d4a844; }
    .status {
      font-size: 0.75rem;
      color: #6a5a40;
      margin-top: 4px;
    }
    .paper-info {
      background: rgba(14,8,30,0.45);
      border: 1px solid rgba(60,40,120,0.1);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .paper-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; }
    .paper-meta { font-size: 0.72rem; color: #a09070; margin-bottom: 8px; }
    .btn {
      width: 100%;
      padding: 8px;
      border: none;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #d4a844, #b89230);
      color: #fff;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(212,168,68,0.2); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-secondary {
      background: rgba(14,8,30,0.45);
      border: 1px solid rgba(60,40,120,0.1);
      color: #f0e8d8;
      margin-top: 8px;
    }
    .btn-secondary:hover { background: rgba(24,16,48,0.7); }
    .success { color: #6ee7b7; font-size: 0.75rem; margin-top: 6px; }
    .error { color: #fb7185; font-size: 0.75rem; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">Scholar<span class="logo-accent">Sift</span></span>
    <span style="font-size:0.72rem;color:#6a5a40;flex:1;text-align:right">Extension</span>
  </div>

  <div class="token-section">
    <input type="password" id="token-input" class="token-input" placeholder="Paste your ScholarSift API token..." />
    <div class="status" id="token-status">No token set — save disabled</div>
  </div>

  <div id="paper-info" class="paper-info">
    <div class="paper-title" id="paper-title">No academic page detected</div>
    <div class="paper-meta" id="paper-meta">Open an arXiv, PubMed, or Google Scholar page</div>
  </div>

  <button id="save-btn" class="btn btn-primary" disabled>Save to ScholarSift</button>
  <div id="result-msg"></div>
  <button id="open-dash-btn" class="btn btn-secondary">Open ScholarSift Dashboard</button>

  <script src="popup.js"></script>
</body>
</html>
```

### `popup.js` — Popup Logic

```javascript
// ScholarSift Popup Logic

const API_BASE = 'YOUR_SCHOLARSIFT_INSTANCE/api';

let currentPaper = null;

// Load saved token
chrome.storage.local.get(['scholarsift_token'], (result) => {
  if (result.scholarsift_token) {
    document.getElementById('token-input').value = result.scholarsift_token;
    document.getElementById('token-status').textContent = '✓ Token saved';
    document.getElementById('token-status').style.color = '#6ee7b7';
  }
});

// Save token on input
document.getElementById('token-input').addEventListener('change', (e) => {
  const token = e.target.value.trim();
  if (token) {
    chrome.storage.local.set({ scholarsift_token: token }, () => {
      document.getElementById('token-status').textContent = '✓ Token saved';
      document.getElementById('token-status').style.color = '#6ee7b7';
    });
  }
});

// Request metadata from content script
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_METADATA' }, (response) => {
    if (response && response.title) {
      currentPaper = response;
      document.getElementById('paper-title').textContent = response.title;
      const authors = (response.authors || []).join(', ') || 'Unknown';
      document.getElementById('paper-meta').textContent = `${authors} · ${response.year || 'N/A'}`;
      document.getElementById('save-btn').disabled = false;
    }
  });
});

// Save paper
document.getElementById('save-btn').addEventListener('click', async () => {
  const token = document.getElementById('token-input').value.trim();
  const msgEl = document.getElementById('result-msg');

  if (!token) {
    msgEl.innerHTML = '<div class="error">Please enter your ScholarSift token</div>';
    return;
  }
  if (!currentPaper) {
    msgEl.innerHTML = '<div class="error">No paper detected on this page</div>';
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    chrome.runtime.sendMessage({
      type: 'SAVE_PAPER',
      paper: currentPaper,
      token
    }, (response) => {
      if (response && response.success) {
        msgEl.innerHTML = '<div class="success">✓ Saved to ScholarSift!</div>';
      } else {
        msgEl.innerHTML = `<div class="error">✗ ${response?.error || 'Save failed'}</div>`;
      }
      btn.textContent = 'Save to ScholarSift';
      btn.disabled = false;
    });
  } catch (e) {
    msgEl.innerHTML = `<div class="error">✗ ${e.message}</div>`;
    btn.textContent = 'Save to ScholarSift';
    btn.disabled = false;
  }
});

// Open dashboard
document.getElementById('open-dash-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: API_BASE.replace('/api', '') });
});
```

## API Reference

The extension uses the following ScholarSift API endpoints:

### `GET /api/sync/collections?token=<token>`
Fetch all user collections.

### `POST /api/sync/collections`
Sync (overwrite) all user collections.
**Request body:**
```json
{
  "token": "your-jwt-token",
  "collections": [
    {
      "name": "Browser Extension",
      "papers": [{ "title": "...", "authors": [...], "year": "...", "url": "...", "source": "..." }]
    }
  ]
}
```

## Building the Extension

1. Create the `extension/` directory with all files above.
2. Create an `icons/` subdirectory with icon PNGs (16×16, 48×48, 128×128).
3. Open Chrome → Extensions (`chrome://extensions`).
4. Enable "Developer mode" (toggle top-right).
5. Click "Load unpacked" and select the `extension/` folder.
6. The extension icon will appear in your toolbar.

## Testing

1. Navigate to an arXiv paper page (e.g., `https://arxiv.org/abs/2301.00001`).
2. Click the ScholarSift extension icon.
3. Paste your ScholarSift API token.
4. Click "Save to ScholarSift".
5. Verify the paper appears in your ScholarSift collections.

## Troubleshooting

- **No paper detected**: Refresh the page after the extension is installed.
- **Token not saving**: Ensure your ScholarSift instance is correctly configured in the extension files.
- **CORS errors**: Your ScholarSift backend must have CORS enabled (`allow_origins=["*"]` in FastAPI).
- **Content script not running**: Check that the URL pattern in `matches` matches the page you're on.

## Extending

To add support for more academic sites:
1. Add the URL pattern to `matches` in `manifest.json`.
2. Add the host to `host_permissions`.
3. Add a new `extractXXXMetadata()` function in `content.js`.
4. Add the URL pattern check in `extractMetadata()`.
