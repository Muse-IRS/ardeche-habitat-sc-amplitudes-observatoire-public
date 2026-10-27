import {
  compareBuildingRows,
  hasValue,
  normalizeDpeNumber,
} from '../assets/dpe-ademe/core.js'
import {
  findDpeByNumber,
  searchExistingDpesByAddress,
  searchExistingDpesForRow,
} from '../assets/dpe-ademe/ademe-client.js'
import {
  extractAuthorSource,
  compareAuthorRecords,
} from '../assets/dpe-author-verification/core.js'
import {
  findDiagnosticianCertifications,
} from '../assets/diagnostician-cert/tabular-client.js'

const addressForm = document.querySelector('#dpe-address-form')
const addressInput = document.querySelector('#dpe-address')
const addressStatus = document.querySelector('#dpe-address-status')
const sameAddressButton = document.querySelector('#same-address-button')
const dpeNumberInput = document.querySelector('#dpe-number')
const panel = document.querySelector('#building-results-panel')
const heading = document.querySelector('#building-results-heading')
const summary = document.querySelector('#building-results-summary')
const tableContainer = document.querySelector('#building-results-table')
const comparisonContainer = document.querySelector('#building-comparison-table')
const exportButton = document.querySelector('#building-export-csv')
const authorInputs = document.querySelector('#building-author-inputs')
const authorStatus = document.querySelector('#building-author-status')
const authorVerifyButton = document.querySelector('#building-author-verify')
const authorResults = document.querySelector('#building-author-results')
const authorComparison = document.querySelector('#building-author-comparison')

const referenceDate = new Date().toISOString().slice(0, 10)
let currentRows = []
let currentAuthorVerification = []


function normalizeBooleanLabel(value) {
  if (value === true) return 'OUI'
  if (value === false) return 'NON'
  return 'INDÉTERMINÉ'
}

function renderAuthorInputs(rows) {
  if (!authorInputs) return
  authorInputs.innerHTML = ''
  authorResults.innerHTML = ''
  authorComparison.innerHTML = ''
  currentAuthorVerification = []

  const wrapper = document.createElement('div')
  wrapper.className = 'table-scroll'
  const table = document.createElement('table')
  table.className = 'dpe-comparison-table'
  const thead = document.createElement('thead')
  const hr = document.createElement('tr')
  for (const label of ['DPE', 'Date', 'Identité source', 'N° certificat', 'Nom / prénom']) appendCell(hr, 'th', label)
  thead.append(hr)
  table.append(thead)

  const tbody = document.createElement('tbody')
  rows.forEach((row, index) => {
    const source = extractAuthorSource(row)
    const tr = document.createElement('tr')
    appendCell(tr, 'td', normalizeDpeNumber(row.numero_dpe), 'mono')
    appendCell(tr, 'td', formatDate(row.date_visite_diagnostiqueur || row.date_etablissement_dpe))
    appendCell(
      tr,
      'td',
      source.sourceState === 'IDENTITY_NOT_AVAILABLE_IN_OPEN_DATA_ROW'
        ? 'Non exposée dans cette ligne open data'
        : 'Disponible / partielle dans la source'
    )

    const certCell = document.createElement('td')
    const certInput = document.createElement('input')
    certInput.type = 'text'
    certInput.value = source.certificateNumber || ''
    certInput.placeholder = 'N° certificat'
    certInput.dataset.authorCertIndex = String(index)
    certInput.autocomplete = 'off'
    certCell.append(certInput)
    tr.append(certCell)

    const nameCell = document.createElement('td')
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.value = source.fullName || ''
    nameInput.placeholder = 'Nom Prénom'
    nameInput.dataset.authorNameIndex = String(index)
    nameInput.autocomplete = 'off'
    nameCell.append(nameInput)
    tr.append(nameCell)

    tbody.append(tr)
  })
  table.append(tbody)
  wrapper.append(table)
  authorInputs.append(wrapper)
}

