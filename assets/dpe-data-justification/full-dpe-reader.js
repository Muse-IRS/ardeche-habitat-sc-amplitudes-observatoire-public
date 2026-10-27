function clean(value) {
  return String(value ?? '').trim()
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function childText(parent, tag) {
  const node = parent?.querySelector?.(':scope > ' + tag)
  return node ? clean(node.textContent) : ''
}

function xmlItems(document, selector) {
  return [...document.querySelectorAll(selector)]
}

function normalizeDiagnostician(raw = {}) {
  const firstName = clean(raw.firstName ?? raw.prenom_diagnostiqueur)
  const lastName = clean(raw.lastName ?? raw.nom_diagnostiqueur)
  const fullName = clean(raw.fullName) || [firstName, lastName].filter(Boolean).join(' ')
  return Object.freeze({
    firstName: firstName || null,
    lastName: lastName || null,
    fullName: fullName || null,
    company: clean(raw.company ?? raw.entreprise_diagnostiqueur) || null,
    certificateNumber: clean(raw.certificateNumber ?? raw.numero_certification_diagnostiqueur) || null,
    certificationBody: clean(raw.certificationBody ?? raw.organisme_certificateur) || null,
    softwareId: clean(raw.softwareId ?? raw.usr_logiciel_id) || null,
    softwareVersion: clean(raw.softwareVersion ?? raw.version_logiciel) || null,
  })
}

function parseXml(text) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('INVALID_XML')

  const dpeNumber = childText(doc.documentElement, 'numero_dpe') ||
    clean(doc.querySelector('numero_dpe')?.textContent)

  const administratif = doc.querySelector('administratif')
  const diagnostiqueurNode = administratif?.querySelector(':scope > diagnostiqueur') || administratif?.querySelector('diagnostiqueur')
  const diagnosticDate =
    childText(administratif, 'date_visite_diagnostiqueur') ||
    childText(administratif, 'date_etablissement_dpe') ||
    null
  const diagnostician = normalizeDiagnostician({
    nom_diagnostiqueur: childText(diagnostiqueurNode, 'nom_diagnostiqueur'),
    prenom_diagnostiqueur: childText(diagnostiqueurNode, 'prenom_diagnostiqueur'),
    entreprise_diagnostiqueur: childText(diagnostiqueurNode, 'entreprise_diagnostiqueur'),
    numero_certification_diagnostiqueur: childText(diagnostiqueurNode, 'numero_certification_diagnostiqueur'),
    organisme_certificateur: childText(diagnostiqueurNode, 'organisme_certificateur'),
    usr_logiciel_id: childText(diagnostiqueurNode, 'usr_logiciel_id'),
    version_logiciel: childText(diagnostiqueurNode, 'version_logiciel'),
  })

  const justifications = xmlItems(doc, 'justificatif_collection > justificatif, justificatif_collection justificatif')
    .map(node => ({
      description: childText(node, 'description'),
      enum_type_justificatif_id: childText(node, 'enum_type_justificatif_id'),
    }))

  const technicalItems = []
  for (const fiche of xmlItems(doc, 'fiche_technique_collection > fiche_technique, fiche_technique_collection fiche_technique')) {
    const categoryId = childText(fiche, 'enum_categorie_fiche_technique_id')
    const sousFiches = [...fiche.querySelectorAll('sous_fiche_technique_collection > sous_fiche_technique, sous_fiche_technique_collection sous_fiche_technique')]
    for (const item of sousFiches) {
      technicalItems.push({
        categoryId,
        description: childText(item, 'description'),
        value: childText(item, 'valeur'),
        detail_origine_donnee: childText(item, 'detail_origine_donnee'),
        enum_origine_donnee_id: childText(item, 'enum_origine_donnee_id'),
      })
    }
  }

  return Object.freeze({
    sourceKind: 'XML_DPE_COMPLET',
    dpeNumber: dpeNumber || null,
    diagnosticDate,
    diagnostician,
    technicalItems: Object.freeze(technicalItems),
    justifications: Object.freeze(justifications),
  })
}

function parseJson(text) {
  const data = JSON.parse(text)
  const diagnostician = normalizeDiagnostician(data?.administratif?.diagnostiqueur || {})
  const diagnosticDate =
    clean(data?.administratif?.date_visite_diagnostiqueur) ||
    clean(data?.administratif?.date_etablissement_dpe) ||
    null
  const ficheCollection = asArray(data?.fiche_technique_collection?.fiche_technique)
  const technicalItems = []

  for (const fiche of ficheCollection) {
    const categoryId = clean(fiche?.enum_categorie_fiche_technique_id)
    for (const item of asArray(fiche?.sous_fiche_technique_collection?.sous_fiche_technique)) {
      technicalItems.push({
        categoryId,
        description: item?.description,
        value: item?.valeur,
        detail_origine_donnee: item?.detail_origine_donnee,
        enum_origine_donnee_id: item?.enum_origine_donnee_id,
      })
    }
  }

  const justifications = asArray(data?.justificatif_collection?.justificatif)
    .map(item => ({
      description: item?.description,
      enum_type_justificatif_id: item?.enum_type_justificatif_id,
    }))

  return Object.freeze({
    sourceKind: 'JSON_DPE_COMPLET',
    dpeNumber: clean(data?.numero_dpe) || null,
    diagnosticDate,
    diagnostician,
    technicalItems: Object.freeze(technicalItems),
    justifications: Object.freeze(justifications),
  })
}

export function parseDpeFullFileText({name, text}) {
  const lower = clean(name).toLowerCase()
  if (lower.endsWith('.xml')) return parseXml(text)
  if (lower.endsWith('.json')) return parseJson(text)

  const trimmed = clean(text)
  if (trimmed.startsWith('<')) return parseXml(text)
  if (trimmed.startsWith('{')) return parseJson(text)
  throw new Error('UNSUPPORTED_DPE_FILE')
}
