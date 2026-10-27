import { findDpeByNumber } from '../assets/dpe-ademe/ademe-client.js'
import { normalizeDpeNumber, isValidDpeNumber } from '../assets/dpe-ademe/core.js'
import {
  RELATION_STATES,
  createAssetIdentity,
  createDocumentTrace,
  createEvent,
  createAssertion,
  createRelation,
  addDocument,
  addEvent,
  addAssertion,
  addRelation,
  exportIdentity,
  summarizeIdentity,
} from '../assets/asset-identity/core.js'
import { createHousingIdentityFromDpe } from '../assets/asset-identity/housing-adapter.js'

const form = document.querySelector('#identity-form')
const input = document.querySelector('#identity-dpe')
const status = document.querySelector('#identity-status')
const result = document.querySelector('#identity-result')
const summary = document.querySelector('#identity-summary')
const componentsPanel = document.querySelector('#components-panel')
const componentsGrid = document.querySelector('#components-grid')
const relationsPanel = document.querySelector('#relations-panel')
const relationsBody = document.querySelector('#relations-body')
const exportButton = document.querySelector('#identity-export')
const maieuticForm = document.querySelector('#maieutic-form')
const documentLabel = document.querySelector('#document-label')
const eventLabel = document.querySelector('#event-label')
const maieuticResult = document.querySelector('#maieutic-result')
const maieuticText = document.querySelector('#maieutic-text')

let currentIdentity = null

function addDefinition(label, value) {
  if (value === undefined || value === null || value === '') return
  const wrapper = document.createElement('div')
  const dt = document.createElement('dt')
  const dd = document.createElement('dd')
  dt.textContent = label
  dd.textContent = String(value)
  wrapper.append(dt, dd)
  summary.append(wrapper)
}

function human(value) {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

function renderIdentity(identity) {
  currentIdentity = identity
  summary.innerHTML = ''
  const s = summarizeIdentity(identity)

  addDefinition('Contrat', s.contract + ' · ' + s.coreVersion)
  addDefinition('Identifiant', identity.asset.id)
  addDefinition('Type', identity.asset.kind)
  addDefinition('Libellé', identity.asset.label)
  addDefinition('Statut d’identité', identity.asset.identityStatus)
  addDefinition('Localisation', identity.asset.attributes.coarseLocation)
  addDefinition('Surface', identity.asset.attributes.surface ? identity.asset.attributes.surface + ' m²' : null)
  addDefinition('Étiquette DPE', identity.asset.attributes.energyLabel)
  addDefinition('Étiquette GES', identity.asset.attributes.climateLabel)
  addDefinition('Composants', s.componentCount)
  addDefinition('Documents', s.documentCount)
  addDefinition('Relations', s.relationCount)

  componentsGrid.innerHTML = ''
  for (const component of identity.components) {
    const card = document.createElement('article')
    card.className = 'component-card'
    const title = document.createElement('h3')
    title.textContent = component.label
    const meta = document.createElement('p')
    meta.className = 'status'
    meta.textContent = component.kind + ' · ' + component.identityStatus
    const dl = document.createElement('dl')
    for (const [key, value] of Object.entries(component.attributes || {})) {
      const dt = document.createElement('dt')
      const dd = document.createElement('dd')
      dt.textContent = key
      dd.textContent = human(value)
      dl.append(dt, dd)
    }
    card.append(title, meta, dl)
    componentsGrid.append(card)
  }

  relationsBody.innerHTML = ''
  for (const relation of identity.relations) {
    const tr = document.createElement('tr')
    for (const value of [relation.fromId, relation.type, relation.toId, relation.status, relation.basis || '—']) {
      const td = document.createElement('td')
      td.textContent = String(value)
      tr.append(td)
    }
    relationsBody.append(tr)
  }

  result.hidden = false
  componentsPanel.hidden = false
  relationsPanel.hidden = false
}

async function load(number) {
  const normalized = normalizeDpeNumber(number)
  input.value = normalized
  result.hidden = true
  componentsPanel.hidden = true
  relationsPanel.hidden = true

  if (!isValidDpeNumber(normalized)) {
    status.textContent = 'Numéro DPE non reconnu.'
    return
  }

  status.textContent = 'Récupération du DPE public ADEME et construction locale de la carte…'
  try {
    const found = await findDpeByNumber(normalized)
    if (!found) {
      status.textContent = 'Aucun DPE exact retrouvé dans les jeux ADEME interrogés.'
      return
    }
    const projected = createHousingIdentityFromDpe(found)
    renderIdentity(projected.identity)
    status.textContent = 'Carte construite localement. Aucun compte et aucune persistance côté observatoire.'
  } catch (error) {
    console.error(error)
    status.textContent = 'Impossible de construire la carte actuellement.'
  }
}

form.addEventListener('submit', event => {
  event.preventDefault()
  load(input.value)
})

exportButton.addEventListener('click', () => {
  if (!currentIdentity) return
  const blob = new Blob([exportIdentity(currentIdentity)], {type:'application/json;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'carte-identite-logement.json'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
})

maieuticForm.addEventListener('submit', event => {
  event.preventDefault()
  const docLabel = documentLabel.value.trim() || 'Document'
  const evtLabel = eventLabel.value.trim() || 'Événement allégué'

  let test = createAssetIdentity({
    id: 'synthetic:asset:1',
    kind: 'SYNTHETIC_ASSET',
    label: 'Objet synthétique',
    identityStatus: 'SYNTHETIC',
  })
  test = addDocument(test, createDocumentTrace({
    id:'synthetic:document:1',
    type:'SYNTHETIC_DOCUMENT',
    label:docLabel,
    provenanceClass:'synthetic:source:1',
  }))
  test = addEvent(test, createEvent({
    id:'synthetic:event:1',
    assetId:test.asset.id,
    type:'ALLEGED_EVENT',
    label:evtLabel,
  }))
  test = addAssertion(test, createAssertion({
    id:'synthetic:assertion:1',
    documentId:'synthetic:document:1',
    subjectId:test.asset.id,
    predicate:'ASSERTS_EVENT',
    eventId:'synthetic:event:1',
  }))
  test = addRelation(test, createRelation({
    id:'synthetic:relation:asserts',
    fromId:'synthetic:document:1',
    toId:'synthetic:event:1',
    type:'DOCUMENT_ASSERTS_EVENT',
    status:RELATION_STATES.ESTABLISHED,
    basis:'Le contenu du document affirme l’événement.',
  }))
  test = addRelation(test, createRelation({
    id:'synthetic:relation:occurred',
    fromId:'synthetic:document:1',
    toId:'synthetic:event:1',
    type:'EVENT_OCCURRED_IN_REALITY',
    status:RELATION_STATES.INDETERMINATE,
    basis:'Aucune observation indépendante n’est fournie par ce test.',
  }))

  maieuticText.textContent =
    'Le document « ' + docLabel + ' » affirme « ' + evtLabel +
    ' ». Cette assertion documentaire est enregistrable. L’occurrence matérielle reste toutefois INDÉTERMINÉE tant qu’une relation indépendante avec le fait n’est pas établie.'
  maieuticResult.hidden = false
})

const queryDpe = new URLSearchParams(location.search).get('dpe')
if (queryDpe) load(queryDpe)
