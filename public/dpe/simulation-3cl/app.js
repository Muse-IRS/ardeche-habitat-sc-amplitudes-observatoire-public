import {
  SYSTEM_PRESETS,
  VENTILATION_PRESETS,
  analyzeSystemTopology,
  applyScenario,
  buildProjectionReport,
  compareCalculated,
} from '../../assets/dpe-3cl-simulator/core.js'
import {
  calculateFromSource,
  calculateScenario,
} from '../../assets/dpe-3cl-simulator/open3cl-provider.js'

const fileInput = document.querySelector('#source-file')
const baselineButton = document.querySelector('#calculate-baseline')
const sourceStatus = document.querySelector('#source-status')
const baselinePanel = document.querySelector('#baseline-panel')
const baselineResults = document.querySelector('#baseline-results')
const engineStatus = document.querySelector('#engine-status')
const scenarioPanel = document.querySelector('#scenario-panel')
const scenarioButton = document.querySelector('#run-scenario')
const resetButton = document.querySelector('#reset-scenario')
const scenarioStatus = document.querySelector('#scenario-status')
const projectionPanel = document.querySelector('#projection-panel')
const projectionResults = document.querySelector('#projection-results')
const changesBody = document.querySelector('#changes-body')
const exportButton = document.querySelector('#export-report')
const systemPreset = document.querySelector('#system-preset')
const systemTopologyStatus = document.querySelector('#system-topology-status')
const ecsVolumeField = document.querySelector('#ecs-volume-field')
const ecsPositionField = document.querySelector('#ecs-position-field')
const ecsVolume = document.querySelector('#ecs-volume')
const ecsPosition = document.querySelector('#ecs-position')
const ventilationPreset = document.querySelector('#ventilation-preset')

const fields = {
  wallU: document.querySelector('#wall-u'),
  roofU: document.querySelector('#roof-u'),
  floorU: document.querySelector('#floor-u'),
  windowUw: document.querySelector('#window-uw'),
}

let sourceFile = null
let baselineInput = null
let baselineCalculated = null
let engineVersion = null
let currentReport = null
let currentTopology = null

function issueMessage(issue) {
  const messages = {
    PRESET_UNKNOWN: 'Preset système inconnu.',
    PRESET_REQUIRES_SINGLE_INDIVIDUAL_HEATING_GENERATOR: 'Ce preset exige une installation individuelle simple avec un seul générateur de chauffage principal.',
    PRESET_REQUIRES_SINGLE_INDIVIDUAL_ECS_GENERATOR: 'Ce preset exige une installation ECS individuelle simple avec un seul générateur ECS indépendant.',
    PRESET_REQUIRES_MATCHED_SINGLE_MIXED_HEATING_ECS_GENERATOR: 'Ce preset exige un unique générateur mixte chauffage/ECS, apparié par la même référence dans les deux collections.',
    CET_REQUIRES_POSITIVE_STORAGE_VOLUME: 'Le chauffe-eau thermodynamique nécessite un volume de stockage positif. Renseigner le volume après travaux.',
    CET_REQUIRES_STORAGE_POSITION: 'Le chauffe-eau thermodynamique nécessite de connaître si le stockage est dans le volume chauffé.',
    PRESET_TOPOLOGY_UNSUPPORTED: 'Topologie système non prise en charge par ce preset.',
    VENTILATION_PRESET_UNKNOWN: 'Preset ventilation inconnu.',
    VENTILATION_PRESET_REQUIRES_SINGLE_VENTILATION_OBJECT: 'Ce preset ventilation exige un unique objet ventilation dans le DPE.',
  }
  return messages[issue] || issue
}

