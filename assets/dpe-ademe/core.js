export const DPE_ADEME_CORE_VERSION = '1.1.1';
export const DPE_ADEME_CONTRACT = 'DPE_ADEME_CORE_V1';

export const DPE_PATTERN = /^[0-9A-Z]{13}$/;

export const DATASETS = Object.freeze([
  Object.freeze({ id: 'dpe03existant', label: 'Logement existant — depuis juillet 2021', generation: 'current' }),
  Object.freeze({ id: 'dpe02neuf', label: 'Logement neuf — depuis juillet 2021', generation: 'current' }),
  Object.freeze({ id: 'dpe01tertiaire', label: 'Tertiaire — depuis juillet 2021', generation: 'current' }),
  Object.freeze({ id: 'dpe-france', label: 'Logement historique — avant juillet 2021', generation: 'historical' }),
]);

export const CALCULATION_FIELDS = Object.freeze({
  cep: Object.freeze(['conso_5_usages_par_m2_ep', 'conso_5_usages_m2_ep', 'ep_conso_5_usages_m2']),
  ges: Object.freeze(['emission_ges_5_usages_par_m2', 'emission_ges_5_usages_m2']),
  surface: Object.freeze(['surface_reference', 'surface_habitable_logement']),
});

export const BUILDING_COMPARISON_FIELDS = Object.freeze([
  Object.freeze({ key: 'date_etablissement_dpe', label: 'Date DPE' }),
  Object.freeze({ key: 'surface_habitable_logement', label: 'Surface habitable' }),
  Object.freeze({ key: 'numero_etage_appartement', label: 'Étage' }),
  Object.freeze({ key: 'position_logement_dans_immeuble', label: 'Position dans l’immeuble' }),
  Object.freeze({ key: 'etiquette_dpe', label: 'Étiquette DPE' }),
  Object.freeze({ key: 'etiquette_ges', label: 'Étiquette GES' }),
  Object.freeze({ key: 'conso_5_usages_par_m2_ep', label: 'Consommation 5 usages' }),
  Object.freeze({ key: 'emission_ges_5_usages_par_m2', label: 'Émissions GES 5 usages' }),
  Object.freeze({ key: 'type_energie_principale_chauffage', label: 'Énergie principale chauffage' }),
  Object.freeze({ key: 'type_installation_chauffage', label: 'Installation chauffage' }),
  Object.freeze({ key: 'type_generateur_chauffage_principal', label: 'Générateur chauffage principal' }),
  Object.freeze({ key: 'type_emetteur_installation_chauffage_n1', label: 'Émetteur chauffage principal' }),
  Object.freeze({ key: 'type_energie_principale_ecs', label: 'Énergie principale ECS' }),
  Object.freeze({ key: 'type_installation_ecs', label: 'Installation ECS' }),
  Object.freeze({ key: 'qualite_isolation_enveloppe', label: 'Qualité isolation enveloppe' }),
  Object.freeze({ key: 'qualite_isolation_murs', label: 'Qualité isolation murs' }),
  Object.freeze({ key: 'qualite_isolation_menuiseries', label: 'Qualité isolation menuiseries' }),
]);

export const HISTORICAL_ENERGY_THRESHOLDS = Object.freeze([
  Object.freeze({ label: 'A', max: 50 }),
  Object.freeze({ label: 'B', max: 90 }),
  Object.freeze({ label: 'C', max: 150 }),
  Object.freeze({ label: 'D', max: 230 }),
  Object.freeze({ label: 'E', max: 330 }),
  Object.freeze({ label: 'F', max: 450 }),
  Object.freeze({ label: 'G', max: Infinity }),
]);

export const HISTORICAL_GES_THRESHOLDS = Object.freeze([
  Object.freeze({ label: 'A', max: 5 }),
  Object.freeze({ label: 'B', max: 10 }),
  Object.freeze({ label: 'C', max: 20 }),
  Object.freeze({ label: 'D', max: 35 }),
  Object.freeze({ label: 'E', max: 55 }),
  Object.freeze({ label: 'F', max: 80 }),
  Object.freeze({ label: 'G', max: Infinity }),
]);

