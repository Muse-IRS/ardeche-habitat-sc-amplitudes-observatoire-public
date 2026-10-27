export const SIMULATOR_CONTRACT = 'DPE_3CL_SCENARIO_CORE_V1'
export const SIMULATOR_VERSION = '0.3.0'

export const SYSTEM_PRESETS = Object.freeze({
  GAS_CONDENSING_HEATING: Object.freeze({
    id: 'GAS_CONDENSING_HEATING',
    label: 'Chaudière gaz à condensation après 2015 — chauffage seul',
    topology: 'SIMPLE_HEATING',
    mapping: Object.freeze({heatingTypeId: '97', energyId: '2'}),
  }),
  AIR_WATER_HP_HEATING: Object.freeze({
    id: 'AIR_WATER_HP_HEATING',
    label: 'PAC air/eau après 2017 — chauffage seul',
    topology: 'SIMPLE_HEATING',
    mapping: Object.freeze({heatingTypeId: '7', energyId: '1'}),
  }),
  GAS_CONDENSING_MIXED: Object.freeze({
    id: 'GAS_CONDENSING_MIXED',
    label: 'Chaudière gaz à condensation après 2015 — chauffage + ECS',
    topology: 'SIMPLE_MIXED',
    mapping: Object.freeze({heatingTypeId: '97', ecsTypeId: '57', energyId: '2'}),
  }),
  OUTDOOR_AIR_CET: Object.freeze({
    id: 'OUTDOOR_AIR_CET',
    label: 'Chauffe-eau thermodynamique sur air extérieur après 2014',
    topology: 'SIMPLE_ECS',
    mapping: Object.freeze({ecsTypeId: '6', energyId: '1', thermoPeriodId: '3'}),
  }),
})

export const VENTILATION_PRESETS = Object.freeze({
  VMC_SF_AUTO_AFTER_2012: Object.freeze({
    id: 'VMC_SF_AUTO_AFTER_2012',
    label: 'VMC simple flux autoréglable après 2012',
    typeId: '6',
    post2012: 1,
  }),
  VMC_SF_HYGRO_A_AFTER_2012: Object.freeze({
    id: 'VMC_SF_HYGRO_A_AFTER_2012',
    label: 'VMC simple flux Hygro A après 2012',
    typeId: '9',
    post2012: 1,
  }),
  VMC_SF_HYGRO_B_AFTER_2012: Object.freeze({
    id: 'VMC_SF_HYGRO_B_AFTER_2012',
    label: 'VMC simple flux Hygro B après 2012',
    typeId: '15',
    post2012: 1,
  }),
  VMC_DF_INDIVIDUAL_AFTER_2013: Object.freeze({
    id: 'VMC_DF_INDIVIDUAL_AFTER_2013',
    label: 'VMC double flux individuelle avec échangeur à partir de 2013',
    typeId: '20',
    post2012: 1,
  }),
})

const GENERATOR_STALE_FIELDS = Object.freeze([
  'tv_rendement_generation_id',
  'tv_scop_id',
  'tv_temp_fonc_100_id',
  'tv_temp_fonc_30_id',
  'tv_generateur_combustion_id',
  'tv_reseau_chaleur_id',
  'identifiant_reseau_chaleur',
  'date_arrete_reseau_chaleur',
  'priorite_generateur_cascade',
  'ref_produit_generateur_ch',
  'ref_produit_generateur_ecs',
  'presence_ventouse',
  'presence_regulation_combustion',
  'pn',
  'qp0',
  'rpn',
  'rpint',
  'temp_fonc_30',
  'temp_fonc_100',
  'scop',
  'cop',
])

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null
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

function addChange(changes, path, previous, next, semantics = 'SIMULATED_INPUT') {
  if (String(previous ?? '') === String(next ?? '')) return
  changes.push(Object.freeze({
    path,
    previous: previous ?? null,
    next: next ?? null,
    semantics,
  }))
}

function setField(entry, basePath, field, next, changes) {
  const previous = entry[field]
  entry[field] = next
  addChange(changes, basePath + '.' + field, previous, next)
}

function deleteField(entry, basePath, field, changes) {
  if (!Object.prototype.hasOwnProperty.call(entry, field)) return
  const previous = entry[field]
  delete entry[field]
  addChange(changes, basePath + '.' + field, previous, null)
}

function clearGeneratorSpecificFields(entry, basePath, changes) {
  for (const field of GENERATOR_STALE_FIELDS) deleteField(entry, basePath, field, changes)
}