function updatePresetAvailability() {
  if (!currentTopology) return
  for (const option of systemPreset.options) {
    if (!option.value) {
      option.disabled = false
      continue
    }
    option.disabled = !currentTopology.supportedPresets[option.value]
  }
  const supported = Object.entries(currentTopology.supportedPresets)
    .filter(([, ok]) => ok)
    .map(([id]) => SYSTEM_PRESETS[id]?.label || id)
  const supportedVentilation = Object.entries(currentTopology.supportedVentilationPresets || {})
    .filter(([, ok]) => ok)
    .map(([id]) => VENTILATION_PRESETS[id]?.label || id)

  for (const option of ventilationPreset.options) {
    if (!option.value) {
      option.disabled = false
      continue
    }
    option.disabled = !currentTopology.supportedVentilationPresets?.[option.value]
  }

  const topologySummary =
    'Chauffage : ' + currentTopology.heatingInstallations + ' installation(s), ' + currentTopology.heatingGenerators + ' générateur(s) · ' +
    'ECS : ' + currentTopology.ecsInstallations + ' installation(s), ' + currentTopology.ecsGenerators + ' générateur(s) · ' +
    'Ventilation : ' + currentTopology.ventilationObjects + ' objet(s). '

  const compatible = [...supported, ...supportedVentilation]
  systemTopologyStatus.textContent = topologySummary + (
    compatible.length
      ? compatible.length + ' scénario(s) compatible(s) — ' + compatible.join(' ; ')
      : 'Aucun preset V0.3 n’est applicable sans simplification.'
  )
}

function updateSystemFields() {
  const isCet = systemPreset.value === 'OUTDOOR_AIR_CET'
  ecsVolumeField.hidden = !isCet
  ecsPositionField.hidden = !isCet
}

systemPreset.addEventListener('change', updateSystemFields)