function renderAuthorVerification(items) {
  authorResults.innerHTML = ''
  authorComparison.innerHTML = ''

  const wrapper = document.createElement('div')
  wrapper.className = 'table-scroll'
  const table = document.createElement('table')
  table.className = 'dpe-comparison-table'
  const thead = document.createElement('thead')
  const hr = document.createElement('tr')
  for (const label of ['DPE', 'Diagnostiqueur', 'Société', 'Certificat', 'Organisme', 'Validité', 'À la date du DPE']) appendCell(hr, 'th', label)
  thead.append(hr)
  table.append(thead)

  const tbody = document.createElement('tbody')
  for (const item of items) {
    const tr = document.createElement('tr')
    const record = item.verifiedRecord
    appendCell(tr, 'td', item.dpeNumber, 'mono')
    appendCell(tr, 'td', record?.fullName || '—')
    appendCell(tr, 'td', record?.company || '—')
    appendCell(tr, 'td', record?.certificateNumber || '—', 'mono')
    appendCell(tr, 'td', record?.certificationBody || '—')
    appendCell(tr, 'td', record ? [formatDate(record.validFrom), formatDate(record.validUntil)].join(' → ') : '—')
    appendCell(tr, 'td', record ? normalizeBooleanLabel(record.validOnDiagnosticDate) : item.state)
    tbody.append(tr)
  }
  table.append(tbody)
  wrapper.append(table)
  authorResults.append(wrapper)

  if (items.length < 2) return
  const compared = compareAuthorRecords(items)
  const cmpWrap = document.createElement('div')
  cmpWrap.className = 'table-scroll'
  const cmp = document.createElement('table')
  cmp.className = 'dpe-comparison-table'
  const cmpHead = document.createElement('thead')
  const cmpHr = document.createElement('tr')
  appendCell(cmpHr, 'th', 'Dimension auteur')
  appendCell(cmpHr, 'th', 'État')
  for (const item of items) appendCell(cmpHr, 'th', item.dpeNumber)
  cmpHead.append(cmpHr)
  cmp.append(cmpHead)
  const cmpBody = document.createElement('tbody')
  for (const row of compared) {
    const tr = document.createElement('tr')
    appendCell(tr, 'th', row.label)
    appendCell(tr, 'td', row.status, 'comparison-state state-' + row.status.toLowerCase())
    row.values.forEach(value => appendCell(tr, 'td', value === true ? 'OUI' : value === false ? 'NON' : text(value)))
    cmpBody.append(tr)
  }
  cmp.append(cmpBody)
  cmpWrap.append(cmp)
  authorComparison.append(cmpWrap)
}

async function verifyBuildingAuthors() {
  if (!currentRows.length) return
  authorVerifyButton.disabled = true
  authorStatus.textContent = 'Vérification séquentielle dans l’annuaire public MADI…'
  const items = []

  for (let index = 0; index < currentRows.length; index += 1) {
    const row = currentRows[index]
    const source = extractAuthorSource(row)
    const cert = document.querySelector('[data-author-cert-index="' + index + '"]')?.value?.trim() || source.certificateNumber || ''
    const name = document.querySelector('[data-author-name-index="' + index + '"]')?.value?.trim() || source.fullName || ''
    const dpeNumber = normalizeDpeNumber(row.numero_dpe)
    const diagnosticDate = String(row.date_visite_diagnostiqueur || row.date_etablissement_dpe || '').slice(0, 10)

    if (!cert && !name) {
      items.push({ dpeNumber, state: 'IDENTITÉ À RENSEIGNER', verifiedRecord: null })
      continue
    }

    try {
      const found = await findDiagnosticianCertifications({
        certificateNumber: cert || null,
        fullName: name || null,
        diagnosticDate,
        referenceDate,
      })
      const record = found.records?.[0] || null
      items.push({
        dpeNumber,
        state: record ? 'MADI_MATCH' : 'MADI_NO_MATCH',
        matchMode: found.matchMode,
        verifiedRecord: record,
      })
    } catch (error) {
      console.error(error)
      items.push({ dpeNumber, state: 'MADI_UNAVAILABLE', verifiedRecord: null })
    }
  }

  currentAuthorVerification = items
  renderAuthorVerification(items)
  const matched = items.filter(item => item.verifiedRecord).length
  authorStatus.textContent =
    matched + ' vérification(s) MADI résolue(s) sur ' + items.length +
    '. Une correspondance d’annuaire confirme une certification publiée ; elle ne prouve ni l’auteur matériel du DPE ni son exactitude technique.'
  authorVerifyButton.disabled = false
}

