import {
  RELATION_STATES,
  createAssetIdentity,
  createComponent,
  createDocumentTrace,
  createEvent,
  createAssertion,
  createRelation,
  createObservation,
  addComponent,
  addDocument,
  addEvent,
  addAssertion,
  addRelation,
  addObservation,
} from './core.js'

export const HOUSING_ADAPTER_VERSION = '1.0.0'
export const HOUSING_ADAPTER_CONTRACT = 'HOUSING_IDENTITY_ADAPTER_V1'

function clean(value) {
  return value === undefined || value === null || value === '' ? null : value
}

function coarseLocation(row = {}) {
  const postal = clean(row.code_postal_ban || row.code_postal)
  const city = clean(row.nom_commune_ban || row.nom_commune || row.commune)
  return [postal, city].filter(Boolean).join(' ') || null
}

function componentAttributes(entries) {
  const output = {}
  for (const [key, value] of entries) if (clean(value) !== null) output[key] = value
  return output
}

function addDpeComponent(identity, raw) {
  const component = createComponent(raw)
  let next = addComponent(identity, component)
  for (const [property, value] of Object.entries(component.attributes)) {
    next = addObservation(next, createObservation({
      id: 'obs:' + component.id + ':' + property,
      assetId: identity.asset.id,
      componentId: component.id,
      observedAt: raw.validFrom,
      property,
      value,
      sourceDocumentId: raw.sourceDocumentId,
      status: RELATION_STATES.ESTABLISHED,
    }))
  }
  return next
}

export function createHousingIdentityFromDpe(found = {}) {
  const row = found.row || {}
  const dataset = found.dataset || {}
  const dpe = String(row.numero_dpe || '').trim()
  if (!dpe) throw new TypeError('numero_dpe is required')

  const assetId = 'housing:dpe:' + dpe
  const docId = 'document:ademe:' + dpe
  const eventId = 'event:dpe-record:' + dpe
  const diagnosticDate = clean(row.date_etablissement_dpe)

  let identity = createAssetIdentity({
    id: assetId,
    kind: 'HOUSING_UNIT',
    label: 'Logement décrit par le DPE ' + dpe,
    scope: 'DPE_RECORD_SCOPE',
    identityStatus: 'PROVISIONAL_DPE_SCOPE',
    attributes: {
      dpeNumber: dpe,
      datasetId: dataset.id || null,
      datasetLabel: dataset.label || null,
      coarseLocation: coarseLocation(row),
      buildingBanId: clean(row.identifiant_ban),
      surface: clean(row.surface_habitable_logement || row.surface_reference || row.surface_thermique_lot),
      energyLabel: clean(row.etiquette_dpe || row.classe_consommation_energie),
      climateLabel: clean(row.etiquette_ges || row.classe_estimation_ges),
      constructionYear: clean(row.annee_construction),
      buildingType: clean(row.type_batiment || row.tr002_type_batiment_description),
    },
  })

  identity = addDocument(identity, createDocumentTrace({
    id: docId,
    type: 'OPEN_DATA_DPE_RECORD',
    label: 'Ligne open data ADEME — DPE ' + dpe,
    issuedAt: diagnosticDate,
    source: 'ADEME',
    provenanceClass: 'ADEME:DPE:' + dpe,
    attributes: {datasetId: dataset.id || null, representation: 'OPEN_DATA_ROW', fullXml: false},
  }))

  identity = addEvent(identity, createEvent({
    id: eventId,
    assetId,
    type: 'DIAGNOSTIC_RECORD',
    label: 'Établissement du DPE tel que publié dans la source ADEME',
    occurredAt: diagnosticDate,
    temporalStatus: diagnosticDate ? 'DATED_BY_SOURCE' : 'DATE_UNKNOWN',
  }))

  identity = addAssertion(identity, createAssertion({
    id: 'assertion:ademe-dpe:' + dpe,
    documentId: docId,
    subjectId: assetId,
    predicate: 'HAS_DPE_RECORD',
    object: dpe,
    eventId,
    assertedAt: diagnosticDate,
  }))

  identity = addRelation(identity, createRelation({
    id: 'relation:document-asserts-dpe:' + dpe,
    fromId: docId,
    toId: eventId,
    type: 'DOCUMENT_ASSERTS_EVENT',
    status: RELATION_STATES.ESTABLISHED,
    basis: 'La ligne ADEME contient le numéro DPE et sa date publiée.',
    validAt: diagnosticDate,
  }))

  identity = addRelation(identity, createRelation({
    id: 'relation:dpe-real-state:' + dpe,
    fromId: docId,
    toId: assetId,
    type: 'DOCUMENT_REPRESENTS_MATERIAL_STATE',
    status: RELATION_STATES.INDETERMINATE,
    basis: 'La ligne DPE décrit un état conventionnel ; elle ne constitue pas à elle seule une observation matérielle indépendante du logement.',
    validAt: diagnosticDate,
  }))

  const base = {assetId, identityStatus:'DESCRIBED_BY_DPE', validFrom:diagnosticDate, sourceDocumentId:docId}

  const heating = componentAttributes([
    ['energy', row.type_energie_principale_chauffage],
    ['installation', row.type_installation_chauffage],
    ['generator', row.type_generateur_chauffage_principal],
    ['emitter', row.type_emetteur_installation_chauffage_n1],
  ])
  if (Object.keys(heating).length) identity = addDpeComponent(identity, {...base,id:'component:'+dpe+':heating',kind:'HEATING_SYSTEM',label:'Chauffage',attributes:heating})

  const ecs = componentAttributes([
    ['energy', row.type_energie_principale_ecs],
    ['installation', row.type_installation_ecs],
  ])
  if (Object.keys(ecs).length) identity = addDpeComponent(identity, {...base,id:'component:'+dpe+':ecs',kind:'DOMESTIC_HOT_WATER',label:'Eau chaude sanitaire',attributes:ecs})

  const ventilation = componentAttributes([
    ['type', row.type_ventilation],
    ['quality', row.qualite_ventilation],
  ])
  if (Object.keys(ventilation).length) identity = addDpeComponent(identity, {...base,id:'component:'+dpe+':ventilation',kind:'VENTILATION',label:'Ventilation',attributes:ventilation})

  const envelope = componentAttributes([
    ['overallInsulationQuality', row.qualite_isolation_enveloppe],
    ['wallInsulationQuality', row.qualite_isolation_murs],
    ['windowInsulationQuality', row.qualite_isolation_menuiseries],
    ['lowerFloorInsulationQuality', row.qualite_isolation_plancher_bas],
    ['upperFloorInsulationQuality', row.qualite_isolation_plancher_haut_toit_terrasse],
  ])
  if (Object.keys(envelope).length) identity = addDpeComponent(identity, {...base,id:'component:'+dpe+':envelope',kind:'BUILDING_ENVELOPE',label:'Enveloppe',attributes:envelope})

  return Object.freeze({contract:HOUSING_ADAPTER_CONTRACT,adapterVersion:HOUSING_ADAPTER_VERSION,identity})
}