function numberFromInput(input) {
  const raw = String(input.value || '').trim().replace(',', '.')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function format(value, unit = '') {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return value.toLocaleString('fr-FR', {maximumFractionDigits:2}) + unit
  return String(value) + unit
}

function metric(label, value, detail = '') {
  const div = document.createElement('div')
  div.className = 'metric'
  const strong = document.createElement('strong')
  strong.textContent = value
  const span = document.createElement('span')
  span.textContent = label + (detail ? ' · ' + detail : '')
  div.append(strong, span)
  return div
}

function renderOutput(target, output, delta = null) {
  target.innerHTML = ''
  target.append(
    metric('Énergie primaire', format(output.energy, ' kWhEP/m²/an'), delta?.energyPercent !== null && delta ? format(delta.energyPercent, ' %') : ''),
    metric('Classe énergie', format(output.energyClass)),
    metric('Émissions', format(output.climate, ' kgCO₂e/m²/an'), delta?.climatePercent !== null && delta ? format(delta.climatePercent, ' %') : ''),
    metric('Classe climat', format(output.climateClass)),
    metric('Coût annuel 5 usages', output.annualCost === null ? '—' : format(output.annualCost, ' €'), delta?.annualCostPercent !== null && delta ? format(delta.annualCostPercent, ' %') : '')
  )
}

function sourceKind(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xml')) return 'xml'
  if (name.endsWith('.json')) return 'json'
  return null
}

async function readFile(file) {
  return await file.text()
}

fileInput.addEventListener('change', () => {
  sourceFile = fileInput.files?.[0] || null
  baselinePanel.hidden = true
  scenarioPanel.hidden = true
  projectionPanel.hidden = true
  currentReport = null
  sourceStatus.textContent = sourceFile ? 'Fichier sélectionné : ' + sourceFile.name : 'Aucun fichier chargé.'
})

baselineButton.addEventListener('click', async () => {
  if (!sourceFile) {
    sourceStatus.textContent = 'Sélectionner d’abord un fichier XML ou JSON.'
    return
  }
  const kind = sourceKind(sourceFile)
  if (!kind) {
    sourceStatus.textContent = 'Format non reconnu : utiliser un fichier .xml ou .json.'
    return
  }

  baselineButton.disabled = true
  sourceStatus.textContent = 'Lecture locale du fichier et chargement du moteur 3CL…'
  try {
    const text = await readFile(sourceFile)
    const baseline = await calculateFromSource({kind, text})
    engineVersion = baseline.engineVersion
    baselineCalculated = baseline.calculated
    baselineInput = baseline.input
    currentTopology = analyzeSystemTopology(baselineCalculated)
    systemPreset.value = ''
    ventilationPreset.value = ''
    updateSystemFields()
    updatePresetAvailability()

    const comparison = compareCalculated(baselineCalculated, baselineCalculated)
    renderOutput(baselineResults, comparison.before)
    engineStatus.textContent = 'Moteur : Open3CL ' + (engineVersion || 'version non retournée') + ' · calcul local dans le navigateur.'
    baselinePanel.hidden = false
    scenarioPanel.hidden = false
    projectionPanel.hidden = true
    sourceStatus.textContent = 'Référence 3CL calculée localement.'
  } catch (error) {
    console.error(error)
    sourceStatus.textContent = 'Le calcul a échoué. Vérifier que le fichier correspond à un DPE XML/JSON compatible 3CL-DPE 2021 et que le moteur externe est accessible.'
  } finally {
    baselineButton.disabled = false
  }
})

scenarioButton.addEventListener('click', async () => {
  if (!baselineCalculated) {
    scenarioStatus.textContent = 'Calculer d’abord la situation de référence.'
    return
  }

  const positionValue = ecsPosition.value === 'yes' ? true : ecsPosition.value === 'no' ? false : null
  const scenario = {
    wallU: numberFromInput(fields.wallU),
    roofU: numberFromInput(fields.roofU),
    floorU: numberFromInput(fields.floorU),
    windowUw: numberFromInput(fields.windowUw),
    systemPreset: systemPreset.value || null,
    ecsVolume: numberFromInput(ecsVolume),
    ecsInsideHeatedVolume: positionValue,
    ventilationPreset: ventilationPreset.value || null,
  }

  const hasEnvelopeChange = [scenario.wallU, scenario.roofU, scenario.floorU, scenario.windowUw].some(value => value !== null)
  if (!hasEnvelopeChange && !scenario.systemPreset && !scenario.ventilationPreset) {
    scenarioStatus.textContent = 'Saisir au moins une valeur d’enveloppe ou choisir un scénario chauffage/ECS/ventilation.'
    return
  }

  scenarioButton.disabled = true
  scenarioStatus.textContent = 'Application des hypothèses et recalcul 3CL…'
  try {
    const scenarioResult = applyScenario(baselineCalculated, scenario)

    if (scenarioResult.issues.length) {
      scenarioStatus.textContent = scenarioResult.issues.map(issueMessage).join(' ')
      return
    }

    if (!scenarioResult.changes.length) {
      scenarioStatus.textContent = 'Aucun composant compatible avec les hypothèses saisies n’a été trouvé dans ce DPE.'
      return
    }

    const after = await calculateScenario(scenarioResult.dpe)
    const comparison = compareCalculated(baselineCalculated, after.calculated)
    renderOutput(projectionResults, comparison.after, comparison.delta)

    changesBody.innerHTML = ''
    for (const change of scenarioResult.changes) {
      const tr = document.createElement('tr')
      for (const value of [change.path, change.previous, change.next, change.semantics]) {
        const td = document.createElement('td')
        td.textContent = value === null ? '—' : String(value)
        if (change.path === value) td.className = 'mono'
        tr.append(td)
      }
      changesBody.append(tr)
    }

    currentReport = buildProjectionReport({
      engineVersion: after.engineVersion || engineVersion,
      sourceName: sourceFile?.name,
      baselineCalculated,
      scenarioCalculated: after.calculated,
      scenarioResult,
    })

    projectionPanel.hidden = false
    scenarioStatus.textContent = scenarioResult.changes.length + ' modification(s) appliquée(s) au scénario ; projection recalculée.'
    projectionPanel.scrollIntoView({behavior:'smooth', block:'start'})
  } catch (error) {
    console.error(error)
    scenarioStatus.textContent = 'Le scénario n’a pas pu être recalculé. Certaines combinaisons d’entrées peuvent être incompatibles avec le moteur.'
  } finally {
    scenarioButton.disabled = false
  }
})

resetButton.addEventListener('click', () => {
  for (const input of Object.values(fields)) input.value = ''
  systemPreset.value = ''
  ventilationPreset.value = ''
  ecsVolume.value = ''
  ecsPosition.value = ''
  updateSystemFields()
  projectionPanel.hidden = true
  currentReport = null
  scenarioStatus.textContent = 'Scénario réinitialisé ; la référence reste chargée.'
})

exportButton.addEventListener('click', () => {
  if (!currentReport) return
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], {type:'application/json;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'projection-3cl-apres-travaux.json'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
})
