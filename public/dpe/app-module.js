import {
  HISTORICAL_ENERGY_THRESHOLDS,
  HISTORICAL_GES_THRESHOLDS,
  deriveCalculationInputs,
  electricityFactorForDate,
  hasValue,
  historicalClass,
  historicalEnergyClass,
  historicalGesClass,
  historicalValidity,
  isHistoricalDataset,
  isValidDpeNumber,
  normalizeDpeNumber,
  normalizeSearchText,
} from '../assets/dpe-ademe/core.js'
import {
  buildDpeUrl,
  createMetadataClient,
  findDpeByNumber,
} from '../assets/dpe-ademe/ademe-client.js'

import {
  OFFICIAL_DIRECTORY_URL,
  OPEN_DATASET_URL,
  extractDiagnosticianContext,
} from '../assets/diagnostician-cert/core.js'
import {
  findDiagnosticianCertifications,
} from '../assets/diagnostician-cert/tabular-client.js'

const form = document.querySelector('#dpe-form')
const input = document.querySelector('#dpe-number')
const status = document.querySelector('#dpe-status')
const result = document.querySelector('#dpe-result')
const summary = document.querySelector('#dpe-summary')
const xlsxLink = document.querySelector('#xlsx-link')
const addressDetails = document.querySelector('#address-details')
const fullAddress = document.querySelector('#full-address')
const historicalPanel = document.querySelector('#dpe-historical-panel')
const historicalSummary = document.querySelector('#dpe-historical-summary')
const historicalMethodExplanation = document.querySelector('#dpe-historical-method-explanation')
const calculationPanel = document.querySelector('#dpe-calculation-panel')
const calculationSummary = document.querySelector('#dpe-calculation-summary')
const fieldsPanel = document.querySelector('#dpe-fields-panel')
const fieldsStatus = document.querySelector('#dpe-fields-status')
const fieldsContainer = document.querySelector('#dpe-fields-container')

const diagnosticianPanel = document.querySelector('#dpe-diagnostician-panel')
const diagnosticianSummary = document.querySelector('#dpe-diagnostician-summary')
const diagnosticianStatus = document.querySelector('#dpe-diagnostician-status')
const diagnosticianDirectoryLink = document.querySelector('#dpe-diagnostician-directory-link')
const diagnosticianDatasetLink = document.querySelector('#dpe-diagnostician-dataset-link')

const referenceDate = new Date().toISOString().slice(0, 10)
const metadataClient = createMetadataClient()
let diagnosticianLookupSequence = 0

