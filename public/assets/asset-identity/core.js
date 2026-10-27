export const ASSET_IDENTITY_CORE_VERSION = '1.0.0'
export const ASSET_IDENTITY_CONTRACT = 'ASSET_IDENTITY_CORE_V1'

export const RELATION_STATES = Object.freeze({
  ESTABLISHED: 'ESTABLISHED',
  DIVERGENT: 'DIVERGENT',
  INDETERMINATE: 'INDETERMINATE',
  NOT_SEARCHED: 'NOT_SEARCHED',
})

export const SEMANTIC_LOCKS = Object.freeze([
  'DOCUMENT_ASSERTS_EVENT_IS_NOT_EVENT_OCCURRED',
  'DOCUMENT_AUTHENTIC_IS_NOT_MATERIAL_FACT_DEMONSTRATED',
  'TRACE_IS_NOT_FACT',
  'TRACE_PLUS_FACT_IS_NOT_RELATION_ESTABLISHED',
  'ASSET_STATE_T1_IS_NOT_ASSET_STATE_T2',
  'DOCUMENT_REPLICATION_IS_NOT_INDEPENDENT_CORROBORATION',
  'SAME_ADDRESS_IS_NOT_SAME_ASSET',
  'COMPONENT_DESCRIPTION_IS_NOT_COMPONENT_OBSERVATION',
  'UNKNOWN_IS_VALID_RESULT',
])

function clean(value) {
  return String(value ?? '').trim()
}

function required(value, field) {
  const normalized = clean(value)
  if (!normalized) throw new TypeError(field + ' is required')
  return normalized
}

function freezeArray(value) {
  return Object.freeze([...(Array.isArray(value) ? value : [])])
}

function freezeObject(value) {
  return Object.freeze({...(value || {})})
}

function relationState(value) {
  const normalized = clean(value).toUpperCase()
  if (!Object.values(RELATION_STATES).includes(normalized)) {
    throw new RangeError('Unsupported relation state: ' + value)
  }
  return normalized
}

export function createAssetIdentity(raw = {}) {
  return Object.freeze({
    contract: ASSET_IDENTITY_CONTRACT,
    coreVersion: ASSET_IDENTITY_CORE_VERSION,
    asset: Object.freeze({
      id: required(raw.id, 'asset.id'),
      kind: required(raw.kind, 'asset.kind'),
      label: required(raw.label, 'asset.label'),
      parentId: clean(raw.parentId) || null,
      scope: clean(raw.scope) || null,
      identityStatus: clean(raw.identityStatus) || 'PROVISIONAL',
      attributes: freezeObject(raw.attributes),
    }),
    components: freezeArray(raw.components),
    documents: freezeArray(raw.documents),
    events: freezeArray(raw.events),
    assertions: freezeArray(raw.assertions),
    relations: freezeArray(raw.relations),
    observations: freezeArray(raw.observations),
    semanticLocks: SEMANTIC_LOCKS,
  })
}

export function createComponent(raw = {}) {
  return Object.freeze({
    id: required(raw.id, 'component.id'),
    assetId: required(raw.assetId, 'component.assetId'),
    kind: required(raw.kind, 'component.kind'),
    label: required(raw.label, 'component.label'),
    identityStatus: clean(raw.identityStatus) || 'PROVISIONAL',
    validFrom: clean(raw.validFrom) || null,
    validTo: clean(raw.validTo) || null,
    attributes: freezeObject(raw.attributes),
  })
}

export function createDocumentTrace(raw = {}) {
  return Object.freeze({
    id: required(raw.id, 'document.id'),
    type: required(raw.type, 'document.type'),
    label: required(raw.label, 'document.label'),
    issuedAt: clean(raw.issuedAt) || null,
    observedAt: clean(raw.observedAt) || null,
    source: clean(raw.source) || null,
    sourceUrl: clean(raw.sourceUrl) || null,
    provenanceClass: clean(raw.provenanceClass) || null,
    attributes: freezeObject(raw.attributes),
  })
}

export function createEvent(raw = {}) {
  return Object.freeze({
    id: required(raw.id, 'event.id'),
    assetId: required(raw.assetId, 'event.assetId'),
    componentId: clean(raw.componentId) || null,
    type: required(raw.type, 'event.type'),
    label: required(raw.label, 'event.label'),
    occurredAt: clean(raw.occurredAt) || null,
    temporalStatus: clean(raw.temporalStatus) || 'DECLARED_OR_UNKNOWN',
    attributes: freezeObject(raw.attributes),
  })
}

export function createAssertion(raw = {}) {
  return Object.freeze({
    id: required(raw.id, 'assertion.id'),
    documentId: required(raw.documentId, 'assertion.documentId'),
    subjectId: required(raw.subjectId, 'assertion.subjectId'),
    predicate: required(raw.predicate, 'assertion.predicate'),
    object: raw.object ?? null,
    eventId: clean(raw.eventId) || null,
    componentId: clean(raw.componentId) || null,
    assertedAt: clean(raw.assertedAt) || null,
  })
}