function patchCollection(items, collectionPath, field, nextValue, extra = {}) {
  const changes = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!item?.donnee_entree) continue
    const entry = item.donnee_entree
    const basePath = collectionPath + '[' + i + '].donnee_entree'
    for (const [key, value] of Object.entries(extra)) setField(entry, basePath, key, value, changes)
    setField(entry, basePath, field, nextValue, changes)
  }
  return changes
}

function heatingInstallations(dpe) {
  return asArray(dpe?.logement?.installation_chauffage_collection?.installation_chauffage)
}

function ecsInstallations(dpe) {
  return asArray(dpe?.logement?.installation_ecs_collection?.installation_ecs)
}

function ventilationItems(dpe) {
  return asArray(dpe?.logement?.ventilation_collection?.ventilation)
}

function heatingGenerators(installation) {
  return asArray(installation?.generateur_chauffage_collection?.generateur_chauffage)
}

function ecsGenerators(installation) {
  return asArray(installation?.generateur_ecs_collection?.generateur_ecs)
}

function isIndividualSimpleHeatingInstallation(installation) {
  const entry = installation?.donnee_entree || {}
  return String(entry.enum_type_installation_id) === '1' &&
    String(entry.enum_cfg_installation_ch_id) === '1'
}

function isIndividualSimpleEcsInstallation(installation) {
  const entry = installation?.donnee_entree || {}
  return String(entry.enum_type_installation_id) === '1' &&
    String(entry.enum_cfg_installation_ecs_id) === '1'
}

export function analyzeSystemTopology(dpe = {}) {
  const heating = heatingInstallations(dpe)
  const ecs = ecsInstallations(dpe)
  const heatingGen = heating.flatMap(heatingGenerators)
  const ecsGen = ecs.flatMap(ecsGenerators)
  const ventilation = ventilationItems(dpe)

  const simpleHeating =
    heating.length === 1 &&
    isIndividualSimpleHeatingInstallation(heating[0]) &&
    heatingGen.length === 1 &&
    String(heatingGen[0]?.donnee_entree?.enum_usage_generateur_id) === '1' &&
    !heatingGen[0]?.donnee_entree?.reference_generateur_mixte &&
    heatingGen[0]?.donnee_entree?.priorite_generateur_cascade == null

  const simpleEcs =
    ecs.length === 1 &&
    isIndividualSimpleEcsInstallation(ecs[0]) &&
    ecsGen.length === 1 &&
    String(ecsGen[0]?.donnee_entree?.enum_usage_generateur_id) === '2' &&
    !ecsGen[0]?.donnee_entree?.reference_generateur_mixte

  const hMixed = heating.length === 1 && isIndividualSimpleHeatingInstallation(heating[0]) && heatingGen.length === 1
    ? heatingGen[0]
    : null
  const eMixed = ecs.length === 1 && isIndividualSimpleEcsInstallation(ecs[0]) && ecsGen.length === 1
    ? ecsGen[0]
    : null
  const hRef = hMixed?.donnee_entree?.reference_generateur_mixte
  const eRef = eMixed?.donnee_entree?.reference_generateur_mixte
  const simpleMixed = Boolean(
    hMixed &&
    eMixed &&
    String(hMixed.donnee_entree?.enum_usage_generateur_id) === '3' &&
    String(eMixed.donnee_entree?.enum_usage_generateur_id) === '3' &&
    hRef &&
    eRef &&
    String(hRef) === String(eRef) &&
    hMixed.donnee_entree?.priorite_generateur_cascade == null
  )

  const simpleVentilation = ventilation.length === 1 && Boolean(ventilation[0]?.donnee_entree)

  return Object.freeze({
    heatingInstallations: heating.length,
    heatingGenerators: heatingGen.length,
    ecsInstallations: ecs.length,
    ecsGenerators: ecsGen.length,
    ventilationObjects: ventilation.length,
    simpleHeating,
    simpleEcs,
    simpleMixed,
    simpleVentilation,
    supportedPresets: Object.freeze({
      GAS_CONDENSING_HEATING: simpleHeating,
      AIR_WATER_HP_HEATING: simpleHeating,
      GAS_CONDENSING_MIXED: simpleMixed,
      OUTDOOR_AIR_CET: simpleEcs,
    }),
    supportedVentilationPresets: Object.freeze(
      Object.fromEntries(Object.keys(VENTILATION_PRESETS).map(id => [id, simpleVentilation]))
    ),
  })
}

