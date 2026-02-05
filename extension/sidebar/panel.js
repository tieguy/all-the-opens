// Jenifesto Sidebar Panel Script

console.log('Jenifesto sidebar panel loaded');

// DOM elements
const pageInfoEl = document.getElementById('page-info');
const wikidataSectionEl = document.getElementById('wikidata-section');
const wikidataInfoEl = document.getElementById('wikidata-info');
const noWikidataEl = document.getElementById('no-wikidata');
const resultsSection = document.getElementById('results');
const resultsListEl = document.getElementById('results-list');

// Update the page info display
function updatePageInfo(page) {
  if (!page) {
    pageInfoEl.innerHTML = '<p class="placeholder">Navigate to a Wikipedia article to begin exploring.</p>';
    wikidataSectionEl.classList.add('hidden');
    noWikidataEl.classList.add('hidden');
    resultsSection.classList.add('hidden');
    return;
  }

  // Update page info
  pageInfoEl.innerHTML = `
    <div class="page-title">${escapeHtml(page.title)}</div>
    <div class="page-url">${escapeHtml(page.url)}</div>
  `;

  // Update Wikidata section
  if (page.qid) {
    wikidataSectionEl.classList.remove('hidden');
    noWikidataEl.classList.add('hidden');

    const wikidataUrl = `https://www.wikidata.org/wiki/${page.qid}`;
    wikidataInfoEl.innerHTML = `
      <a href="${wikidataUrl}" target="_blank" rel="noopener" class="qid-badge">${escapeHtml(page.qid)}</a>
    `;
  } else {
    wikidataSectionEl.classList.add('hidden');
    noWikidataEl.classList.remove('hidden');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Request current page data from background script
async function loadCurrentPage() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_PAGE' });
    console.log('Jenifesto sidebar: Got page data:', response);
    updatePageInfo(response.page);
  } catch (error) {
    console.error('Jenifesto sidebar: Failed to get page data:', error);
    updatePageInfo(null);
  }
}

// Listen for updates from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Jenifesto sidebar: Received message:', message);

  if (message.type === 'PAGE_UPDATED') {
    updatePageInfo(message.page);
  }
});

// Load data when panel opens
loadCurrentPage();