export function createRelation(raw = {}) {
  return Object.freeze({
    id: required(raw.id, 'relation.id'),
    fromId: required(raw.fromId, 'relation.fromId'),
    toId: required(raw.toId, 'relation.toId'),
    type: required(raw.type, 'relation.type'),
    status: relationState(raw.status || RELATION_STATES.INDETERMINATE),
    basis: clean(raw.basis) || null,
    validAt: clean(raw.validAt) || null,
  })
}

export function createObservation(raw = {}) {
  return Object.freeze({
    id: required(raw.id, 'observation.id'),
    assetId: required(raw.assetId, 'observation.assetId'),
    componentId: clean(raw.componentId) || null,
    observedAt: clean(raw.observedAt) || null,
    property: required(raw.property, 'observation.property'),
    value: raw.value ?? null,
    sourceDocumentId: clean(raw.sourceDocumentId) || null,
    status: relationState(raw.status || RELATION_STATES.INDETERMINATE),
  })
}

function replaceCollection(identity, key, value) {
  return Object.freeze({
    ...identity,
    [key]: Object.freeze([...(identity[key] || []), value]),
  })
}

export function addComponent(identity, component) { return replaceCollection(identity, 'components', component) }
export function addDocument(identity, document) { return replaceCollection(identity, 'documents', document) }
export function addEvent(identity, event) { return replaceCollection(identity, 'events', event) }
export function addAssertion(identity, assertion) { return replaceCollection(identity, 'assertions', assertion) }
export function addRelation(identity, relation) { return replaceCollection(identity, 'relations', relation) }
export function addObservation(identity, observation) { return replaceCollection(identity, 'observations', observation) }

export function provenanceSummary(identity) {
  const classes = new Map()
  for (const document of identity.documents || []) {
    const key = document.provenanceClass || document.id
    if (!classes.has(key)) classes.set(key, [])
    classes.get(key).push(document.id)
  }
  return Object.freeze({
    artifactCount: (identity.documents || []).length,
    provenanceClassCount: classes.size,
    classes: Object.freeze([...classes.entries()].map(([id, documentIds]) =>
      Object.freeze({id, documentIds: Object.freeze([...documentIds])})
    )),
  })
}

export function qualifyEventSupport(identity, eventId) {
  const assertions = (identity.assertions || []).filter(item => item.eventId === eventId)
  const assertionDocuments = new Set(assertions.map(item => item.documentId))
  const documents = (identity.documents || []).filter(item => assertionDocuments.has(item.id))
  const provenanceClasses = new Set(documents.map(item => item.provenanceClass || item.id))
  const occurrenceRelations = (identity.relations || []).filter(item =>
    item.toId === eventId && item.type === 'EVENT_OCCURRED_IN_REALITY'
  )
  const states = new Set(occurrenceRelations.map(item => item.status))

  let boundedStatus = RELATION_STATES.INDETERMINATE
  if (states.has(RELATION_STATES.DIVERGENT)) boundedStatus = RELATION_STATES.DIVERGENT
  else if (states.has(RELATION_STATES.ESTABLISHED)) boundedStatus = RELATION_STATES.ESTABLISHED
  else if (states.size > 0 && [...states].every(item => item === RELATION_STATES.NOT_SEARCHED)) boundedStatus = RELATION_STATES.NOT_SEARCHED

  return Object.freeze({
    eventId,
    assertionCount: assertions.length,
    documentCount: documents.length,
    independentProvenanceClasses: provenanceClasses.size,
    occurrenceRelationCount: occurrenceRelations.length,
    boundedStatus,
    eventOccurred: null,
    boundedClaim: assertions.length
      ? 'Au moins un document affirme ou décrit l’événement.'
      : 'Aucune assertion documentaire sur cet événement n’est enregistrée.',
    prohibitedInference: 'L’existence ou la multiplication de documents n’autorise pas, à elle seule, à conclure que l’événement a eu lieu.',
  })
}

export function summarizeIdentity(identity) {
  const provenance = provenanceSummary(identity)
  return Object.freeze({
    contract: identity.contract,
    coreVersion: identity.coreVersion,
    assetId: identity.asset.id,
    componentCount: identity.components.length,
    documentCount: identity.documents.length,
    eventCount: identity.events.length,
    assertionCount: identity.assertions.length,
    relationCount: identity.relations.length,
    observationCount: identity.observations.length,
    provenanceClassCount: provenance.provenanceClassCount,
    semanticLocks: identity.semanticLocks,
  })
}

export function exportIdentity(identity) {
  return JSON.stringify(identity, null, 2)
}
