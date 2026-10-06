import {
  isDpeCertificationDomain,
  normalizeCertificateNumber,
  normalizeIsoDate,
  verifyCertificationRecord,
} from './core.js';

export const DIAGNOSTICIAN_DIRECTORY_RESOURCE_ID =
  '7987214d-949e-4245-b005-5cc4e7a5df36';

export const TABULAR_API_BASE = 'https://tabular-api.data.gouv.fr/api/resources';

export const DIRECTORY_COLUMNS = Object.freeze({
  lastName: 'Nom',
  firstName: 'Prenom',
  company: 'Societe',
  certificationBody: 'Organisme',
  certificationBodyCode: 'Org Cofrac',
  domain: 'Type de certificat',
  certificateNumber: 'N° de certificat',
  validFrom: 'Date début de validité',
  validUntil: 'Date fin de validité',
});

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fullNameVariants(row) {
  const first = String(row?.[DIRECTORY_COLUMNS.firstName] ?? '').trim();
  const last = String(row?.[DIRECTORY_COLUMNS.lastName] ?? '').trim();
  return [
    normalizeText(`${first} ${last}`),
    normalizeText(`${last} ${first}`),
  ].filter(Boolean);
}

export function buildDirectoryDataUrl(filters = {}, {
  resourceId = DIAGNOSTICIAN_DIRECTORY_RESOURCE_ID,
  pageSize = 50,
} = {}) {
  const url = new URL(`${TABULAR_API_BASE}/${resourceId}/data/`);
  url.searchParams.set('page_size', String(pageSize));
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value).trim());
    }
  }
  return url.toString();
}

export function normalizeDirectoryRecord(row = {}) {
  return Object.freeze({
    fullName: [
      row[DIRECTORY_COLUMNS.firstName],
      row[DIRECTORY_COLUMNS.lastName],
    ].filter(Boolean).join(' ').trim() || null,
    company: String(row[DIRECTORY_COLUMNS.company] ?? '').trim() || null,
    certificationBody:
      String(row[DIRECTORY_COLUMNS.certificationBody] ?? '').trim() || null,
    certificationBodyCode:
      String(row[DIRECTORY_COLUMNS.certificationBodyCode] ?? '').trim() || null,
    domain: String(row[DIRECTORY_COLUMNS.domain] ?? '').trim() || null,
    certificateNumber:
      normalizeCertificateNumber(row[DIRECTORY_COLUMNS.certificateNumber]) || null,
    validFrom: normalizeIsoDate(row[DIRECTORY_COLUMNS.validFrom]),
    validUntil: normalizeIsoDate(row[DIRECTORY_COLUMNS.validUntil]),
  });
}

async function fetchRows(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`TABULAR_API_HTTP_${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

function surnameCandidates(fullName) {
  const tokens = normalizeText(fullName).split(' ').filter(token => token.length >= 2);
  if (!tokens.length) return [];
  return [...new Set([tokens[0], tokens[tokens.length - 1]])];
}

function matchesFullName(row, fullName) {
  const needle = normalizeText(fullName);
  if (!needle) return true;
  return fullNameVariants(row).some(value => value === needle);
}

export async function findDiagnosticianCertifications({
  certificateNumber,
  fullName,
  diagnosticDate,
  referenceDate,
  fetchImpl = globalThis.fetch,
  resourceId = DIAGNOSTICIAN_DIRECTORY_RESOURCE_ID,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function');
  }

  const normalizedCertificate = normalizeCertificateNumber(certificateNumber);
  let rows = [];
  let matchMode = null;

  if (normalizedCertificate) {
    const url = buildDirectoryDataUrl({
      [`${DIRECTORY_COLUMNS.certificateNumber}__exact`]: normalizedCertificate,
    }, { resourceId });
    rows = await fetchRows(url, fetchImpl);
    matchMode = 'certificate';
  }

  if (!rows.length && fullName) {
    for (const candidate of surnameCandidates(fullName)) {
      const url = buildDirectoryDataUrl({
        [`${DIRECTORY_COLUMNS.lastName}__contains`]: candidate,
      }, { resourceId });
      const candidates = await fetchRows(url, fetchImpl);
      const exactNameRows = candidates.filter(row => matchesFullName(row, fullName));
      if (exactNameRows.length) {
        rows = exactNameRows;
        matchMode = 'name';
        break;
      }
    }
  }

  const dpeRows = rows.filter(row =>
    isDpeCertificationDomain(row[DIRECTORY_COLUMNS.domain])
  );

  const records = dpeRows.map(row => {
    const normalized = normalizeDirectoryRecord(row);
    const atDiagnosticDate = verifyCertificationRecord({
      certificateNumber: normalized.certificateNumber,
      domain: normalized.domain,
      validFrom: normalized.validFrom,
      validUntil: normalized.validUntil,
      certificationBody: normalized.certificationBody,
    }, diagnosticDate);

    const today = verifyCertificationRecord({
      certificateNumber: normalized.certificateNumber,
      domain: normalized.domain,
      validFrom: normalized.validFrom,
      validUntil: normalized.validUntil,
      certificationBody: normalized.certificationBody,
    }, referenceDate);

    return Object.freeze({
      ...normalized,
      validOnDiagnosticDate: atDiagnosticDate.validOnDiagnosticDate,
      validToday: today.validOnDiagnosticDate,
      verificationState: atDiagnosticDate.verificationState,
    });
  });

  records.sort((a, b) => {
    if (a.validOnDiagnosticDate === true && b.validOnDiagnosticDate !== true) return -1;
    if (b.validOnDiagnosticDate === true && a.validOnDiagnosticDate !== true) return 1;
    return String(b.validUntil || '').localeCompare(String(a.validUntil || ''));
  });

  return Object.freeze({
    matchMode,
    totalRows: rows.length,
    records: Object.freeze(records),
    resourceId,
  });
}