function presetIssue(topology, presetId) {
  if (!presetId) return null
  if (!SYSTEM_PRESETS[presetId]) return 'PRESET_UNKNOWN'
  if (topology.supportedPresets[presetId]) return null
  const required = SYSTEM_PRESETS[presetId].topology
  if (required === 'SIMPLE_HEATING') return 'PRESET_REQUIRES_SINGLE_INDIVIDUAL_HEATING_GENERATOR'
  if (required === 'SIMPLE_ECS') return 'PRESET_REQUIRES_SINGLE_INDIVIDUAL_ECS_GENERATOR'
  if (required === 'SIMPLE_MIXED') return 'PRESET_REQUIRES_MATCHED_SINGLE_MIXED_HEATING_ECS_GENERATOR'
  return 'PRESET_TOPOLOGY_UNSUPPORTED'
}

function patchHeatingGenerator(generator, indexPath, mapping, usageId, description, changes) {
  const entry = generator?.donnee_entree
  if (!entry) return
  clearGeneratorSpecificFields(entry, indexPath, changes)
  setField(entry, indexPath, 'description', description, changes)
  setField(entry, indexPath, 'enum_type_generateur_ch_id', mapping.heatingTypeId, changes)
  setField(entry, indexPath, 'enum_type_energie_id', mapping.energyId, changes)
  setField(entry, indexPath, 'enum_usage_generateur_id', usageId, changes)
  setField(entry, indexPath, 'enum_methode_saisie_carac_sys_id', '1', changes)
}

function patchEcsGenerator(generator, indexPath, mapping, usageId, description, changes, options = {}) {
  const entry = generator?.donnee_entree
  if (!entry) return
  clearGeneratorSpecificFields(entry, indexPath, changes)
  setField(entry, indexPath, 'description', description, changes)
  setField(entry, indexPath, 'enum_type_generateur_ecs_id', mapping.ecsTypeId, changes)
  setField(entry, indexPath, 'enum_type_energie_id', mapping.energyId, changes)
  setField(entry, indexPath, 'enum_usage_generateur_id', usageId, changes)
  setField(entry, indexPath, 'enum_methode_saisie_carac_sys_id', '1', changes)

  if (mapping.thermoPeriodId) {
    setField(entry, indexPath, 'enum_periode_installation_ecs_thermo_id', mapping.thermoPeriodId, changes)
    setField(entry, indexPath, 'enum_type_stockage_ecs_id', '3', changes)
    const volume = finite(options.ecsVolume) ?? finite(entry.volume_stockage)
    if (volume !== null && volume > 0) setField(entry, indexPath, 'volume_stockage', volume, changes)
    if (options.ecsInsideHeatedVolume === true) setField(entry, indexPath, 'position_volume_chauffe', 1, changes)
    if (options.ecsInsideHeatedVolume === false) setField(entry, indexPath, 'position_volume_chauffe', 0, changes)
  } else {
    deleteField(entry, indexPath, 'enum_periode_installation_ecs_thermo_id', changes)
  }
}