function formatSurface(value) {
  if (!hasValue(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toLocaleString('fr-FR')} m²` : String(value)
}

function formatNumber(value, unit) {
  if (!hasValue(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toLocaleString('fr-FR')} ${unit}` : String(value)
}

function coarseLocation(row) {
  const postal = row.code_postal_ban || row.code_postal || ''
  const city = row.nom_commune_ban || row.nom_commune || row.commune || ''
  if (postal || city) return `${postal} ${city}`.trim()

  const address = String(row.adresse_ban || row.adresse || row.geo_adresse || '').trim()
  const match = address.match(/\b(\d{5})\s+(.+)$/)
  if (match) return `${match[1]} ${match[2]}`

  const department = row.tv016_departement_code || ''
  const insee = row.code_insee_commune_actualise || ''
  if (department || insee) {
    const parts = []
    if (department) parts.push(`département ${department}`)
    if (insee) parts.push(`code INSEE ${insee}`)
    return parts.join(' · ')
  }

  return address ? 'Localisation disponible' : null
}

function addDefinition(target, label, value, detail = '') {
  if (!target || !hasValue(value)) return
  const wrapper = document.createElement('div')
  const term = document.createElement('dt')
  const description = document.createElement('dd')
  term.textContent = label
  description.textContent = String(value)
  if (detail) {
    const extra = document.createElement('small')
    extra.className = 'muted'
    extra.textContent = ` — ${detail}`
    description.append(extra)
  }
  wrapper.append(term, description)
  target.append(wrapper)
}

function addSummary(label, value, detail = '') {
  addDefinition(summary, label, value, detail)
}

function formatIsoDateFr(value) {
  const raw = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || null
  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(date)
}

function historicalClassCheck(value, published, thresholds, unit) {
  const expected = historicalClass(value, thresholds)
  const publishedLabel = String(published ?? '').trim().toUpperCase()
  if (!expected) return 'Valeur numérique insuffisante pour recomposer la classe.'
  if (!/^[A-G]$/.test(publishedLabel)) {
    return `Classe recomposée à partir de la valeur : ${expected}. La classe publiée « ${publishedLabel || '—'} » n’est pas comparable directement à l’échelle logement A–G.`
  }
  const relation = expected === publishedLabel ? 'identique à la classe publiée' : `différente de la classe publiée (${publishedLabel})`
  return `${expected} — ${relation}, à partir de ${formatNumber(value, unit)}.`
}

function historicalMethodProfile(row) {
  const rawMethod = String(row.nom_methode_dpe || '').trim()
  const rawVersion = String(row.version_methode_dpe || '').trim()
  const text = normalizeSearchText(`${rawMethod} ${rawVersion}`)
  const v13 = /1[.,]3|v\s*2012|version\s*2012/.test(text)

  if (/factur|consommation(s)?\s+reell|releve/.test(text)) {
    return {
      id: 'bills',
      label: 'Méthode sur consommations réelles / factures',
      versionNote: rawVersion || 'Version non renseignée dans la vue agrégée ADEME.',
      input: 'Consommations réellement relevées ou facturées, en principe moyennées sur les trois années précédant le diagnostic ; des règles de repli existaient lorsque cette période complète n’était pas disponible.',
      chain: 'Factures ou relevés par énergie → conversion dans une unité énergétique commune → énergie finale en kWh → énergie primaire → rapport à la surface → étiquette énergie ; les émissions sont calculées en parallèle à partir des énergies consommées.',
      replay: 'La vue agrégée ADEME ne contient pas les factures sources ni le détail annuel. Elle permet donc d’expliquer la transformation réglementaire, mais pas de recalculer la moyenne historique exacte.'
    }
  }

  if (/3cl/.test(text)) {
    return {
      id: '3cl',
      label: v13 ? '3CL-DPE v1.3 / version 2012' : '3CL-DPE historique',
      versionNote: v13
        ? 'La version 1.3 correspond à la révision 2012 de la méthode, appliquée aux DPE à partir de 2013.'
        : (rawVersion || 'Version exacte non reconnue dans le libellé ADEME.'),
      input: 'Caractéristiques thermiques et géométriques du logement, parois et baies, orientation, renouvellement d’air, climat conventionnel et systèmes de chauffage, d’eau chaude sanitaire et de refroidissement.',
      chain: 'Déperditions de l’enveloppe et renouvellement d’air − apports solaires et internes → besoin de chauffage → rendement et pertes des systèmes → consommations finales ; l’eau chaude sanitaire et le refroidissement sont ajoutés, puis les énergies sont converties en énergie primaire.',
      replay: 'La ligne historique agrégée ne contient pas les données composant par composant nécessaires pour rejouer intégralement 3CL-DPE. Elle permet cependant de reconstruire la logique et de vérifier le passage de la valeur finale à la classe.'
    }
  }

  if (/del\s*6|del6/.test(text)) {
    return {
      id: 'dynamic',
      label: 'DEL6-DPE — simulation dynamique historique',
      versionNote: rawVersion || 'Version non renseignée dans la vue agrégée ADEME.',
      input: 'Description thermique et géométrique du bâtiment et de ses systèmes, utilisée dans une simulation dynamique à pas de temps horaire.',
      chain: 'Simulation horaire des besoins et comportements thermiques → consommations conventionnelles de chauffage, eau chaude sanitaire et refroidissement → énergie primaire et émissions → classes historiques.',
      replay: 'Le moteur DEL6 et ses entrées détaillées ne sont pas présents dans la vue agrégée ; la page conserve donc une explication de chaîne sans prétendre reproduire la simulation.'
    }
  }

  if (/comfie/.test(text)) {
    return {
      id: 'dynamic',
      label: 'Comfie-DPE — simulation dynamique historique',
      versionNote: rawVersion || 'Version non renseignée dans la vue agrégée ADEME.',
      input: 'Description thermique et géométrique du bâtiment et de ses systèmes, utilisée dans une simulation dynamique à pas de temps horaire.',
      chain: 'Simulation horaire des besoins thermiques → consommations conventionnelles de chauffage, eau chaude sanitaire et refroidissement → énergie primaire et émissions → classes historiques.',
      replay: 'Le moteur Comfie et ses entrées détaillées ne sont pas présents dans la vue agrégée ; la page conserve donc une explication de chaîne sans prétendre reproduire la simulation.'
    }
  }

  if (/th.?c.?e|thce/.test(text)) {
    return {
      id: 'thce',
      label: 'TH-C-E ex / méthode thermique conventionnelle historique',
      versionNote: rawVersion || 'Version non renseignée dans la vue agrégée ADEME.',
      input: 'Données thermiques du bâtiment et des équipements, traitées dans le référentiel conventionnel indiqué par le DPE.',
      chain: 'Modélisation thermique conventionnelle → besoins et consommations des usages couverts → énergie finale → énergie primaire et émissions → classes historiques.',
      replay: 'Le libellé ADEME identifie la famille, mais la vue agrégée ne fournit ni les paramètres détaillés ni le moteur utilisé. Aucun rejeu numérique complet n’est donc affirmé.'
    }
  }

  if (/convention/.test(text)) {
    return {
      id: 'conventional',
      label: 'Méthode conventionnelle historique',
      versionNote: rawVersion || 'Version non renseignée dans la vue agrégée ADEME.',
      input: 'Caractéristiques du bâtiment et de ses équipements selon le champ d’application de la méthode déclarée.',
      chain: 'Données conventionnelles → besoins → consommations finales → énergie primaire et émissions → classes historiques.',
      replay: 'La famille est identifiable, mais le nom/version disponible ne suffit pas à sélectionner un moteur historique précis.'
    }
  }

  return {
    id: 'unknown',
    label: 'Méthode historique non reconnue automatiquement',
    versionNote: rawVersion || 'Version non renseignée dans la vue agrégée ADEME.',
    input: 'Le nom et la version publiés sont conservés sans les assimiler à une méthode connue.',
    chain: 'La valeur énergie et la valeur GES publiées peuvent encore être reliées aux anciennes grilles A–G lorsque ces valeurs sont numériques.',
    replay: 'Aucune formule propre à cette méthode n’est affichée tant que son référentiel n’est pas identifié de manière suffisamment sûre.'
  }
}

function historicalMethodMode(row) {
  return historicalMethodProfile(row).label
}

function createMethodCard(title, text) {
  const article = document.createElement('article')
  const strong = document.createElement('strong')
  const span = document.createElement('span')
  strong.textContent = title
  span.textContent = text
  article.append(strong, span)
  return article
}

function renderHistoricalMethodExplanation(row) {
  if (!historicalMethodExplanation) return
  historicalMethodExplanation.innerHTML = ''

  const profile = historicalMethodProfile(row)
  const grid = document.createElement('div')
  grid.className = 'principle-grid'

  grid.append(
    createMethodCard('Référentiel identifié', `${profile.label}. ${profile.versionNote}`),
    createMethodCard('Entrées qui alimentaient le calcul', profile.input),
    createMethodCard('Chaîne de production de la valeur', profile.chain),
    createMethodCard('Conversion historique en énergie primaire', 'Pour le régime historique des logements : facteur 2,58 pour l’électricité et 1 pour les autres énergies, puis rapport de l’énergie primaire retenue à la surface du logement.'),
    createMethodCard('Classe énergie recomposée', historicalClassCheck(row.consommation_energie, row.classe_consommation_energie, HISTORICAL_ENERGY_THRESHOLDS, 'kWhEP/m²/an')),
    createMethodCard('Classe climat recomposée', historicalClassCheck(row.estimation_ges, row.classe_estimation_ges, HISTORICAL_GES_THRESHOLDS, 'kgCO₂e/m²/an'))
  )

  const replay = document.createElement('div')
  replay.className = 'callout'
  const replayText = document.createElement('p')
  const replayStrong = document.createElement('strong')
  replayStrong.textContent = 'Niveau de rejeu possible avec cette ligne ADEME : '
  replayText.append(replayStrong, document.createTextNode(profile.replay))
  replay.append(replayText)

  historicalMethodExplanation.append(grid, replay)
}

function renderHistorical(row, dataset) {
  if (!historicalPanel || !historicalSummary) return
  if (!isHistoricalDataset(dataset)) {
    historicalPanel.hidden = true
    return
  }

  historicalSummary.innerHTML = ''
  const validity = historicalValidity(row.date_etablissement_dpe, referenceDate)

  addDefinition(historicalSummary, 'Génération du DPE', 'Avant le 1er juillet 2021')
  addDefinition(historicalSummary, 'Méthode déclarée par l’ADEME', row.nom_methode_dpe)
  addDefinition(historicalSummary, 'Version de méthode', row.version_methode_dpe)
  addDefinition(historicalSummary, 'Référentiel interprété', historicalMethodMode(row), 'identification fondée sur nom_methode_dpe + version_methode_dpe')
  addDefinition(historicalSummary, 'Consommation énergie publiée', formatNumber(row.consommation_energie, 'kWhEP/m²/an'))
  addDefinition(historicalSummary, 'Classe énergie historique', row.classe_consommation_energie)
  addDefinition(historicalSummary, 'Classe énergie recomposée', historicalEnergyClass(row.consommation_energie), 'grille historique logement A–G')
  addDefinition(historicalSummary, 'Estimation GES publiée', formatNumber(row.estimation_ges, 'kgCO₂e/m²/an'))
  addDefinition(historicalSummary, 'Classe GES historique', row.classe_estimation_ges)
  addDefinition(historicalSummary, 'Classe GES recomposée', historicalGesClass(row.estimation_ges), 'grille historique logement A–G')
  addDefinition(historicalSummary, 'Statut réglementaire aujourd’hui', validity.status)
  addDefinition(historicalSummary, 'Échéance de validité', formatIsoDateFr(validity.expiry), validity.rule)

  renderHistoricalMethodExplanation(row)
  historicalPanel.hidden = false
}

function renderCalculation(row, dataset) {
  if (!calculationPanel || !calculationSummary) return
  if (dataset?.id !== 'dpe03existant') {
    calculationPanel.hidden = true
    return
  }
  calculationSummary.innerHTML = ''

  const { cep, ges, surface } = deriveCalculationInputs(row)
  const establishedFactor = electricityFactorForDate(row.date_etablissement_dpe, referenceDate)
  const currentFactor = electricityFactorForDate(null, referenceDate)

  addDefinition(calculationSummary, 'Indicateur énergie primaire (5 usages)', formatNumber(cep, 'kWhEP/m²/an'))
  addDefinition(calculationSummary, 'Indicateur émissions (5 usages)', formatNumber(ges, 'kgCO₂e/m²/an'))
  addDefinition(calculationSummary, 'Surface de référence disponible', formatSurface(surface))
  addDefinition(calculationSummary, 'Étiquette DPE publiée', row.etiquette_dpe)
  addDefinition(calculationSummary, 'Étiquette climat publiée', row.etiquette_ges)
  addDefinition(
    calculationSummary,
    'Coefficient EP de l’électricité à la date du DPE',
    establishedFactor,
    'coefficient réglementaire dépendant de la date'
  )
  addDefinition(
    calculationSummary,
    'Coefficient EP de l’électricité au jour de consultation',
    currentFactor,
    currentFactor === establishedFactor ? 'identique à celui affiché ci-dessus' : 'peut différer de celui appliqué lors de l’établissement'
  )

  calculationPanel.hidden = false
}

async function renderDiagnostician(row) {
  if (!diagnosticianPanel || !diagnosticianSummary || !diagnosticianStatus) return

  const lookupSequence = ++diagnosticianLookupSequence
  const context = extractDiagnosticianContext(row)
  diagnosticianSummary.innerHTML = ''

  addDefinition(diagnosticianSummary, 'Diagnostiqueur publié dans la ligne ADEME', context.fullName)
  addDefinition(diagnosticianSummary, 'Numéro de certification publié', context.certificateNumber)
  addDefinition(
    diagnosticianSummary,
    'Date du DPE contrôlée',
    formatIsoDateFr(context.diagnosticDate),
    context.diagnosticDate ? 'date de visite prioritaire, sinon date d’établissement du DPE' : ''
  )
  addDefinition(
    diagnosticianSummary,
    'Identifiant interne ADEME du diagnostiqueur',
    context.ademeDiagnosticianId,
    'cet identifiant n’est pas un numéro de certification'
  )

  if (diagnosticianDirectoryLink) diagnosticianDirectoryLink.href = OFFICIAL_DIRECTORY_URL
  if (diagnosticianDatasetLink) diagnosticianDatasetLink.href = OPEN_DATASET_URL

  diagnosticianPanel.hidden = false

  if (!context.certificateNumber && !context.fullName) {
    diagnosticianStatus.textContent =
      'La ligne ADEME ne contient pas assez d’information pour lancer automatiquement la recherche du certificat. Le contrôle manuel reste disponible en source secondaire.'
    return
  }

  diagnosticianStatus.textContent =
    'Recherche automatique du certificat dans l’API tabulaire data.gouv.fr…'

  try {
    const found = await findDiagnosticianCertifications({
      certificateNumber: context.certificateNumber,
      fullName: context.fullName,
      diagnosticDate: context.diagnosticDate,
      referenceDate,
    })

    if (lookupSequence !== diagnosticianLookupSequence) return

    if (!found.records.length) {
      diagnosticianStatus.textContent =
        found.matchMode === 'certificate'
          ? 'Aucune certification DPE correspondante n’a été retrouvée automatiquement pour ce numéro dans la ressource tabulaire interrogée. Le contrôle manuel reste disponible en source secondaire.'
          : 'Aucune certification DPE correspondante n’a été retrouvée automatiquement par nom dans la ressource tabulaire interrogée. Le contrôle manuel reste disponible en source secondaire.'
      return
    }

    const certification = found.records[0]
    addDefinition(diagnosticianSummary, 'Diagnostiqueur dans l’annuaire national', certification.fullName)
    addDefinition(diagnosticianSummary, 'Organisme certificateur', certification.certificationBody)
    addDefinition(diagnosticianSummary, 'Code organisme', certification.certificationBodyCode)
    addDefinition(diagnosticianSummary, 'Domaine certifié', certification.domain)
    addDefinition(diagnosticianSummary, 'N° de certificat — annuaire', certification.certificateNumber)
    addDefinition(diagnosticianSummary, 'Début de validité', formatIsoDateFr(certification.validFrom))
    addDefinition(diagnosticianSummary, 'Fin de validité', formatIsoDateFr(certification.validUntil))
    addDefinition(
      diagnosticianSummary,
      'Valide à la date du DPE',
      certification.validOnDiagnosticDate === true
        ? 'OUI'
        : certification.validOnDiagnosticDate === false
          ? 'NON'
          : 'INDÉTERMINÉ'
    )
    addDefinition(
      diagnosticianSummary,
      'Valide au jour de consultation',
      certification.validToday === true
        ? 'OUI'
        : certification.validToday === false
          ? 'NON'
          : 'INDÉTERMINÉ'
    )
    addDefinition(
      diagnosticianSummary,
      'Mode de rapprochement',
      found.matchMode === 'certificate' ? 'Numéro de certificat' : 'Nom du diagnostiqueur'
    )

    if (certification.validOnDiagnosticDate === true) {
      diagnosticianStatus.textContent =
        'Certification DPE retrouvée automatiquement : la période publiée couvre la date du diagnostic. Cette vérification porte sur l’habilitation professionnelle, pas sur l’exactitude technique du DPE.'
    } else if (certification.validOnDiagnosticDate === false) {
      diagnosticianStatus.textContent =
        'Certification DPE retrouvée automatiquement, mais la période publiée ne couvre pas la date du diagnostic. Vérifier la chronologie et la fiche officielle avant toute conclusion.'
    } else {
      diagnosticianStatus.textContent =
        'Certification DPE retrouvée automatiquement, mais les dates disponibles ne permettent pas de conclure sur sa validité à la date du diagnostic.'
    }

    if (found.records.length > 1) {
      diagnosticianStatus.textContent += ` ${found.records.length} lignes DPE pertinentes ont été retrouvées ; la ligne affichée en priorité est celle qui couvre la date du diagnostic lorsqu’elle existe.`
    }
  } catch (error) {
    console.error(error)
    if (lookupSequence !== diagnosticianLookupSequence) return
    diagnosticianStatus.textContent =
      'L’API tabulaire data.gouv.fr ne répond pas actuellement. Le DPE reste affiché et le contrôle manuel de la source officielle reste disponible.'
  }
}

function schemaLabel(field) {
  return field?.['x-concept']?.title || field?.title || field?.label || field?.key || 'Champ ADEME'
}

function schemaGroup(field) {
  return field?.['x-group'] || 'Autres champs'
}

function schemaDescription(field) {
  const description = String(field?.description || '').trim()
  return description || 'Description non renseignée dans le schéma API ADEME.'
}

function shouldMaskValue(key) {
  return /(^|_)(adresse|nom_rue|numero_voie|complement_adresse|coordonnee|longitude|latitude|geopoint|geo_shape)(_|$)/i.test(key)
}

function displayFieldValue(key, value) {
  if (!hasValue(value)) return '—'
  if (shouldMaskValue(key)) return 'Valeur masquée dans cette vue publique.'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function createFieldDefinition(field, row) {
  const wrapper = document.createElement('div')
  const term = document.createElement('dt')
  const description = document.createElement('dd')
  const key = field.key
  const value = displayFieldValue(key, row[key])

  term.textContent = schemaLabel(field)
  description.append(document.createTextNode(value))

  const metadata = document.createElement('small')
  metadata.className = 'muted'
  metadata.textContent = ` — ${key} · ${field.type || 'type non indiqué'} · ${schemaDescription(field)}`
  description.append(metadata)

  wrapper.append(term, description)
  return wrapper
}

async function renderFieldDictionary(found) {
  if (!fieldsPanel || !fieldsStatus || !fieldsContainer) return

  fieldsPanel.hidden = false
  fieldsStatus.textContent = 'Chargement du dictionnaire de colonnes ADEME…'
  fieldsContainer.innerHTML = ''

  try {
    const metadata = await metadataClient.get(found.dataset.id)
    const schema = Array.isArray(metadata.schema) ? metadata.schema : []
    if (!schema.length) throw new Error('Schéma ADEME indisponible')

    const groups = new Map()
    for (const field of schema) {
      if (!field?.key) continue
      const group = schemaGroup(field)
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(field)
    }

    const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
    for (const [groupName, fields] of orderedGroups) {
      const details = document.createElement('details')
      const title = document.createElement('summary')
      const populated = fields.filter(field => hasValue(found.row[field.key])).length
      title.textContent = `${groupName} — ${fields.length} champs, ${populated} renseignés pour ce DPE`
      details.append(title)

      const list = document.createElement('dl')
      list.className = 'summary-grid'
      for (const field of fields) list.append(createFieldDefinition(field, found.row))
      details.append(list)
      fieldsContainer.append(details)
    }

    fieldsStatus.textContent = `${schema.length} colonnes décrites à partir du schéma API ADEME courant. Les valeurs d’adresse précise et de coordonnées restent masquées.`
  } catch (error) {
    console.error(error)
    fieldsStatus.textContent = 'Le DPE est disponible, mais le dictionnaire de colonnes ADEME ne répond pas actuellement.'
  }
}

function resetExtendedViews() {
  if (historicalPanel) historicalPanel.hidden = true
  if (historicalSummary) historicalSummary.innerHTML = ''
  if (historicalMethodExplanation) historicalMethodExplanation.innerHTML = ''
  if (calculationPanel) calculationPanel.hidden = true
  if (calculationSummary) calculationSummary.innerHTML = ''
  if (fieldsPanel) fieldsPanel.hidden = true
  if (fieldsContainer) fieldsContainer.innerHTML = ''
  if (fieldsStatus) fieldsStatus.textContent = ''
  if (diagnosticianPanel) diagnosticianPanel.hidden = true
  if (diagnosticianSummary) diagnosticianSummary.innerHTML = ''
  if (diagnosticianStatus) diagnosticianStatus.textContent = ''
  diagnosticianLookupSequence += 1
}

function render(found, number) {
  const { row, dataset } = found
  summary.innerHTML = ''

  const historical = isHistoricalDataset(dataset)
  const validity = historical ? historicalValidity(row.date_etablissement_dpe, referenceDate) : null
  const energyLabel = row.etiquette_dpe || row.classe_consommation_energie
  const climateLabel = row.etiquette_ges || row.classe_estimation_ges
  const surface = row.surface_habitable_logement || row.surface_reference || row.surface_thermique_lot
  const buildingType = row.type_batiment || row.tr002_type_batiment_description || row.tr001_modele_dpe_type_libelle

  addSummary('Source', dataset.label)
  addSummary('Jeu ADEME', dataset.id)
  addSummary('Numéro DPE', row.numero_dpe)
  addSummary('Étiquette énergie publiée', energyLabel)
  addSummary('Étiquette climat publiée', climateLabel)
  addSummary('Date d’établissement', row.date_etablissement_dpe)
  addSummary('Fin de validité', historical ? formatIsoDateFr(validity?.expiry) : row.date_fin_validite_dpe, historical ? validity?.rule : '')
  addSummary('Statut réglementaire aujourd’hui', historical ? validity?.status : null)
  addSummary('Méthode déclarée', historical ? row.nom_methode_dpe : null)
  addSummary('Version de méthode', historical ? row.version_methode_dpe : null)
  addSummary('Surface habitable / référence', formatSurface(surface))
  addSummary('Année de construction', row.annee_construction)
  addSummary('Type de bâtiment', buildingType)
  addSummary('Localisation', coarseLocation(row))

  const address = String(row.adresse_ban || row.adresse || row.geo_adresse || '').trim()
  if (address) {
    fullAddress.textContent = address
    addressDetails.hidden = false
    addressDetails.open = false
  } else {
    fullAddress.textContent = ''
    addressDetails.hidden = true
  }

  xlsxLink.href = buildDpeUrl(dataset.id, number, 'xlsx')
  xlsxLink.hidden = false
  result.hidden = false
  renderDiagnostician(row)
  renderHistorical(row, dataset)
  renderCalculation(row, dataset)
}

form.addEventListener('submit', async event => {
  event.preventDefault()
  const number = normalizeDpeNumber(input.value)
  input.value = number
  result.hidden = true
  xlsxLink.hidden = true
  addressDetails.hidden = true
  resetExtendedViews()

  if (!isValidDpeNumber(number)) {
    status.textContent = 'Numéro non reconnu. Vérifier les 13 caractères alphanumériques du DPE.'
    return
  }

  status.textContent = 'Recherche dans les jeux publics ADEME, y compris le jeu historique antérieur à juillet 2021…'

  try {
    const found = await findDpeByNumber(number)
    if (!found) {
      status.textContent = 'Aucun enregistrement exact retrouvé dans les jeux ADEME interrogés.'
      return
    }
    render(found, number)
    status.textContent = isHistoricalDataset(found.dataset)
      ? 'DPE historique retrouvé. Le nom et la version de méthode sont utilisés pour ouvrir son référentiel d’origine et recomposer les anciennes classes à partir des valeurs publiées.'
      : 'DPE retrouvé dans la source publique ADEME. Le dictionnaire des colonnes est chargé séparément.'
    await renderFieldDictionary(found)
  } catch (error) {
    console.error(error)
    status.textContent = 'La source ADEME ne répond pas actuellement. Réessayer plus tard ou utiliser l’Observatoire ADEME.'
  }
})
