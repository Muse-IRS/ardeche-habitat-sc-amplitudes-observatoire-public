import {
  DATASETS,
  isValidDpeNumber,
  normalizeDpeNumber,
  normalizeAddressQuery,
  extractPostalCode,
  buildingIdentity,
  selectBuildingRows,
  sortDpeRowsByDate,
} from './core.js';

export const ADEME_API_ROOT = 'https://data.ademe.fr/data-fair/api/v1/datasets';
export const EXISTING_DPE_DATASET_ID = 'dpe03existant';
export const BUILDING_RESULT_LIMIT = 100;
export const BUILDING_SELECT_FIELDS = Object.freeze([
  'numero_dpe',
  'date_etablissement_dpe',
  'date_visite_diagnostiqueur',
  'date_fin_validite_dpe',
  'etiquette_dpe',
  'etiquette_ges',
  'surface_habitable_logement',
  'numero_etage_appartement',
  'position_logement_dans_immeuble',
  'type_batiment',
  'identifiant_ban',
  'adresse_ban',
  'adresse_brut',
  'code_postal_ban',
  'nom_commune_ban',
  'conso_5_usages_par_m2_ep',
  'emission_ges_5_usages_par_m2',
  'type_energie_principale_chauffage',
  'type_installation_chauffage',
  'type_generateur_chauffage_principal',
  'type_emetteur_installation_chauffage_n1',
  'type_energie_principale_ecs',
  'type_installation_ecs',
  'qualite_isolation_enveloppe',
  'qualite_isolation_murs',
  'qualite_isolation_menuiseries',
]);

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

export function buildAddressSearchUrl(address, options = {}) {
  const normalized = normalizeAddressQuery(address);
  const postalCode = options.postalCode || extractPostalCode(normalized);
  if (!postalCode) {
    const error = new RangeError('Postal code required for address lookup');
    error.code = 'DPE_ADDRESS_POSTAL_CODE_REQUIRED';
    throw error;
  }

  const query = normalizeAddressQuery(normalized.replace(postalCode, ' '));
  if (query.length < 4) {
    const error = new RangeError('Address query too short');
    error.code = 'DPE_ADDRESS_QUERY_TOO_SHORT';
    throw error;
  }

  const params = new URLSearchParams({
    size: String(Math.min(Number(options.size) || BUILDING_RESULT_LIMIT, BUILDING_RESULT_LIMIT)),
    q: query,
    q_fields: 'adresse_ban',
    code_postal_ban_in: postalCode,
    sort: '-_score,-date_etablissement_dpe',
    select: BUILDING_SELECT_FIELDS.join(','),
  });
  return ADEME_API_ROOT + '/' + EXISTING_DPE_DATASET_ID + '/lines?' + params.toString();
}

export function buildBuildingIdUrl(banId, options = {}) {
  const normalized = String(banId || '').trim();
  if (!normalized) {
    const error = new RangeError('BAN building identity required');
    error.code = 'DPE_BUILDING_ID_REQUIRED';
    throw error;
  }

  const params = new URLSearchParams({
    size: String(Math.min(Number(options.size) || BUILDING_RESULT_LIMIT, BUILDING_RESULT_LIMIT)),
    identifiant_ban_in: normalized,
    sort: '-date_etablissement_dpe',
    select: BUILDING_SELECT_FIELDS.join(','),
  });
  return ADEME_API_ROOT + '/' + EXISTING_DPE_DATASET_ID + '/lines?' + params.toString();
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

export async function searchExistingDpesByAddress(address, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const url = buildAddressSearchUrl(address, options);
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const payload = await readJson(response, 'ADEME address lookup');
  const rawRows = Array.isArray(payload.results) ? payload.results : [];
  const rows = selectBuildingRows(rawRows, address);

  return Object.freeze({
    rows,
    rawCount: rawRows.length,
    total: Number(payload.total) || rawRows.length,
    url,
    postalCode: extractPostalCode(address),
    query: normalizeAddressQuery(address),
    buildingIdentity: rows.length ? buildingIdentity(rows[0]) : null,
    truncated: (Number(payload.total) || rawRows.length) > BUILDING_RESULT_LIMIT,
  });
}

export async function searchExistingDpesForRow(row, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const banId = String(row?.identifiant_ban || '').trim();
  if (!banId) {
    const address = row?.adresse_ban || row?.adresse_brut || '';
    return searchExistingDpesByAddress(address, options);
  }

  const url = buildBuildingIdUrl(banId, options);
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const payload = await readJson(response, 'ADEME building lookup');
  const rawRows = Array.isArray(payload.results) ? payload.results : [];
  const rows = sortDpeRowsByDate(
    rawRows.filter(candidate => buildingIdentity(candidate) === 'ban:' + banId)
  );

  return Object.freeze({
    rows,
    rawCount: rawRows.length,
    total: Number(payload.total) || rawRows.length,
    url,
    postalCode: row?.code_postal_ban || null,
    query: row?.adresse_ban || row?.adresse_brut || '',
    buildingIdentity: 'ban:' + banId,
    truncated: (Number(payload.total) || rawRows.length) > BUILDING_RESULT_LIMIT,
  });
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