function applySystemPreset(dpe, scenario, changes, issues) {
  const presetId = scenario.systemPreset || null
  if (!presetId) return

  const topology = analyzeSystemTopology(dpe)
  const issue = presetIssue(topology, presetId)
  if (issue) {
    issues.push(issue)
    return
  }

  const preset = SYSTEM_PRESETS[presetId]
  const heating = heatingInstallations(dpe)
  const ecs = ecsInstallations(dpe)

  if (presetId === 'GAS_CONDENSING_HEATING') {
    patchHeatingGenerator(
      heatingGenerators(heating[0])[0],
      'logement.installation_chauffage_collection.installation_chauffage[0].generateur_chauffage_collection.generateur_chauffage[0].donnee_entree',
      preset.mapping,
      '1',
      'Scénario — chaudière gaz à condensation après 2015',
      changes
    )
  }

  if (presetId === 'AIR_WATER_HP_HEATING') {
    patchHeatingGenerator(
      heatingGenerators(heating[0])[0],
      'logement.installation_chauffage_collection.installation_chauffage[0].generateur_chauffage_collection.generateur_chauffage[0].donnee_entree',
      preset.mapping,
      '1',
      'Scénario — PAC air/eau installée après 2017',
      changes
    )
  }

  if (presetId === 'GAS_CONDENSING_MIXED') {
    const h = heatingGenerators(heating[0])[0]
    const e = ecsGenerators(ecs[0])[0]
    patchHeatingGenerator(
      h,
      'logement.installation_chauffage_collection.installation_chauffage[0].generateur_chauffage_collection.generateur_chauffage[0].donnee_entree',
      preset.mapping,
      '3',
      'Scénario — chaudière gaz à condensation après 2015',
      changes
    )
    patchEcsGenerator(
      e,
      'logement.installation_ecs_collection.installation_ecs[0].generateur_ecs_collection.generateur_ecs[0].donnee_entree',
      preset.mapping,
      '3',
      'Scénario — chaudière gaz à condensation après 2015',
      changes
    )
  }

  if (presetId === 'OUTDOOR_AIR_CET') {
    const e = ecsGenerators(ecs[0])[0]
    const currentVolume = finite(e?.donnee_entree?.volume_stockage)
    const scenarioVolume = finite(scenario.ecsVolume)
    if ((scenarioVolume === null || scenarioVolume <= 0) && (currentVolume === null || currentVolume <= 0)) {
      issues.push('CET_REQUIRES_POSITIVE_STORAGE_VOLUME')
      return
    }
    if (scenario.ecsInsideHeatedVolume == null && e?.donnee_entree?.position_volume_chauffe == null) {
      issues.push('CET_REQUIRES_STORAGE_POSITION')
      return
    }
    patchEcsGenerator(
      e,
      'logement.installation_ecs_collection.installation_ecs[0].generateur_ecs_collection.generateur_ecs[0].donnee_entree',
      preset.mapping,
      '2',
      'Scénario — chauffe-eau thermodynamique sur air extérieur après 2014',
      changes,
      {
        ecsVolume: scenarioVolume,
        ecsInsideHeatedVolume: scenario.ecsInsideHeatedVolume,
      }
    )
  }
}

function applyVentilationPreset(dpe, scenario, changes, issues) {
  const presetId = scenario.ventilationPreset || null
  if (!presetId) return

  const preset = VENTILATION_PRESETS[presetId]
  if (!preset) {
    issues.push('VENTILATION_PRESET_UNKNOWN')
    return
  }

  const ventilation = ventilationItems(dpe)
  if (ventilation.length !== 1 || !ventilation[0]?.donnee_entree) {
    issues.push('VENTILATION_PRESET_REQUIRES_SINGLE_VENTILATION_OBJECT')
    return
  }

  const entry = ventilation[0].donnee_entree
  const path = 'logement.ventilation_collection.ventilation[0].donnee_entree'
  deleteField(entry, path, 'tv_debits_ventilation_id', changes)
  deleteField(entry, path, 'ref_produit_ventilation', changes)
  setField(entry, path, 'enum_type_ventilation_id', preset.typeId, changes)
  setField(entry, path, 'ventilation_post_2012', preset.post2012, changes)
  setField(entry, path, 'description', 'Scénario — ' + preset.label, changes)
}

export function applyScenario(baseline, scenario = {}) {
  const dpe = clone(baseline)
  const changes = []
  const issues = []
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

  applySystemPreset(dpe, scenario, changes, issues)
  applyVentilationPreset(dpe, scenario, changes, issues)

  return Object.freeze({
    contract: SIMULATOR_CONTRACT,
    version: SIMULATOR_VERSION,
    scenario: Object.freeze({
      wallU,
      roofU,
      floorU,
      windowUw,
      systemPreset: scenario.systemPreset || null,
      ecsVolume: finite(scenario.ecsVolume),
      ecsInsideHeatedVolume: scenario.ecsInsideHeatedVolume ?? null,
      ventilationPreset: scenario.ventilationPreset || null,
    }),
    topology: analyzeSystemTopology(baseline),
    issues: Object.freeze(issues),
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
    topology: scenarioResult.topology,
    issues: scenarioResult.issues,
    changes: scenarioResult.changes,
    comparison,
    semanticLocks: Object.freeze([
      'PROJECTION_IS_NOT_REGULATORY_DPE',
      'SIMULATED_INPUT_IS_NOT_OBSERVED_STATE',
      'CALCULATION_IS_NOT_PHYSICAL_INSPECTION',
      'TOPOLOGY_REFUSAL_IS_VALID_RESULT',
      'DIVERGENCE_IS_NOT_FAULT',
    ]),
  })
}
