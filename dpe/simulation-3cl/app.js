import {
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

  const scenario = {
    wallU: numberFromInput(fields.wallU),
    roofU: numberFromInput(fields.roofU),
    floorU: numberFromInput(fields.floorU),
    windowUw: numberFromInput(fields.windowUw),
  }

  if (Object.values(scenario).every(value => value === null)) {
    scenarioStatus.textContent = 'Saisir au moins une valeur après travaux.'
    return
  }

  scenarioButton.disabled = true
  scenarioStatus.textContent = 'Application des hypothèses et recalcul 3CL…'
  try {
    const baselineObject = typeof baselineInput === 'string' ? baselineCalculated : baselineInput
    const scenarioResult = applyScenario(baselineObject, scenario)

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
