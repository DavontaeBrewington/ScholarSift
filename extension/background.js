// ScholarSift Extension v1.0.0 — Background Service Worker
// Handles tab detection, messaging, and saving papers to ScholarSift API.

const SCHOLARSIFT_API = 'http://localhost:8000/api';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ScholarSift] Extension installed');
});

// Show page action icon on academic sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isAcademic = /arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|scholar\.google\.com/.test(tab.url);
    chrome.action.setIcon({
      tabId,
      path: isAcademic
        ? { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
        : { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
    });
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_PAPER') {
    savePaperToScholarSift(message.paper, message.token)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async
  }

  if (message.type === 'EXTRACT_METADATA' && sender.tab) {
    // Forward to content script
    chrome.tabs.sendMessage(sender.tab.id, { type: 'EXTRACT_METADATA' }, sendResponse);
    return true;
  }
});

/**
 * Save a paper to the user's ScholarSift account by syncing
 * it into the "Browser Extension" collection.
 */
async function savePaperToScholarSift(paper, token) {
  // Fetch existing collections
  const resp = await fetch(`${SCHOLARSIFT_API}/sync/collections?token=${encodeURIComponent(token)}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const data = await resp.json();
  const collections = data.collections || [];

  // Find or create "Browser Extension" collection
  let extCollection = collections.find(c => c.name === 'Browser Extension');
  if (!extCollection) {
    extCollection = { name: 'Browser Extension', papers: [] };
    collections.push(extCollection);
  }

  // Check for duplicates
  const isDuplicate = extCollection.papers.some(p => p.url && p.url === paper.url);
  if (isDuplicate) {
    throw new Error('Paper already saved in Browser Extension collection');
  }

  // Add paper
  extCollection.papers.push({
    title: paper.title || 'Untitled',
    authors: paper.authors || [],
    year: paper.year || '',
    url: paper.url || '',
    source: paper.source || 'Browser Extension',
  });

  // Sync back to server
  const syncResp = await fetch(`${SCHOLARSIFT_API}/sync/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, collections }),
  });
  if (!syncResp.ok) throw new Error(`Sync error: ${syncResp.status}`);

  return { collection: 'Browser Extension', paperCount: extCollection.papers.length };
}
