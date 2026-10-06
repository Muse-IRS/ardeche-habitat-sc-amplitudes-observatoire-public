export const DPE_ADEME_CORE_VERSION = '1.0.0';
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

export const HISTORICAL_ENERGY_THRESHOLDS = Object.freeze([
  Object.freeze({ label: 'A', max: 50 }), Object.freeze({ label: 'B', max: 90 }), Object.freeze({ label: 'C', max: 150 }),
  Object.freeze({ label: 'D', max: 230 }), Object.freeze({ label: 'E', max: 330 }), Object.freeze({ label: 'F', max: 450 }), Object.freeze({ label: 'G', max: Infinity }),
]);
export const HISTORICAL_GES_THRESHOLDS = Object.freeze([
  Object.freeze({ label: 'A', max: 5 }), Object.freeze({ label: 'B', max: 10 }), Object.freeze({ label: 'C', max: 20 }),
  Object.freeze({ label: 'D', max: 35 }), Object.freeze({ label: 'E', max: 55 }), Object.freeze({ label: 'F', max: 80 }), Object.freeze({ label: 'G', max: Infinity }),
]);

export function normalizeDpeNumber(value) { return String(value ?? '').trim().toUpperCase(); }
export function isValidDpeNumber(value) { return DPE_PATTERN.test(normalizeDpeNumber(value)); }
export function normalizeSearchText(value) { return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
export function hasValue(value) { return value !== undefined && value !== null && value !== ''; }
export function pickFirst(row = {}, keys = []) { for (const key of keys) if (hasValue(row[key])) return row[key]; return null; }
export function isHistoricalDataset(dataset) { return dataset?.generation === 'historical' || dataset?.id === 'dpe-france'; }
export function electricityFactorForDate(value) { const raw = value ? String(value).slice(0, 10) : '1970-01-01'; if (raw >= '2027-01-01') return 1.7; if (raw >= '2026-01-01') return 1.9; return 2.3; }
export function addTenYears(value) { const raw = String(value ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null; const date = new Date(`${raw}T00:00:00Z`); if (Number.isNaN(date.getTime())) return null; date.setUTCFullYear(date.getUTCFullYear() + 10); return date.toISOString().slice(0, 10); }
export function historicalValidity(establishedValue, referenceDateValue) {
  const established = String(establishedValue ?? '').slice(0, 10); const referenceDate = String(referenceDateValue ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(established)) return Object.freeze({ expiry: null, status: 'DPE historique — validité à vérifier à partir de sa date d’établissement', rule: '' });
  let expiry; let rule;
  if (established >= '2013-01-01' && established <= '2017-12-31') { expiry = '2022-12-31'; rule = 'échéance transitoire applicable aux DPE établis de 2013 à 2017'; }
  else if (established >= '2018-01-01' && established <= '2021-06-30') { expiry = '2024-12-31'; rule = 'échéance transitoire applicable aux DPE établis du 1er janvier 2018 au 30 juin 2021'; }
  else { expiry = addTenYears(established); rule = 'durée de validité de référence de dix ans ; les DPE les plus anciens sont aujourd’hui expirés'; }
  const comparableReference = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : null;
  return Object.freeze({ expiry, status: comparableReference && expiry && comparableReference > expiry ? 'Expiré' : 'Validité à vérifier', rule });
}
export function historicalClass(value, thresholds) { const number = Number(value); if (!Number.isFinite(number) || number < 0) return null; return thresholds.find(item => number <= item.max)?.label ?? null; }
export function historicalEnergyClass(value) { return historicalClass(value, HISTORICAL_ENERGY_THRESHOLDS); }
export function historicalGesClass(value) { return historicalClass(value, HISTORICAL_GES_THRESHOLDS); }
export function deriveCalculationInputs(row = {}) { return Object.freeze({ cep: pickFirst(row, CALCULATION_FIELDS.cep), ges: pickFirst(row, CALCULATION_FIELDS.ges), surface: pickFirst(row, CALCULATION_FIELDS.surface) }); }
export function describeCore() { return Object.freeze({ contract: DPE_ADEME_CONTRACT, version: DPE_ADEME_CORE_VERSION, semanticLocks: Object.freeze(['ADEME_DATA_IS_NOT_MANUAL_LOCAL_DATA','RECOMPOSED_CLASS_IS_NOT_PROOF_OF_CORRECT_DIAGNOSIS','HISTORICAL_RULE_IS_NOT_CURRENT_RULE','REPRODUCIBLE_CALCULATION_IS_NOT_FULL_DPE_AUDIT']) }); }
