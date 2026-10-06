import {
  calculateEquipmentCoverage,
  coverageToGauge,
  COVERAGE_STATES,
} from './core.js';

const DEFAULT_EXAMPLE = Object.freeze({
  equipmentCostUnit: 3500,
  units: 1,
  monthlyRent: 500,
  years: 15,
  vacancyRate: 5,
  allocationRate: 5,
});

const STATUS_LABELS = Object.freeze({
  [COVERAGE_STATES.LOW]: 'Coût initial faiblement couvert selon ces données',
  [COVERAGE_STATES.IN_PROGRESS]: 'Couverture en cours selon ces données',
  [COVERAGE_STATES.THRESHOLD_REACHED]: 'Seuil du coût initial atteint selon ces données',
});

function qs(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing calculator element: ${selector}`);
  return element;
}

function readNumber(root, name) {
  return Number(qs(root, `[data-eec-input="${name}"]`).value);
}

function writeInput(root, name, value) {
  qs(root, `[data-eec-input="${name}"]`).value = String(value);
}

function setText(root, name, value) {
  qs(root, `[data-eec-output="${name}"]`).textContent = value;
}

function getDataStatus(root, name) {
  const element = qs(root, `[data-eec-input="${name}"]`);
  return element.value;
}

export function bindEquipmentCoverageCalculator(root, options = {}) {
  if (!root) throw new TypeError('root is required');

  const locale = options.locale ?? 'fr-FR';
  const currency = options.currency ?? 'EUR';
  const gaugeMax = Number(options.gaugeMax ?? 150);
  const example = Object.freeze({ ...DEFAULT_EXAMPLE, ...(options.example ?? {}) });

  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const form = qs(root, '[data-eec-form]');
  const needle = qs(root, '[data-eec-needle]');
  const results = qs(root, '[data-eec-results]');
  const status = qs(root, '[data-eec-status]');
  const epistemic = qs(root, '[data-eec-epistemic]');

  function resetView() {
    needle.style.transform = 'rotate(-90deg)';
    setText(root, 'coverageRate', '—');
    status.textContent = 'Aucun calcul';
    epistemic.textContent = 'SCÉNARIO NON CALCULÉ';
    results.hidden = true;
  }

  function render(result) {
    const gauge = coverageToGauge(result.coverageRate, gaugeMax);
    needle.style.transform = `rotate(${gauge.angle}deg)`;

    setText(root, 'coverageRate', `${pct.format(result.coverageRate)} %`);
    setText(root, 'rentTotal', money.format(result.rentTotal));
    setText(root, 'capexTotal', money.format(result.capexTotal));
    setText(root, 'allocatedAmount', money.format(result.allocatedAmount));
    setText(root, 'requiredShare', result.requiredShare === null ? 'Indéterminable' : `${pct.format(result.requiredShare)} %`);
    setText(root, 'remainingAmount', money.format(result.remainingAmount));
    setText(root, 'excessAmount', money.format(result.excessAmount));

    status.textContent = STATUS_LABELS[result.coverageState] ?? result.coverageState;

    const costStatus = getDataStatus(root, 'costStatus');
    const rentStatus = getDataStatus(root, 'rentStatus');
    epistemic.textContent = costStatus === 'documented' && rentStatus === 'documented'
      ? 'DONNÉES DÉCLARÉES DOCUMENTÉES · CALCUL ARITHMÉTIQUE'
      : 'SCÉNARIO / ESTIMATION';

    results.hidden = false;
    root.dispatchEvent(new CustomEvent('eec:calculated', { detail: result }));
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = calculateEquipmentCoverage({
        equipmentCostUnit: readNumber(root, 'equipmentCostUnit'),
        units: readNumber(root, 'units'),
        monthlyRent: readNumber(root, 'monthlyRent'),
        years: readNumber(root, 'years'),
        vacancyRate: readNumber(root, 'vacancyRate'),
        allocationRate: readNumber(root, 'allocationRate'),
      });
      render(result);
    } catch (error) {
      status.textContent = 'Vérifier les valeurs saisies.';
      root.dispatchEvent(new CustomEvent('eec:error', { detail: { error } }));
    }
  });

  const exampleButton = root.querySelector('[data-eec-action="example"]');
  if (exampleButton) {
    exampleButton.addEventListener('click', () => {
      writeInput(root, 'equipmentCostUnit', example.equipmentCostUnit);
      writeInput(root, 'units', example.units);
      writeInput(root, 'monthlyRent', example.monthlyRent);
      writeInput(root, 'years', example.years);
      writeInput(root, 'vacancyRate', example.vacancyRate);
      writeInput(root, 'allocationRate', example.allocationRate);
      writeInput(root, 'costStatus', 'estimate');
      writeInput(root, 'rentStatus', 'scenario');
      form.requestSubmit();
    });
  }

  const resetButton = root.querySelector('[data-eec-action="reset"]');
  if (resetButton) {
    resetButton.addEventListener('click', () => setTimeout(resetView, 0));
  }

  resetView();
  return Object.freeze({ render, resetView });
}

export function autoBindEquipmentCoverageCalculators(options = {}) {
  const roots = document.querySelectorAll('[data-eec-calculator]');
  return Array.from(roots, root => bindEquipmentCoverageCalculator(root, options));
}
