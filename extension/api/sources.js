// Source Query Orchestrator
// Coordinates queries to multiple sources based on available identifiers

import { fetchByOlid } from './openlibrary.js';
import { fetchItem as fetchIAItem } from './internet-archive.js';
import { fetchRecord as fetchViafRecord } from './viaf.js';
import { fetchSpecies as fetchGbifSpecies } from './gbif.js';
import { fetchTaxon as fetchInatTaxon } from './inaturalist.js';

// Map identifier types to fetch functions
const IDENTIFIER_FETCHERS = {
  openlibrary: fetchByOlid,
  internet_archive: fetchIAItem,
  viaf: fetchViafRecord,
  gbif: fetchGbifSpecies,
  inaturalist: fetchInatTaxon
};

// Source display configuration
export const SOURCE_CONFIG = {
  openlibrary: {
    name: 'OpenLibrary',
    color: '#418541',
    icon: 'https://openlibrary.org/favicon.ico'
  },
  internet_archive: {
    name: 'Internet Archive',
    color: '#6b8cae',
    icon: 'https://archive.org/favicon.ico'
  },
  viaf: {
    name: 'VIAF',
    color: '#8b6b4e',
    icon: 'https://viaf.org/viaf/images/viaf.ico'
  },
  gbif: {
    name: 'GBIF',
    color: '#4e9a47',
    icon: 'https://www.gbif.org/favicon.ico'
  },
  inaturalist: {
    name: 'iNaturalist',
    color: '#74ac00',
    icon: 'https://www.inaturalist.org/favicon.ico'
  }
};

/**
 * Query all sources that have matching identifiers
 * @param {Object} identifiers - Map of identifier type to {value, label, url}
 * @returns {Promise<Object>} Results grouped by source
 */
export async function querySourcesByIdentifiers(identifiers) {
  const results = {
    successful: {},
    failed: {},
    noIdentifier: []
  };

  // Determine which sources we can query
  const queries = [];

  for (const [type, fetcher] of Object.entries(IDENTIFIER_FETCHERS)) {
    const identifier = identifiers[type];
    if (identifier) {
      queries.push({
        type,
        identifier: identifier.value,
        fetcher
      });
    } else {
      results.noIdentifier.push(type);
    }
  }

  // Execute all queries in parallel
  const queryResults = await Promise.allSettled(
    queries.map(async ({ type, identifier, fetcher }) => {
      const data = await fetcher(identifier);
      return { type, data };
    })
  );

  // Process results
  for (let i = 0; i < queryResults.length; i++) {
    const result = queryResults[i];
    const { type } = queries[i];

    if (result.status === 'fulfilled' && result.value.data) {
      results.successful[type] = result.value.data;
    } else if (result.status === 'rejected') {
      results.failed[type] = result.reason.message;
    } else {
      // Fulfilled but null data (404)
      results.failed[type] = 'Not found';
    }
  }

  return results;
}

/**
 * Get display info for a source
 * @param {string} sourceType - Source type key
 * @returns {Object} Source display configuration
 */
export function getSourceConfig(sourceType) {
  return SOURCE_CONFIG[sourceType] || {
    name: sourceType,
    color: '#666666',
    icon: null
  };
}
