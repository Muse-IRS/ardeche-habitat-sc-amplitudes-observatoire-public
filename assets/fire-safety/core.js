export const FIRE_SAFETY_CONTRACT = 'FIRE_SAFETY_BUILDING_CORE_V1'
export const FIRE_SAFETY_VERSION = '0.1.0'

export const FIRE_SAFETY_LAYERS = Object.freeze({
  ASSET_IDENTITY: 'ASSET_IDENTITY',
  REGULATORY_CLASSIFICATION: 'REGULATORY_CLASSIFICATION',
  ERP_ADMINISTRATIVE: 'ERP_ADMINISTRATIVE',
  EXTERNAL_RISK: 'EXTERNAL_RISK',
  DECI_PEI: 'DECI_PEI',
  INTERNAL_SYSTEMS: 'INTERNAL_SYSTEMS',
  PERIODIC_CONTROLS: 'PERIODIC_CONTROLS',
  COMMISSION_DECISIONS: 'COMMISSION_DECISIONS',
  DOCUMENTARY_EVIDENCE: 'DOCUMENTARY_EVIDENCE',
})

export const FIRE_SAFETY_STATES = Object.freeze({
  ESTABLISHED: 'ESTABLISHED',
  DECLARED: 'DECLARED',
  INDETERMINATE: 'INDETERMINATE',
  NOT_SEARCHED: 'NOT_SEARCHED',
  NOT_AVAILABLE_OPEN_DATA: 'NOT_AVAILABLE_OPEN_DATA',
  DIVERGENT: 'DIVERGENT',
})

export const FIRE_SAFETY_LOCKS = Object.freeze([
  'RNB_ID_IS_NOT_FIRE_SAFETY_STATUS',
  'ERP_CLASSIFICATION_IS_NOT_FIRE_SAFETY_COMPLIANCE',
  'NEARBY_PEI_IS_NOT_SUFFICIENT_DECI',
  'GEORISK_IS_NOT_INTERNAL_FIRE_SAFETY',
  'DOCUMENT_ASSERTS_CONTROL_IS_NOT_CONTROL_OCCURRED',
  'CONTROL_OCCURRED_IS_NOT_CURRENT_COMPLIANCE',
  'NO_OPEN_DATA_IS_NOT_NO_SAFETY_DEVICE',
  'DECLARED_DEVICE_IS_NOT_OBSERVED_DEVICE',
  'FIRE_SAFETY_CONTEXT_IS_NOT_FIRE_SAFETY_CONFORMITY',
])

function clean(value){ return String(value ?? '').trim() }

function validState(value){
  const normalized=clean(value).toUpperCase()
  if(!Object.values(FIRE_SAFETY_STATES).includes(normalized)) throw new RangeError('Unsupported fire-safety state: '+value)
  return normalized
}

export function createFireSafetyProfile(raw={}){
  return Object.freeze({
    contract:FIRE_SAFETY_CONTRACT,
    version:FIRE_SAFETY_VERSION,
    asset:Object.freeze({
      id:clean(raw.assetId)||null,
      rnbId:clean(raw.rnbId)||null,
      label:clean(raw.label)||null,
      status:clean(raw.assetStatus)||null,
      addresses:Object.freeze([...(raw.addresses||[])]),
      coordinates:raw.coordinates ? Object.freeze({...raw.coordinates}) : null,
    }),
    sources:Object.freeze([]),
    observations:Object.freeze([]),
    semanticLocks:FIRE_SAFETY_LOCKS,
    complianceStatus:'INDETERMINATE',
  })
}

export function createSourceTrace(raw={}){
  return Object.freeze({
    id:clean(raw.id)||('source:'+Math.random().toString(36).slice(2)),
    layer:clean(raw.layer)||FIRE_SAFETY_LAYERS.DOCUMENTARY_EVIDENCE,
    sourceType:clean(raw.sourceType)||'UNKNOWN',
    label:clean(raw.label)||'Source',
    sourceUrl:clean(raw.sourceUrl)||null,
    observedAt:clean(raw.observedAt)||null,
    state:validState(raw.state||FIRE_SAFETY_STATES.INDETERMINATE),
    scope:clean(raw.scope)||null,
    attributes:Object.freeze({...raw.attributes}),
  })
}

export function addSource(profile, source){
  return Object.freeze({...profile,sources:Object.freeze([...(profile.sources||[]),source])})
}

export function createObservation(raw={}){
  return Object.freeze({
    id:clean(raw.id)||('obs:'+Math.random().toString(36).slice(2)),
    layer:clean(raw.layer)||FIRE_SAFETY_LAYERS.INTERNAL_SYSTEMS,
    subject:clean(raw.subject)||null,
    property:clean(raw.property)||null,
    value:raw.value ?? null,
    observedAt:clean(raw.observedAt)||null,
    sourceId:clean(raw.sourceId)||null,
    state:validState(raw.state||FIRE_SAFETY_STATES.INDETERMINATE),
  })
}

export function addObservation(profile, observation){
  return Object.freeze({...profile,observations:Object.freeze([...(profile.observations||[]),observation])})
}

export function sourceLayerSummary(profile){
  const layers={}
  for(const layer of Object.values(FIRE_SAFETY_LAYERS)) layers[layer]=[]
  for(const source of profile.sources||[]){
    if(!layers[source.layer]) layers[source.layer]=[]
    layers[source.layer].push(source)
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(layers).map(([layer,sources])=>[
      layer,
      Object.freeze({
        sourceCount:sources.length,
        states:Object.freeze([...new Set(sources.map(s=>s.state))]),
      })
    ])
  ))
}

export function qualifyCompliance(profile){
  return Object.freeze({
    complianceStatus:'INDETERMINATE',
    boundedClaim:'Les sources rassemblées décrivent des identités, contextes, équipements, contrôles ou décisions. Elles ne suffisent pas automatiquement à établir une conformité incendie globale et actuelle du bâtiment.',
    prohibitedInference:'La présence d’une source, d’un classement, d’un PEI ou d’un document de contrôle ne vaut pas certificat général de conformité incendie.',
  })
}

export function exportFireSafetyProfile(profile){
  return JSON.stringify({
    ...profile,
    compliance:qualifyCompliance(profile),
    layerSummary:sourceLayerSummary(profile),
  },null,2)
}
