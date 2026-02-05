// Jenifesto Background Script
// Handles message passing and API orchestration for tiered loading

import { fetchEntity, getIdentifierUrl } from './api/wikidata.js';
import { querySourcesByIdentifiers, searchSourcesByKeyword, getSourceConfig } from './api/sources.js';
import { getCached, setCache } from './utils/cache.js';

console.log('Jenifesto background script loaded');

// Cache TTLs
const WIKIDATA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const SOURCE_CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour
const SEARCH_CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour

// Current page state
let currentPage = null;
let currentTier2Sources = []; // Track which sources have Tier 2 results

// Listen for messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message.type);

  switch (message.type) {
    case 'WIKIPEDIA_PAGE_LOADED':
      handlePageLoaded(message).then(sendResponse);
      return true;

    case 'GET_CURRENT_PAGE':
      sendResponse({ page: currentPage });
      return;

    case 'GET_WIKIDATA':
      if (!currentPage?.qid) {
        sendResponse({ error: 'No Q-ID available' });
        return;
      }
      fetchWikidataForPage(currentPage.qid).then(
        data => sendResponse({ data }),
        error => sendResponse({ error: error.message })
      );
      return true;

    case 'GET_TIER2_RESULTS':
      if (!message.identifiers) {
        sendResponse({ error: 'No identifiers provided' });
        return;
      }
      fetchTier2Results(currentPage?.qid, message.identifiers).then(
        results => sendResponse({ results }),
        error => sendResponse({ error: error.message })
      );
      return true;

    case 'SEARCH_TIER3':
      if (!message.query) {
        sendResponse({ error: 'No query provided' });
        return;
      }
      performTier3Search(message.query, currentTier2Sources).then(
        results => sendResponse({ results }),
        error => sendResponse({ error: error.message })
      );
      return true;
  }
});

/**
 * Handle page loaded message from content script
 */
async function handlePageLoaded(message) {
  currentPage = {
    title: message.title,
    url: message.url,
    qid: message.qid,
    timestamp: Date.now()
  };
  currentTier2Sources = [];

  await browser.storage.local.set({ currentPage });
  broadcastMessage({ type: 'PAGE_UPDATED', page: currentPage });

  if (currentPage.qid) {
    try {
      // Tier 1: Fetch Wikidata
      const wikidataEntity = await fetchWikidataForPage(currentPage.qid);
      broadcastMessage({ type: 'WIKIDATA_LOADED', entity: wikidataEntity });

      // Tier 2: Query sources with identifiers
      if (Object.keys(wikidataEntity.identifiers).length > 0) {
        broadcastMessage({ type: 'TIER2_LOADING' });

        const tier2Results = await fetchTier2Results(currentPage.qid, wikidataEntity.identifiers);

        // Track which sources returned Tier 2 results
        currentTier2Sources = Object.keys(tier2Results.successful);

        broadcastMessage({ type: 'TIER2_LOADED', results: tier2Results });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      broadcastMessage({ type: 'LOAD_ERROR', error: error.message });
    }
  }

  return { success: true };
}

/**
 * Fetch Wikidata entity with caching
 */
async function fetchWikidataForPage(qid) {
  const cacheKey = `wikidata_${qid}`;
  const cached = await getCached(cacheKey);

  if (cached) {
    console.log('Wikidata cache hit:', qid);
    return cached;
  }

  console.log('Wikidata cache miss, fetching:', qid);
  const entity = await fetchEntity(qid);

  for (const [type, info] of Object.entries(entity.identifiers)) {
    info.url = getIdentifierUrl(type, info.value);
  }

  await setCache(cacheKey, entity, WIKIDATA_CACHE_TTL);
  return entity;
}

/**
 * Fetch Tier 2 results from sources with caching
 */
async function fetchTier2Results(qid, identifiers) {
  const cacheKey = `tier2_${qid}`;
  const cached = await getCached(cacheKey);

  if (cached) {
    console.log('Tier 2 cache hit:', qid);
    return cached;
  }

  console.log('Tier 2 cache miss, querying sources:', qid);
  const results = await querySourcesByIdentifiers(identifiers);

  for (const [type, data] of Object.entries(results.successful)) {
    data.sourceConfig = getSourceConfig(type);
  }

  await setCache(cacheKey, results, SOURCE_CACHE_TTL);
  return results;
}

/**
 * Perform Tier 3 keyword search with caching
 */
async function performTier3Search(query, excludeSources) {
  const cacheKey = `tier3_${query}_${excludeSources.sort().join(',')}`;
  const cached = await getCached(cacheKey);

  if (cached) {
    console.log('Tier 3 cache hit:', query);
    return cached;
  }

  console.log('Tier 3 cache miss, searching:', query);
  const results = await searchSourcesByKeyword(query, excludeSources, 5);

  // Add source config to results
  for (const [type, items] of Object.entries(results.successful)) {
    const config = getSourceConfig(type);
    for (const item of items) {
      item.sourceConfig = config;
    }
  }

  await setCache(cacheKey, results, SEARCH_CACHE_TTL);
  return results;
}

/**
 * Broadcast message to sidebar
 */
function broadcastMessage(message) {
  browser.runtime.sendMessage(message).catch(() => {});
}

// Restore state on startup
browser.storage.local.get('currentPage').then(result => {
  if (result.currentPage) {
    currentPage = result.currentPage;
    console.log('Restored current page:', currentPage.title);
  }
});

browser.runtime.onInstalled.addListener((details) => {
  console.log('Jenifesto installed:', details.reason);
});
