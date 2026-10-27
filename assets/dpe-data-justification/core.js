export const DPE_DATA_JUSTIFICATION_CONTRACT = 'DPE_DATA_JUSTIFICATION_CORE_V1'
export const DPE_DATA_JUSTIFICATION_VERSION = '0.1.0'

function clean(value) {
  return String(value ?? '').trim()
}

function hasValue(value) {
  return value !== undefined && value !== null && clean(value) !== ''
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function summarizeOpenDataRow(row = {}, datasetId = null) {
  const nonEmptyFields = Object.entries(row).filter(([, value]) => hasValue(value))
  return Object.freeze({
    contract: DPE_DATA_JUSTIFICATION_CONTRACT,
    version: DPE_DATA_JUSTIFICATION_VERSION,
    datasetId: datasetId || null,
    dpeNumber: clean(row.numero_dpe) || null,
    nonEmptyFieldCount: nonEmptyFields.length,
    valuePresence: nonEmptyFields.length ? 'VALUE_PRESENT_IN_DATABASE' : 'NO_VALUE',
    originMetadataState: 'NOT_ASSESSED_FROM_AGGREGATED_OPEN_DATA_ROW',
    justificationMetadataState: 'NOT_EXPOSED_AS_SOURCE_DOCUMENT_IN_AGGREGATED_ROW',
    sourceDocumentState: 'SOURCE_DOCUMENT_NOT_PRESENT_IN_OPEN_DATA_ROW',
    supportRelation: 'UNESTABLISHED',
    semanticLocks: Object.freeze([
      'VALUE_IN_DATABASE_IS_NOT_JUSTIFICATION',
      'DECLARED_ORIGIN_IS_NOT_SOURCE_DOCUMENT',
      'DECLARED_JUSTIFICATION_IS_NOT_DOCUMENT_PAYLOAD',
      'JUSTIFICATION_INVENTORY_IS_NOT_FIELD_LEVEL_SUPPORT_RELATION',
      'DATABASE_ACCEPTANCE_IS_NOT_MATERIAL_VERIFICATION',
    ]),
  })
}

export function normalizeTechnicalItem(raw = {}) {
  const description = clean(raw.description)
  const value = raw.value ?? raw.valeur ?? null
  const originDetail = clean(raw.originDetail ?? raw.detail_origine_donnee)
  const originTypeId = clean(raw.originTypeId ?? raw.enum_origine_donnee_id)

  return Object.freeze({
    categoryId: clean(raw.categoryId) || null,
    description: description || 'Donnée technique sans libellé',
    value: hasValue(value) ? value : null,
    originDetail: originDetail || null,
    originTypeId: originTypeId || null,
    valueState: hasValue(value) ? 'VALUE_PRESENT' : 'VALUE_ABSENT',
    originState: originDetail || originTypeId ? 'ORIGIN_METADATA_PRESENT' : 'ORIGIN_METADATA_ABSENT',
    directJustificationLinkState: 'NO_EXPLICIT_FIELD_TO_JUSTIFICATION_LINK_IN_INSPECTED_SCHEMA',
    sourceDocumentState: 'SOURCE_DOCUMENT_NOT_EMBEDDED',
    supportRelation: 'UNESTABLISHED',
  })
}

export function normalizeJustification(raw = {}) {
  return Object.freeze({
    description: clean(raw.description) || 'Justificatif déclaré sans description',
    typeId: clean(raw.typeId ?? raw.enum_type_justificatif_id) || null,
    declarationState: 'JUSTIFICATION_DECLARED',
    sourceDocumentState: 'SOURCE_DOCUMENT_NOT_EMBEDDED',
    authenticityState: 'UNVERIFIED',
  })
}

export function buildJustificationAudit({
  dpeNumber,
  technicalItems = [],
  justifications = [],
  sourceKind = null,
} = {}) {
  const normalizedTechnicalItems = asArray(technicalItems).map(normalizeTechnicalItem)
  const normalizedJustifications = asArray(justifications).map(normalizeJustification)
  const withOrigin = normalizedTechnicalItems.filter(item => item.originState === 'ORIGIN_METADATA_PRESENT').length
  const withValue = normalizedTechnicalItems.filter(item => item.valueState === 'VALUE_PRESENT').length

  return Object.freeze({
    contract: DPE_DATA_JUSTIFICATION_CONTRACT,
    version: DPE_DATA_JUSTIFICATION_VERSION,
    dpeNumber: clean(dpeNumber) || null,
    sourceKind: sourceKind || null,
    counts: Object.freeze({
      technicalItems: normalizedTechnicalItems.length,
      technicalValuesPresent: withValue,
      technicalItemsWithOriginMetadata: withOrigin,
      declaredJustifications: normalizedJustifications.length,
      embeddedSourceDocuments: 0,
      explicitFieldToJustificationLinks: 0,
    }),
    technicalItems: Object.freeze(normalizedTechnicalItems),
    justifications: Object.freeze(normalizedJustifications),
    relationAssessment: Object.freeze({
      dpeHasDeclaredJustificationInventory: normalizedJustifications.length > 0,
      fieldLevelSupportRelation: 'UNESTABLISHED',
      sourceDocumentAvailability: 'NOT_EMBEDDED_IN_INSPECTED_DPE_PAYLOAD',
      boundedConclusion:
        normalizedJustifications.length > 0
          ? 'Le DPE déclare au moins un justificatif, mais la relation entre chaque donnée technique et un document source précis n’est pas établie par cette structure.'
          : 'Aucun justificatif déclaré n’a été trouvé dans le fichier inspecté ; cela ne prouve pas qu’aucun document n’a existé hors de ce fichier.',
    }),
    semanticLocks: Object.freeze([
      'VALUE_IN_DATABASE_IS_NOT_JUSTIFICATION',
      'DECLARED_ORIGIN_IS_NOT_SOURCE_DOCUMENT',
      'DECLARED_JUSTIFICATION_IS_NOT_DOCUMENT_PAYLOAD',
      'JUSTIFICATION_INVENTORY_IS_NOT_FIELD_LEVEL_SUPPORT_RELATION',
      'SOURCE_REFERENCE_IS_NOT_SOURCE_AUTHENTICITY_PROOF',
      'DATABASE_ACCEPTANCE_IS_NOT_MATERIAL_VERIFICATION',
    ]),
  })
}
