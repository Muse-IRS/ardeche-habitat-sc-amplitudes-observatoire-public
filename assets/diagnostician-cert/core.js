export const DIAGNOSTICIAN_CERT_CORE_VERSION = '1.1.0';
export const DIAGNOSTICIAN_CERT_CONTRACT = 'DIAGNOSTICIAN_CERT_CORE_V1';

export const OFFICIAL_DIRECTORY_URL =
  'https://diagnostiqueurs.din.developpement-durable.gouv.fr/trouver-mon-diagnostiqueur';

export const OPEN_DATASET_URL =
  'https://www.data.gouv.fr/datasets/annuaire-des-diagnostiqueurs-immobiliers';

export const DIAGNOSTICIAN_FIELDS = Object.freeze({
  certificateNumber: Object.freeze([
    'numero_certification_diagnostiqueur',
    'numero_certificat_diagnostiqueur',
    'numero_certification',
    'certification_diagnostiqueur',
    'num_certification_diagnostiqueur',
  ]),
  fullName: Object.freeze([
    'nom_prenom_diagnostiqueur',
    'nom_prenom_operateur',
    'diagnostiqueur',
  ]),
  lastName: Object.freeze([
    'nom_diagnostiqueur',
    'nom_operateur',
  ]),
  firstName: Object.freeze([
    'prenom_diagnostiqueur',
    'prenom_operateur',
  ]),
  diagnosticDate: Object.freeze([
    'date_visite_diagnostiqueur',
    'date_etablissement_dpe',
  ]),
  ademeDiagnosticianId: Object.freeze([
    'usr_diagnostiqueur_id',
    'diagnostiqueur_id',
  ]),
});

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function pickFirst(row, keys) {
  for (const key of keys) {
    if (hasValue(row?.[key])) return row[key];
  }
  return null;
}

export function normalizeCertificateNumber(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeIsoDate(value) {
  const raw = String(value ?? '').trim().slice(0, 10).replaceAll('/', '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function extractDiagnosticianContext(row = {}) {
  const explicitFullName = pickFirst(row, DIAGNOSTICIAN_FIELDS.fullName);
  const firstName = pickFirst(row, DIAGNOSTICIAN_FIELDS.firstName);
  const lastName = pickFirst(row, DIAGNOSTICIAN_FIELDS.lastName);
  const compositeName = [firstName, lastName].filter(hasValue).join(' ').trim();

  return Object.freeze({
    certificateNumber: normalizeCertificateNumber(
      pickFirst(row, DIAGNOSTICIAN_FIELDS.certificateNumber)
    ) || null,
    fullName: String(explicitFullName || compositeName || '').trim() || null,
    diagnosticDate: normalizeIsoDate(
      pickFirst(row, DIAGNOSTICIAN_FIELDS.diagnosticDate)
    ),
    ademeDiagnosticianId: String(
      pickFirst(row, DIAGNOSTICIAN_FIELDS.ademeDiagnosticianId) || ''
    ).trim() || null,
    officialDirectoryUrl: OFFICIAL_DIRECTORY_URL,
    openDatasetUrl: OPEN_DATASET_URL,
  });
}

export function isDpeCertificationDomain(value) {
  const text = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return text.includes('performance energetique') || /\bdpe\b/.test(text);
}

export function verifyCertificationRecord(record = {}, diagnosticDateValue) {
  const diagnosticDate = normalizeIsoDate(diagnosticDateValue);
  const validFrom = normalizeIsoDate(record.validFrom ?? record.dateDebut ?? record.date_debut);
  const validUntil = normalizeIsoDate(record.validUntil ?? record.dateFin ?? record.date_fin);
  const domain = record.domain ?? record.domaine ?? record.certification ?? null;

  const dateComparable = Boolean(diagnosticDate && validFrom && validUntil);
  const validOnDiagnosticDate = dateComparable
    ? diagnosticDate >= validFrom && diagnosticDate <= validUntil
    : null;

  const domainMatch = domain ? isDpeCertificationDomain(domain) : null;

  return Object.freeze({
    diagnosticDate,
    validFrom,
    validUntil,
    domain: domain ? String(domain) : null,
    certificationBody:
      record.certificationBody ??
      record.organismeCertificateur ??
      record.organisme_certificateur ??
      null,
    certificateNumber: normalizeCertificateNumber(
      record.certificateNumber ??
      record.numeroCertification ??
      record.numero_certification
    ) || null,
    validOnDiagnosticDate,
    domainMatch,
    verificationState:
      validOnDiagnosticDate === true && domainMatch !== false
        ? 'VALID_ON_DIAGNOSTIC_DATE'
        : validOnDiagnosticDate === false
          ? 'NOT_VALID_ON_DIAGNOSTIC_DATE'
          : 'INDETERMINATE',
  });
}

export function describeDiagnosticianCertCore() {
  return Object.freeze({
    contract: DIAGNOSTICIAN_CERT_CONTRACT,
    version: DIAGNOSTICIAN_CERT_CORE_VERSION,
    semanticLocks: Object.freeze([
      'CERTIFICATE_VALIDITY_IS_NOT_DPE_TECHNICAL_CORRECTNESS',
      'CURRENT_VALIDITY_IS_NOT_VALIDITY_ON_DIAGNOSTIC_DATE',
      'ADEME_DIAGNOSTICIAN_ID_IS_NOT_CERTIFICATE_NUMBER',
      'MISSING_OPEN_DATA_FIELD_IS_NOT_PROOF_OF_ABSENCE',
      'OFFICIAL_DIRECTORY_REMAINS_SOURCE_OF_RECORD',
    ]),
  });
}
