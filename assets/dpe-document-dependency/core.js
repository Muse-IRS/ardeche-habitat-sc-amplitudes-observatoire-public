export const DPE_DOCUMENT_DEPENDENCY_CONTRACT = 'DPE_DOCUMENT_DEPENDENCY_CORE_V1'
export const DPE_DOCUMENT_DEPENDENCY_VERSION = '0.2.0'

export const INVENTORY_COMPLETENESS = Object.freeze([
  'COMPLETE',
  'PARTIAL',
  'UNKNOWN',
])

function clean(value) {
  return String(value ?? '').trim()
}

export function normalizeSourceRef(value) {
  return clean(value)
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function parseSourceRefs(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[;\n]+/)
  const refs = raw
    .map(normalizeSourceRef)
    .filter(Boolean)
  return Object.freeze([...new Set(refs)])
}

export function inventoryFromFullDpe(parsed = {}) {
  const descriptors = []
  for (const item of parsed?.justifications || []) {
    const type = clean(item?.enum_type_justificatif_id || item?.typeId)
    const description = clean(item?.description)
    if (type || description) {
      descriptors.push({
        kind: 'DECLARED_DESCRIPTOR',
        label: ['JUSTIFICATIF', type ? 'TYPE ' + type : null, description || null].filter(Boolean).join(' · '),
      })
    }
  }
  for (const item of parsed?.technicalItems || []) {
    const detail = clean(item?.detail_origine_donnee || item?.originDetail)
    if (detail) {
      descriptors.push({
        kind: 'DECLARED_DESCRIPTOR',
        label: 'ORIGINE · ' + detail,
      })
    }
  }
  return Object.freeze({
    dpeNumber: clean(parsed?.dpeNumber).toUpperCase() || null,
    sourceRefs: Object.freeze(descriptors.map(item => item.label)),
    sourceItems: Object.freeze(descriptors),
    completeness: 'COMPLETE',
    scope: 'ADEME_FULL_DPE_DECLARED_METADATA',
  })
}

export function normalizeInventory({
  dpeNumber,
  sourceRefs,
  sourceItems,
  completeness = 'UNKNOWN',
  scope = null,
} = {}) {
  const normalizedCompleteness = INVENTORY_COMPLETENESS.includes(completeness)
    ? completeness
    : 'UNKNOWN'

  const normalizedRefs = parseSourceRefs(sourceRefs)
  const normalizedItems = Array.isArray(sourceItems)
    ? sourceItems
        .map(item => Object.freeze({
          kind: clean(item?.kind).toUpperCase() || 'SPECIFIC_REFERENCE',
          label: normalizeSourceRef(item?.label),
        }))
        .filter(item => item.label)
    : normalizedRefs.map(label => Object.freeze({kind:'SPECIFIC_REFERENCE',label}))

  return Object.freeze({
    dpeNumber: clean(dpeNumber).toUpperCase() || null,
    sourceRefs: Object.freeze(normalizedItems.map(item => item.label)),
    sourceItems: Object.freeze(normalizedItems),
    completeness: normalizedCompleteness,
    scope: clean(scope) || null,
  })
}

function intersection(a, b) {
  const bSet = new Set(b)
  return a.filter(value => bSet.has(value))
}

function union(a, b) {
  return [...new Set([...a, ...b])]
}

