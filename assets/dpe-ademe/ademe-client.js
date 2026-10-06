import {
  DATASETS,
  isValidDpeNumber,
  normalizeDpeNumber,
} from './core.js';

export const ADEME_API_ROOT = 'https://data.ademe.fr/data-fair/api/v1/datasets';

export function buildDpeUrl(datasetId, number, format = '') {
  const normalized = normalizeDpeNumber(number);
  const params = new URLSearchParams({ size: '1', numero_dpe_in: normalized });
  if (format) params.set('format', format);
  return `${ADEME_API_ROOT}/${datasetId}/lines?${params.toString()}`;
}

export function buildDpeFallbackUrl(datasetId, number) {
  const normalized = normalizeDpeNumber(number);
  const params = new URLSearchParams({
    size: '1',
    q: normalized,
    q_fields: 'numero_dpe',
  });
  return `${ADEME_API_ROOT}/${datasetId}/lines?${params.toString()}`;
}

async function readJson(response, context) {
  if (!response.ok) {
    const error = new Error(`${context} HTTP ${response.status}`);
    error.code = 'DPE_ADEME_HTTP_ERROR';
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function queryDataset(dataset, number, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const normalized = normalizeDpeNumber(number);
  if (!isValidDpeNumber(normalized)) {
    const error = new RangeError('Invalid DPE number');
    error.code = 'DPE_INVALID_NUMBER';
    throw error;
  }

  let response = await fetchImpl(buildDpeUrl(dataset.id, normalized), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    response = await fetchImpl(buildDpeFallbackUrl(dataset.id, normalized), {
      headers: { Accept: 'application/json' },
    });
  }

  const payload = await readJson(response, 'ADEME');
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const row = rows.find(item => normalizeDpeNumber(item.numero_dpe) === normalized);

  return row ? Object.freeze({ row, dataset }) : null;
}

export async function findDpeByNumber(number, options = {}) {
  const normalized = normalizeDpeNumber(number);
  if (!isValidDpeNumber(normalized)) {
    const error = new RangeError('Invalid DPE number');
    error.code = 'DPE_INVALID_NUMBER';
    throw error;
  }

  const datasets = options.datasets ?? DATASETS;
  for (const dataset of datasets) {
    const found = await queryDataset(dataset, normalized, options);
    if (found) return found;
  }
  return null;
}

export function createMetadataClient(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const cache = new Map();

  return Object.freeze({
    async get(datasetId) {
      if (cache.has(datasetId)) return cache.get(datasetId);
      const response = await fetchImpl(`${ADEME_API_ROOT}/${datasetId}`, {
        headers: { Accept: 'application/json' },
      });
      const metadata = await readJson(response, 'ADEME metadata');
      cache.set(datasetId, metadata);
      return metadata;
    },
    clear() {
      cache.clear();
    },
  });
}
