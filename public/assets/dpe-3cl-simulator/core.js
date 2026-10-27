export const SIMULATOR_CONTRACT = 'DPE_3CL_SCENARIO_CORE_V1'
export const SIMULATOR_VERSION = '0.1.0'

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function finite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(value, digits = 2) {
  const n = finite(value)
  if (n === null) return null
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function getOutput(dpe = {}) {
  const sortie = dpe?.logement?.sortie || {}
  const ep = sortie.ep_conso || {}
  const ges = sortie.emission_ges || {}
  const cout = sortie.cout || {}
  return Object.freeze({
    energy: finite(ep.ep_conso_5_usages_m2),
    energyClass: ep.classe_bilan_dpe || null,
    climate: finite(ges.emission_ges_5_usages_m2),
    climateClass: ges.classe_emission_ges || null,
    annualCost: finite(cout.cout_5_usages),
  })
}

function delta(before, after) {
  if (before === null || after === null) return null
  return round(after - before, 2)
}

function percent(before, after) {
  if (before === null || after === null || before === 0) return null
  return round(((after - before) / before) * 100, 1)
}

function patchCollection(items, collectionPath, field, nextValue, extra = {}) {
  const changes = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!item?.donnee_entree) continue
    const entry = item.donnee_entree
    const previous = entry[field]
    Object.assign(entry, extra, {[field]: nextValue})
    changes.push(Object.freeze({
      path: collectionPath + '[' + i + '].donnee_entree.' + field,
      previous: previous ?? null,
      next: nextValue,
      semantics: 'SIMULATED_INPUT',
    }))
  }
  return changes
}

export function applyScenario(baseline, scenario = {}) {
  const dpe = clone(baseline)
  const changes = []
  const envelope = dpe?.logement?.enveloppe || {}

  const wallU = finite(scenario.wallU)
  if (wallU !== null) {
    changes.push(...patchCollection(
      asArray(envelope?.mur_collection?.mur),
      'logement.enveloppe.mur_collection.mur',
      'umur_saisi',
      wallU,
      {enum_methode_saisie_u_id: '9'}
    ))
  }

  const roofU = finite(scenario.roofU)
  if (roofU !== null) {
    changes.push(...patchCollection(
      asArray(envelope?.plancher_haut_collection?.plancher_haut),
      'logement.enveloppe.plancher_haut_collection.plancher_haut',
      'uph_saisi',
      roofU,
      {enum_methode_saisie_u_id: '9'}
    ))
  }

  const floorU = finite(scenario.floorU)
  if (floorU !== null) {
    changes.push(...patchCollection(
      asArray(envelope?.plancher_bas_collection?.plancher_bas),
      'logement.enveloppe.plancher_bas_collection.plancher_bas',
      'upb_saisi',
      floorU,
      {enum_methode_saisie_u_id: '9'}
    ))
  }

  const windowUw = finite(scenario.windowUw)
  if (windowUw !== null) {
    changes.push(...patchCollection(
      asArray(envelope?.baie_vitree_collection?.baie_vitree),
      'logement.enveloppe.baie_vitree_collection.baie_vitree',
      'uw_saisi',
      windowUw
    ))
  }

  return Object.freeze({
    contract: SIMULATOR_CONTRACT,
    version: SIMULATOR_VERSION,
    scenario: Object.freeze({
      wallU,
      roofU,
      floorU,
      windowUw,
    }),
    changes: Object.freeze(changes),
    dpe,
  })
}

export function compareCalculated(baselineCalculated, scenarioCalculated) {
  const before = getOutput(baselineCalculated)
  const after = getOutput(scenarioCalculated)
  return Object.freeze({
    before,
    after,
    delta: Object.freeze({
      energy: delta(before.energy, after.energy),
      energyPercent: percent(before.energy, after.energy),
      climate: delta(before.climate, after.climate),
      climatePercent: percent(before.climate, after.climate),
      annualCost: delta(before.annualCost, after.annualCost),
      annualCostPercent: percent(before.annualCost, after.annualCost),
      energyClassChanged: before.energyClass !== after.energyClass,
      climateClassChanged: before.climateClass !== after.climateClass,
    }),
  })
}

export function buildProjectionReport({engineVersion, sourceName, baselineCalculated, scenarioCalculated, scenarioResult}) {
  const comparison = compareCalculated(baselineCalculated, scenarioCalculated)
  return Object.freeze({
    contract: SIMULATOR_CONTRACT,
    simulatorVersion: SIMULATOR_VERSION,
    engine: Object.freeze({
      name: 'Open3CL',
      version: engineVersion || null,
      license: 'MIT',
    }),
    source: Object.freeze({
      fileName: sourceName || null,
      processing: 'LOCAL_BROWSER',
      uploadedToMuseIrs: false,
    }),
    status: 'INFORMATIVE_NON_REGULATORY_PROJECTION',
    scenario: scenarioResult.scenario,
    changes: scenarioResult.changes,
    comparison,
    semanticLocks: Object.freeze([
      'PROJECTION_IS_NOT_REGULATORY_DPE',
      'SIMULATED_INPUT_IS_NOT_OBSERVED_STATE',
      'CALCULATION_IS_NOT_PHYSICAL_INSPECTION',
      'DIVERGENCE_IS_NOT_FAULT',
    ]),
  })
}
