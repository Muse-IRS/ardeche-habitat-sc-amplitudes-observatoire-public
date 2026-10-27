export const DPE_DOCUMENT_DEPENDENCY_CONTRACT = 'DPE_DOCUMENT_DEPENDENCY_CORE_V1'
export const DPE_DOCUMENT_DEPENDENCY_VERSION = '0.1.0'

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

export function normalizeInventory({
  dpeNumber,
  sourceRefs,
  completeness = 'UNKNOWN',
} = {}) {
  const normalizedCompleteness = INVENTORY_COMPLETENESS.includes(completeness)
    ? completeness
    : 'UNKNOWN'

  return Object.freeze({
    dpeNumber: clean(dpeNumber).toUpperCase() || null,
    sourceRefs: parseSourceRefs(sourceRefs),
    completeness: normalizedCompleteness,
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

  let state = 'INDETERMINATE'
  if (sharedRefs.length) {
    state = 'SHARED_SOURCE_REFERENCE_ESTABLISHED'
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
    ]),
  })
}
