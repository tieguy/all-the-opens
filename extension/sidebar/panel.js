// Jenifesto Sidebar Panel Script

console.log('Jenifesto sidebar panel loaded');

// DOM elements
const pageInfoEl = document.getElementById('page-info');
const wikidataSectionEl = document.getElementById('wikidata-section');
const entityHeaderEl = document.getElementById('entity-header');
const entityDescriptionEl = document.getElementById('entity-description');
const identifiersSectionEl = document.getElementById('identifiers-section');
const identifiersListEl = document.getElementById('identifiers-list');
const sameEntitySectionEl = document.getElementById('same-entity-section');
const sameEntityListEl = document.getElementById('same-entity-list');
const loadingSectionEl = document.getElementById('loading-section');
const loadingTextEl = document.getElementById('loading-text');
const noWikidataEl = document.getElementById('no-wikidata');
const errorSectionEl = document.getElementById('error-section');
const errorMessageEl = document.getElementById('error-message');

// State
let currentEntity = null;

// Hide all dynamic sections
function hideAllSections() {
  wikidataSectionEl.classList.add('hidden');
  identifiersSectionEl.classList.add('hidden');
  sameEntitySectionEl.classList.add('hidden');
  loadingSectionEl.classList.add('hidden');
  noWikidataEl.classList.add('hidden');
  errorSectionEl.classList.add('hidden');
}

// Show loading with custom message
function showLoading(message) {
  loadingSectionEl.classList.remove('hidden');
  loadingTextEl.textContent = message;
}

// Update the page info display
function updatePageInfo(page) {
  if (!page) {
    pageInfoEl.innerHTML = '<p class="placeholder">Navigate to a Wikipedia article to begin exploring.</p>';
    hideAllSections();
    return;
  }

  pageInfoEl.innerHTML = `<div class="page-title">${escapeHtml(page.title)}</div>`;

  if (page.qid) {
    hideAllSections();
    showLoading('Loading Wikidata...');
  } else {
    hideAllSections();
    noWikidataEl.classList.remove('hidden');
  }
}

// Display Wikidata entity
function displayWikidataEntity(entity) {
  currentEntity = entity;
  loadingSectionEl.classList.add('hidden');
  wikidataSectionEl.classList.remove('hidden');

  const wikidataUrl = `https://www.wikidata.org/wiki/${entity.id}`;
  entityHeaderEl.innerHTML = `
    <span class="entity-label">${escapeHtml(entity.label)}</span>
    <a href="${wikidataUrl}" target="_blank" rel="noopener" class="qid-badge">${entity.id}</a>
  `;

  if (entity.description) {
    entityDescriptionEl.textContent = entity.description;
    entityDescriptionEl.classList.remove('hidden');
  } else {
    entityDescriptionEl.classList.add('hidden');
  }

  // Show identifiers
  const identifierEntries = Object.entries(entity.identifiers);
  if (identifierEntries.length > 0) {
    identifiersSectionEl.classList.remove('hidden');
    identifiersListEl.innerHTML = identifierEntries.map(([type, info]) => {
      if (info.url) {
        return `
          <a href="${escapeHtml(info.url)}" target="_blank" rel="noopener" class="identifier-item">
            <span class="identifier-label">${escapeHtml(info.label)}</span>
            <span class="identifier-value">${escapeHtml(info.value)}</span>
          </a>
        `;
      } else {
        return `
          <div class="identifier-item">
            <span class="identifier-label">${escapeHtml(info.label)}</span>
            <span class="identifier-value">${escapeHtml(info.value)}</span>
          </div>
        `;
      }
    }).join('');
  }
}

// Display Tier 2 results
function displayTier2Results(results) {
  loadingSectionEl.classList.add('hidden');

  const successfulSources = Object.entries(results.successful);
  if (successfulSources.length === 0) {
    return; // No results to show
  }

  sameEntitySectionEl.classList.remove('hidden');
  sameEntityListEl.innerHTML = successfulSources.map(([sourceType, data]) => {
    const config = data.sourceConfig || { name: sourceType, icon: null };

    return `
      <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener" class="result-card">
        ${data.thumbnail
          ? `<img src="${escapeHtml(data.thumbnail)}" alt="" class="result-thumbnail" loading="lazy">`
          : `<div class="result-thumbnail-placeholder">
              ${config.icon ? `<img src="${escapeHtml(config.icon)}" alt="">` : ''}
            </div>`
        }
        <div class="result-content">
          <div class="result-title">${escapeHtml(data.title)}</div>
          ${data.description ? `<div class="result-description">${escapeHtml(data.description)}</div>` : ''}
          <div class="result-source">
            ${config.icon ? `<img src="${escapeHtml(config.icon)}" alt="" class="result-source-icon">` : ''}
            <span class="result-source-name">${escapeHtml(config.name)}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// Display error
function displayError(message) {
  loadingSectionEl.classList.add('hidden');
  errorSectionEl.classList.remove('hidden');
  errorMessageEl.textContent = message;
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Request current page data
async function loadCurrentPage() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_PAGE' });
    updatePageInfo(response.page);

    if (response.page?.qid) {
      const wikidataResponse = await browser.runtime.sendMessage({ type: 'GET_WIKIDATA' });
      if (wikidataResponse.data) {
        displayWikidataEntity(wikidataResponse.data);

        // Request Tier 2 results
        showLoading('Loading related sources...');
        const tier2Response = await browser.runtime.sendMessage({
          type: 'GET_TIER2_RESULTS',
          identifiers: wikidataResponse.data.identifiers
        });
        if (tier2Response.results) {
          displayTier2Results(tier2Response.results);
        }
      } else if (wikidataResponse.error) {
        displayError(wikidataResponse.error);
      }
    }
  } catch (error) {
    console.error('Sidebar error:', error);
    updatePageInfo(null);
  }
}

// Listen for background updates
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Sidebar received:', message.type);

  switch (message.type) {
    case 'PAGE_UPDATED':
      updatePageInfo(message.page);
      break;
    case 'WIKIDATA_LOADED':
      displayWikidataEntity(message.entity);
      break;
    case 'TIER2_LOADING':
      showLoading('Loading related sources...');
      break;
    case 'TIER2_LOADED':
      displayTier2Results(message.results);
      break;
    case 'LOAD_ERROR':
      displayError(message.error);
      break;
  }
});

// Initialize
loadCurrentPage();
