// ScholarSift Extension v1.0.0 — Content Script
// Detects academic paper pages and extracts metadata.
// Supports: arXiv, PubMed, Google Scholar.

(function () {
  'use strict';

  // Respond to metadata extraction requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_METADATA') {
      sendResponse(extractMetadata());
    }
  });

  // Auto-detect on page load and notify background
  const metadata = extractMetadata();
  if (metadata) {
    chrome.runtime.sendMessage({
      type: 'PAGE_DETECTED',
      paper: metadata,
      url: window.location.href,
    });
  }

  /**
   * Detect the site and extract paper metadata.
   */
  function extractMetadata() {
    const host = window.location.hostname;

    if (host.includes('arxiv.org')) return extractArxiv();
    if (host.includes('pubmed.ncbi.nlm.nih.gov')) return extractPubMed();
    if (host.includes('scholar.google.com')) return extractGoogleScholar();

    return null;
  }

  /**
   * arXiv abstract page.
   */
  function extractArxiv() {
    const titleEl =
      document.querySelector('h1.title') ||
      document.querySelector('.abstract-title h1') ||
      document.querySelector('meta[name="citation_title"]');
    const title = titleEl
      ? (titleEl.textContent || titleEl.content || '').replace(/^Title:\s*/i, '').trim()
      : document.title.replace(/^\[[\d.]+]\s*/, '').trim();

    const authorEls = document.querySelectorAll('.authors a, .authors .author, meta[name="citation_author"]');
    const authors = Array.from(authorEls)
      .map(el => el.textContent || el.content)
      .map(s => (s || '').trim())
      .filter(Boolean);

    const abstractEl = document.querySelector('.abstract, .abstract-short, blockquote.abstract');
    let abstract = abstractEl ? abstractEl.textContent.replace(/^Abstract:\s*/i, '').trim() : '';

    const idMatch = window.location.pathname.match(/\/abs\/(\d+\.\d+)/);
    const arxivId = idMatch ? idMatch[1] : '';

    const dateEl = document.querySelector('.dateline');
    let year = '';
    if (dateEl) {
      const yMatch = dateEl.textContent.match(/(\d{4})/);
      if (yMatch) year = yMatch[1];
    }

    // Try meta tags
    if (!year) {
      const metaYear = document.querySelector('meta[name="citation_date"]');
      if (metaYear) {
        const yMatch = (metaYear.content || '').match(/(\d{4})/);
        if (yMatch) year = yMatch[1];
      }
    }

    return {
      title,
      authors,
      abstract: abstract.substring(0, 500),
      year,
      source: 'arXiv',
      url: window.location.href,
      arxiv_id: arxivId,
    };
  }

  /**
   * PubMed abstract page.
   */
  function extractPubMed() {
    const titleEl = document.querySelector('h1.heading-title');
    const title = titleEl ? titleEl.textContent.trim() : document.title;

    const authorEls = document.querySelectorAll('.authors-list .full-name');
    const authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean);

    const abstractEl = document.querySelector('.abstract-content');
    const abstract = abstractEl ? abstractEl.textContent.trim() : '';

    const pmidMatch = window.location.pathname.match(/\/(\d+)/);
    const pmid = pmidMatch ? pmidMatch[1] : '';

    const citEl = document.querySelector('.cit');
    let year = '';
    if (citEl) {
      const yMatch = citEl.textContent.match(/(\d{4})/);
      if (yMatch) year = yMatch[1];
    }

    return {
      title,
      authors,
      abstract: abstract.substring(0, 500),
      year,
      source: 'PubMed',
      url: window.location.href,
      pmid,
    };
  }

  /**
   * Google Scholar search results — extracts the first result.
   */
  function extractGoogleScholar() {
    const firstResult = document.querySelector('.gs_r.gs_or.gs_scl');
    if (!firstResult) return null;

    const titleEl = firstResult.querySelector('.gs_rt a');
    const title = titleEl ? titleEl.textContent.trim() : '';

    const authorEl = firstResult.querySelector('.gs_a');
    let authors = [];
    let year = '';
    if (authorEl) {
      const text = authorEl.textContent;
      const parts = text.split(' - ');
      if (parts[0]) {
        authors = parts[0]
          .split(',')
          .map(a => a.trim())
          .filter(a => a && !a.includes('…'));
      }
      const yMatch = text.match(/(\d{4})/);
      if (yMatch) year = yMatch[1];
    }

    const abstractEl = firstResult.querySelector('.gs_rs');
    const abstract = abstractEl ? abstractEl.textContent.trim() : '';

    const link = titleEl ? titleEl.href : window.location.href;

    // Get the result ID from Google Scholar
    const dataCid = firstResult.getAttribute('data-cid') || '';

    return {
      title,
      authors,
      abstract: abstract.substring(0, 500),
      year,
      source: 'Google Scholar',
      url: link,
      gs_cid: dataCid,
    };
  }
})();