export function compareDependency(aInput, bInput) {
  const a = normalizeInventory(aInput)
  const b = normalizeInventory(bInput)
  const sharedRefs = intersection(a.sourceRefs, b.sourceRefs)
  const knownUnion = union(a.sourceRefs, b.sourceRefs)
  const itemA = new Map(a.sourceItems.map(item => [item.label, item.kind]))
  const itemB = new Map(b.sourceItems.map(item => [item.label, item.kind]))
  const sharedSpecific = sharedRefs.filter(ref =>
    itemA.get(ref) === 'SPECIFIC_REFERENCE' && itemB.get(ref) === 'SPECIFIC_REFERENCE'
  )
  const sharedDescriptors = sharedRefs.filter(ref => !sharedSpecific.includes(ref))

  let state = 'INDETERMINATE'
  if (sharedSpecific.length) {
    state = 'SHARED_SOURCE_REFERENCE_ESTABLISHED'
  } else if (sharedDescriptors.length) {
    state = 'SHARED_DECLARED_DESCRIPTOR'
  } else if (a.completeness === 'COMPLETE' && b.completeness === 'COMPLETE') {
    state = 'NO_SHARED_SOURCE_IDENTIFIED'
  }

  const knownSharedRatio = knownUnion.length
    ? Math.round((sharedRefs.length / knownUnion.length) * 1000) / 10
    : null

  return Object.freeze({
    dpeA: a.dpeNumber,
    dpeB: b.dpeNumber,
    state,
    sharedRefs: Object.freeze(sharedRefs),
    sharedSpecificRefs: Object.freeze(sharedSpecific),
    sharedDeclaredDescriptors: Object.freeze(sharedDescriptors),
    sharedCount: sharedRefs.length,
    knownUnionCount: knownUnion.length,
    knownSharedRatio,
    inventoryA: a,
    inventoryB: b,
    semanticLocks: Object.freeze([
      'NO_SHARED_SOURCE_IDENTIFIED_IS_NOT_PROOF_OF_INDEPENDENCE',
      'DIFFERENT_DIAGNOSTICIAN_IS_NOT_INDEPENDENT_OBSERVATION',
      'IDENTICAL_VALUE_IS_NOT_PROOF_OF_SHARED_SOURCE',
      'DIFFERENT_VALUE_IS_NOT_PROOF_OF_INDEPENDENT_SOURCE',
      'USER_DECLARED_SOURCE_REF_IS_NOT_DOCUMENT_AUTHENTICITY_PROOF',
      'SHARED_DECLARED_DESCRIPTOR_IS_NOT_SAME_DOCUMENT',
    ]),
  })
}

export function compareAllDependencies(inventories = []) {
  const normalized = inventories.map(normalizeInventory)
  const pairs = []
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      pairs.push(compareDependency(normalized[i], normalized[j]))
    }
  }
  return Object.freeze(pairs)
}

export function buildDependencyGraph(inventories = []) {
  const normalized = inventories.map(normalizeInventory)
  const dpeNodes = normalized
    .filter(item => item.dpeNumber)
    .map(item => Object.freeze({
      id: 'DPE:' + item.dpeNumber,
      type: 'DPE',
      label: item.dpeNumber,
      completeness: item.completeness,
    }))

  const sourceRefs = [...new Set(normalized.flatMap(item => item.sourceRefs))]
  const sourceNodes = sourceRefs.map(ref => Object.freeze({
    id: 'SOURCE:' + ref,
    type: 'SOURCE_REFERENCE',
    label: ref,
  }))

  const edges = normalized.flatMap(item =>
    item.sourceRefs.map(ref => Object.freeze({
      from: 'DPE:' + item.dpeNumber,
      to: 'SOURCE:' + ref,
      relation: 'REFERENCES_SOURCE',
    }))
  )

  return Object.freeze({
    contract: DPE_DOCUMENT_DEPENDENCY_CONTRACT,
    version: DPE_DOCUMENT_DEPENDENCY_VERSION,
    nodes: Object.freeze([...dpeNodes, ...sourceNodes]),
    edges: Object.freeze(edges),
    pairs: compareAllDependencies(normalized),
  })
}

export function describeDocumentDependencyCore() {
  return Object.freeze({
    contract: DPE_DOCUMENT_DEPENDENCY_CONTRACT,
    version: DPE_DOCUMENT_DEPENDENCY_VERSION,
    semanticLocks: Object.freeze([
      'REPLICATION_DOCUMENTAIRE_IS_NOT_INDEPENDENT_CORROBORATION',
      'NO_SHARED_SOURCE_IDENTIFIED_IS_NOT_PROOF_OF_INDEPENDENCE',
      'DIFFERENT_DIAGNOSTICIAN_IS_NOT_INDEPENDENT_OBSERVATION',
      'IDENTICAL_VALUE_IS_NOT_PROOF_OF_SHARED_SOURCE',
      'DIFFERENT_VALUE_IS_NOT_PROOF_OF_INDEPENDENT_SOURCE',
      'SOURCE_REFERENCE_IS_NOT_SOURCE_AUTHENTICITY_PROOF',
      'SHARED_DECLARED_DESCRIPTOR_IS_NOT_SAME_DOCUMENT',
    ]),
  })
}