function text(value) {
  return hasValue(value) ? String(value) : '—'
}

function formatSurface(value) {
  if (!hasValue(value)) return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('fr-FR') + ' m²' : String(value)
}

function formatDate(value) {
  const raw = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—'
  return raw.split('-').reverse().join('/')
}

function appendCell(row, tag, value, className = '') {
  const cell = document.createElement(tag)
  cell.textContent = value
  if (className) cell.className = className
  row.append(cell)
}

function renderResultTable(rows) {
  tableContainer.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'table-scroll'
  const table = document.createElement('table')
  table.className = 'dpe-building-table'

  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of ['DPE', 'Date', 'Surface', 'Étage', 'Énergie', 'GES', 'Chauffage', 'ECS']) {
    appendCell(headRow, 'th', label)
  }
  head.append(headRow)
  table.append(head)

  const body = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    appendCell(tr, 'td', text(row.numero_dpe), 'mono')
    appendCell(tr, 'td', formatDate(row.date_etablissement_dpe))
    appendCell(tr, 'td', formatSurface(row.surface_habitable_logement))
    appendCell(tr, 'td', text(row.numero_etage_appartement || row.position_logement_dans_immeuble))
    appendCell(tr, 'td', text(row.etiquette_dpe), 'dpe-label')
    appendCell(tr, 'td', text(row.etiquette_ges), 'dpe-label')
    appendCell(tr, 'td', text(row.type_energie_principale_chauffage))
    appendCell(tr, 'td', text(row.type_energie_principale_ecs))
    body.append(tr)
  }
  table.append(body)
  wrapper.append(table)
  tableContainer.append(wrapper)
}

function displayComparisonValue(fieldKey, value) {
  if (!hasValue(value)) return '—'
  if (fieldKey === 'surface_habitable_logement') return formatSurface(value)
  if (fieldKey === 'date_etablissement_dpe') return formatDate(value)
  if (fieldKey === 'conso_5_usages_par_m2_ep') return text(value) + ' kWhEP/m²/an'
  if (fieldKey === 'emission_ges_5_usages_par_m2') return text(value) + ' kgCO₂e/m²/an'
  return String(value)
}