export function normalizeDpeNumber(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function isValidDpeNumber(value) {
  return DPE_PATTERN.test(normalizeDpeNumber(value));
}

export function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

export function pickFirst(row = {}, keys = []) {
  for (const key of keys) {
    if (hasValue(row[key])) return row[key];
  }
  return null;
}

export function normalizeAddressQuery(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function extractPostalCode(value) {
  const match = normalizeAddressQuery(value).match(/(?:^|\s)(\d{5})(?:\s|$)/);
  return match ? match[1] : null;
}

export function normalizeAddressKey(value) {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function extractStreetNumber(value) {
  const match = normalizeAddressQuery(value).match(/^\s*(\d+[a-zA-Z]?)(?:\s|,|-)/);
  return match ? match[1].toLowerCase() : null;
}

export function buildingIdentity(row = {}) {
  const banId = String(row.identifiant_ban || '').trim();
  if (banId) return 'ban:' + banId;
  const normalized = normalizeAddressKey(row.adresse_ban || row.adresse_brut || '');
  return normalized ? 'address:' + normalized : null;
}

export function rowMatchesStreetNumber(row = {}, streetNumber) {
  if (!streetNumber) return false;
  const value = normalizeAddressQuery(row.adresse_ban || row.adresse_brut || '').toLowerCase();
  const escaped = String(streetNumber).replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped + '(?:\\s|,|-|/|$)', 'i').test(value);
}
export function dedupeDpeRows(rows = []) {
  const seen = new Set();
  return rows.filter(row => {
    const id = normalizeDpeNumber(row?.numero_dpe);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function sortDpeRowsByDate(rows = []) {
  return [...rows].sort((a, b) =>
    String(b?.date_etablissement_dpe || '').localeCompare(String(a?.date_etablissement_dpe || ''))
  );
}

export function selectBuildingRows(rows = [], addressQuery = '') {
  const uniqueRows = dedupeDpeRows(rows);
  if (!uniqueRows.length) return [];

  const streetNumber = extractStreetNumber(addressQuery);
  const numberMatches = streetNumber
    ? uniqueRows.filter(row => rowMatchesStreetNumber(row, streetNumber))
    : [];
  const candidates = numberMatches.length ? numberMatches : uniqueRows;

  const identity = buildingIdentity(candidates[0]);
  const sameBuilding = identity
    ? candidates.filter(row => buildingIdentity(row) === identity)
    : candidates;

  return sortDpeRowsByDate(sameBuilding);
}

export function comparisonStatus(rows = [], fieldKey) {
  const values = rows
    .map(row => row?.[fieldKey])
    .filter(hasValue)
    .map(value => normalizeSearchText(String(value).trim()));

  if (!values.length) return 'INDETERMINE';
  if (values.length !== rows.length) return 'INDETERMINE';
  return new Set(values).size === 1 ? 'CONVERGENCE' : 'DIVERGENCE';
}

export function compareBuildingRows(rows = [], fields = BUILDING_COMPARISON_FIELDS) {
  return fields.map(field => Object.freeze({
    ...field,
    status: comparisonStatus(rows, field.key),
    values: rows.map(row => hasValue(row?.[field.key]) ? row[field.key] : null),
  }));
}

export function isHistoricalDataset(dataset) {
  return dataset?.generation === 'historical' || dataset?.id === 'dpe-france';
}

function normalizeIsoDate(value) {
  const raw = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function electricityFactorForDate(value, referenceDateValue) {
  const raw = normalizeIsoDate(value) ?? normalizeIsoDate(referenceDateValue);
  if (!raw) return null;
  if (raw >= '2027-01-01') return 1.7;
  if (raw >= '2026-01-01') return 1.9;
  return 2.3;
}

export function addTenYears(value) {
  const raw = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCFullYear(date.getUTCFullYear() + 10);
  return date.toISOString().slice(0, 10);
}

export function historicalValidity(establishedValue, referenceDateValue) {
  const established = String(establishedValue ?? '').slice(0, 10);
  const referenceDate = String(referenceDateValue ?? '').slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(established)) {
    return Object.freeze({
      expiry: null,
      status: 'DPE historique — validité à vérifier à partir de sa date d’établissement',
      rule: '',
    });
  }

  let expiry;
  let rule;

  if (established >= '2013-01-01' && established <= '2017-12-31') {
    expiry = '2022-12-31';
    rule = 'échéance transitoire applicable aux DPE établis de 2013 à 2017';
  } else if (established >= '2018-01-01' && established <= '2021-06-30') {
    expiry = '2024-12-31';
    rule = 'échéance transitoire applicable aux DPE établis du 1er janvier 2018 au 30 juin 2021';
  } else {
    expiry = addTenYears(established);
    rule = 'durée de validité de référence de dix ans ; les DPE les plus anciens sont aujourd’hui expirés';
  }

  const comparableReference = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : null;
  const status = comparableReference && expiry && comparableReference > expiry ? 'Expiré' : 'Validité à vérifier';

  return Object.freeze({ expiry, status, rule });
}

export function historicalClass(value, thresholds) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return thresholds.find(item => number <= item.max)?.label ?? null;
}

export function historicalEnergyClass(value) {
  return historicalClass(value, HISTORICAL_ENERGY_THRESHOLDS);
}

export function historicalGesClass(value) {
  return historicalClass(value, HISTORICAL_GES_THRESHOLDS);
}

export function deriveCalculationInputs(row = {}) {
  return Object.freeze({
    cep: pickFirst(row, CALCULATION_FIELDS.cep),
    ges: pickFirst(row, CALCULATION_FIELDS.ges),
    surface: pickFirst(row, CALCULATION_FIELDS.surface),
  });
}

export function describeCore() {
  return Object.freeze({
    contract: DPE_ADEME_CONTRACT,
    version: DPE_ADEME_CORE_VERSION,
    semanticLocks: Object.freeze([
      'ADEME_DATA_IS_NOT_MANUAL_LOCAL_DATA',
      'RECOMPOSED_CLASS_IS_NOT_PROOF_OF_CORRECT_DIAGNOSIS',
      'HISTORICAL_RULE_IS_NOT_CURRENT_RULE',
      'REPRODUCIBLE_CALCULATION_IS_NOT_FULL_DPE_AUDIT',
      'SAME_ADDRESS_IS_NOT_SAME_DWELLING',
      'BUILDING_CONVERGENCE_IS_NOT_EXTERNAL_ACCURACY',
    ]),
  });
}
