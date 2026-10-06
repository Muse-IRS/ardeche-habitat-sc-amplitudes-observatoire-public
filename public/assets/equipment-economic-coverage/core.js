export const EEC_CORE_VERSION = '1.0.0';
export const EEC_CONTRACT = 'EEC_CORE_V1';
export const DEFAULT_GAUGE_MAX = 150;

export const COVERAGE_STATES = Object.freeze({
  LOW: 'LOW_COVERAGE',
  IN_PROGRESS: 'COVERAGE_IN_PROGRESS',
  THRESHOLD_REACHED: 'INITIAL_COST_THRESHOLD_REACHED',
});

function finiteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  return number;
}

export function normalizeCoverageInputs(raw = {}) {
  return Object.freeze({
    equipmentCostUnit: finiteNumber(raw.equipmentCostUnit, 'equipmentCostUnit'),
    units: finiteNumber(raw.units, 'units'),
    monthlyRent: finiteNumber(raw.monthlyRent, 'monthlyRent'),
    years: finiteNumber(raw.years, 'years'),
    vacancyRate: finiteNumber(raw.vacancyRate ?? 0, 'vacancyRate'),
    allocationRate: finiteNumber(raw.allocationRate, 'allocationRate'),
  });
}

export function validateCoverageInputs(input) {
  const errors = [];
  if (!(input.equipmentCostUnit > 0)) errors.push('equipmentCostUnit must be > 0');
  if (!(input.units >= 1) || !Number.isInteger(input.units)) errors.push('units must be an integer >= 1');
  if (!(input.monthlyRent >= 0)) errors.push('monthlyRent must be >= 0');
  if (!(input.years > 0)) errors.push('years must be > 0');
  if (input.vacancyRate < 0 || input.vacancyRate > 100) errors.push('vacancyRate must be between 0 and 100');
  if (input.allocationRate < 0 || input.allocationRate > 100) errors.push('allocationRate must be between 0 and 100');
  return Object.freeze(errors);
}

export function classifyCoverage(coverageRate) {
  const rate = finiteNumber(coverageRate, 'coverageRate');
  if (rate >= 100) return COVERAGE_STATES.THRESHOLD_REACHED;
  if (rate >= 50) return COVERAGE_STATES.IN_PROGRESS;
  return COVERAGE_STATES.LOW;
}

export function coverageToGauge(coverageRate, gaugeMax = DEFAULT_GAUGE_MAX) {
  const rate = finiteNumber(coverageRate, 'coverageRate');
  const max = finiteNumber(gaugeMax, 'gaugeMax');
  if (!(max > 0)) throw new RangeError('gaugeMax must be > 0');
  const clampedRate = Math.min(Math.max(rate, 0), max);
  const angle = -90 + (clampedRate / max) * 180;
  return Object.freeze({ rate, clampedRate, gaugeMax: max, angle });
}

export function calculateEquipmentCoverage(rawInputs) {
  const input = normalizeCoverageInputs(rawInputs);
  const errors = validateCoverageInputs(input);
  if (errors.length) {
    const error = new RangeError(errors.join('; '));
    error.code = 'EEC_INVALID_INPUT';
    error.details = errors;
    throw error;
  }

  const occupancyFactor = 1 - input.vacancyRate / 100;
  const rentTotal = input.units * input.monthlyRent * 12 * input.years * occupancyFactor;
  const capexTotal = input.units * input.equipmentCostUnit;
  const allocatedAmount = rentTotal * (input.allocationRate / 100);
  const coverageRate = (allocatedAmount / capexTotal) * 100;
  const requiredShare = rentTotal > 0 ? (capexTotal / rentTotal) * 100 : null;
  const remainingAmount = Math.max(capexTotal - allocatedAmount, 0);
  const excessAmount = Math.max(allocatedAmount - capexTotal, 0);

  return Object.freeze({
    contract: EEC_CONTRACT,
    coreVersion: EEC_CORE_VERSION,
    input,
    rentTotal,
    capexTotal,
    allocatedAmount,
    coverageRate,
    requiredShare,
    remainingAmount,
    excessAmount,
    coverageState: classifyCoverage(coverageRate),
    netProfit: null,
    semanticLocks: Object.freeze([
      'COVERAGE_RATE_GT_100_DOES_NOT_MEAN_PROFIT',
      'RENT_IS_NOT_CHARGES',
      'ECONOMIC_RECOVERY_IS_NOT_ACCOUNTING_DEPRECIATION',
      'ECONOMIC_RECOVERY_IS_NOT_LOAN_REPAYMENT',
    ]),
  });
}