function renderComparison(rows) {
  comparisonContainer.innerHTML = ''
  if (rows.length < 2) {
    comparisonContainer.textContent = 'Un seul DPE a été retrouvé : aucune comparaison intra-immeuble n’est calculée.'
    return
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'table-scroll'
  const table = document.createElement('table')
  table.className = 'dpe-comparison-table'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  appendCell(headRow, 'th', 'Champ')
  appendCell(headRow, 'th', 'État')
  for (const row of rows) appendCell(headRow, 'th', normalizeDpeNumber(row.numero_dpe))
  thead.append(headRow)
  table.append(thead)

  const tbody = document.createElement('tbody')
  for (const item of compareBuildingRows(rows)) {
    const tr = document.createElement('tr')
    appendCell(tr, 'th', item.label)
    appendCell(tr, 'td', item.status, 'comparison-state state-' + item.status.toLowerCase())
    item.values.forEach(value => appendCell(tr, 'td', displayComparisonValue(item.key, value)))
    tbody.append(tr)
  }
  table.append(tbody)
  wrapper.append(table)
  comparisonContainer.append(wrapper)
}

function csvEscape(value) {
  const raw = String(value ?? '')
  return /[;"\n]/.test(raw) ? '"' + raw.replace(/"/g, '""') + '"' : raw
}

function exportCsv() {
  if (!currentRows.length) return
  const header = ['champ', 'etat', ...currentRows.map(row => normalizeDpeNumber(row.numero_dpe))]
  const lines = [header.map(csvEscape).join(';')]

  for (const item of compareBuildingRows(currentRows)) {
    lines.push([
      item.label,
      item.status,
      ...item.values.map(value => displayComparisonValue(item.key, value)),
    ].map(csvEscape).join(';'))
  }

  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'comparaison-dpe-immeuble.csv'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function renderBuildingResult(result, sourceLabel) {
  currentRows = result.rows || []
  panel.hidden = false
  tableContainer.innerHTML = ''
  comparisonContainer.innerHTML = ''

  if (!currentRows.length) {
    heading.textContent = 'Aucun DPE retrouvé pour cette adresse'
    summary.textContent = 'La recherche ADEME n’a renvoyé aucun DPE suffisamment concordant avec cette adresse. Cela ne démontre pas qu’aucun DPE n’existe.'
    exportButton.hidden = true
    if (authorVerifyButton) authorVerifyButton.hidden = true
    if (authorInputs) authorInputs.innerHTML = ''
    if (authorResults) authorResults.innerHTML = ''
    if (authorComparison) authorComparison.innerHTML = ''
    return
  }

  const address = currentRows[0].adresse_ban || currentRows[0].adresse_brut || result.query || ''
  heading.textContent = currentRows.length + ' DPE retrouvé' + (currentRows.length > 1 ? 's' : '') + ' à la même adresse'
  summary.textContent = address + '. Source : ' + sourceLabel + '. ' +
    (result.truncated
      ? 'La source contient davantage de lignes que la limite de cette vue.'
      : 'Résultats dédupliqués par numéro de DPE et triés du plus récent au plus ancien.')
  exportButton.hidden = currentRows.length < 2

  renderResultTable(currentRows)
  renderComparison(currentRows)
  renderAuthorInputs(currentRows)
  if (authorVerifyButton) authorVerifyButton.hidden = false
  if (authorStatus) authorStatus.textContent = 'Identité professionnelle : utiliser les champs préremplis lorsqu’ils existent ; sinon reporter le nom ou le numéro de certificat visible sur le DPE complet.'
}

async function runAddressLookup(address) {
  panel.hidden = true
  addressStatus.textContent = 'Recherche directe dans l’open data ADEME…'

  try {
    const result = await searchExistingDpesByAddress(address)
    renderBuildingResult(result, 'ADEME dpe03existant')
    addressStatus.textContent = result.rows.length
      ? result.rows.length + ' DPE de la même adresse ont été retenus après traitement local.'
      : 'Aucun DPE concordant retrouvé. Vérifier l’adresse et inclure le code postal.'
  } catch (error) {
    console.error(error)
    addressStatus.textContent = error?.code === 'DPE_ADDRESS_POSTAL_CODE_REQUIRED'
      ? 'Ajouter le code postal à l’adresse pour borner la recherche et éviter les rues homonymes.'
      : 'La recherche ADEME ne répond pas actuellement. Réessayer plus tard.'
  }
}

addressForm?.addEventListener('submit', event => {
  event.preventDefault()
  runAddressLookup(addressInput.value)
})

sameAddressButton?.addEventListener('click', async () => {
  const number = normalizeDpeNumber(dpeNumberInput?.value)
  if (!number) return

  sameAddressButton.disabled = true
  sameAddressButton.textContent = 'Recherche des DPE de la même adresse…'

  try {
    const found = await findDpeByNumber(number)
    if (!found || found.dataset?.id !== 'dpe03existant') {
      addressStatus.textContent = 'La recherche de DPE voisins est disponible pour les logements existants depuis juillet 2021.'
      return
    }

    const result = await searchExistingDpesForRow(found.row)
    if (addressInput && found.row.adresse_ban) addressInput.value = found.row.adresse_ban
    renderBuildingResult(result, 'ADEME dpe03existant · identité BAN lorsque disponible')
    addressStatus.textContent = result.rows.length + ' DPE de la même adresse ont été retrouvés à partir du DPE sélectionné.'
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    console.error(error)
    addressStatus.textContent = 'Impossible de rechercher les DPE de la même adresse actuellement.'
  } finally {
    sameAddressButton.disabled = false
    sameAddressButton.textContent = 'Voir les DPE de la même adresse'
  }
})

exportButton?.addEventListener('click', exportCsv)
authorVerifyButton?.addEventListener('click', verifyBuildingAuthors)

window.addEventListener('beforeunload', () => {
  currentRows = []
  currentAuthorVerification = []
})
