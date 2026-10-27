import { normalizeCertificateNumber } from '../diagnostician-cert/core.js'

export const DPE_AUTHOR_VERIFICATION_CONTRACT = 'DPE_AUTHOR_VERIFICATION_CORE_V1'
export const DPE_AUTHOR_VERIFICATION_VERSION = '0.2.0'

const FIELDS = Object.freeze({
  fullName: ['nom_prenom_diagnostiqueur','diagnostiqueur','nom_prenom_operateur'],
  certificateNumber: ['numero_certification_diagnostiqueur','numero_certificat_diagnostiqueur','numero_certification'],
  company: ['raison_sociale_diagnostiqueur','societe_diagnostiqueur','societe'],
  certificationBody: ['organisme_certificateur','organismeCertificateur'],
  ademeDiagnosticianId: ['usr_diagnostiqueur_id','diagnostiqueur_id'],
})

function hasValue(v){ return v !== undefined && v !== null && String(v).trim() !== '' }
function pick(row, keys){ for(const k of keys){ if(hasValue(row?.[k])) return row[k] } return null }
function norm(v){ return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ') }

export function extractAuthorSource(row={}){
  const fullName=pick(row,FIELDS.fullName)
  const certificateNumber=normalizeCertificateNumber(pick(row,FIELDS.certificateNumber)) || null
  const company=pick(row,FIELDS.company)
  const certificationBody=pick(row,FIELDS.certificationBody)
  const ademeDiagnosticianId=pick(row,FIELDS.ademeDiagnosticianId)
  const present=[fullName,certificateNumber,company,certificationBody,ademeDiagnosticianId].filter(hasValue).length
  return Object.freeze({
    fullName: fullName ? String(fullName).trim() : null,
    certificateNumber,
    company: company ? String(company).trim() : null,
    certificationBody: certificationBody ? String(certificationBody).trim() : null,
    ademeDiagnosticianId: ademeDiagnosticianId ? String(ademeDiagnosticianId).trim() : null,
    sourceState: present ? 'PARTIAL_OR_AVAILABLE' : 'IDENTITY_NOT_AVAILABLE_IN_OPEN_DATA_ROW',
  })
}

export function extractAuthorFromFullDpe(parsed = {}) {
  const d = parsed?.diagnostician || {}
  const fullName = hasValue(d.fullName)
    ? String(d.fullName).trim()
    : [d.firstName, d.lastName].filter(hasValue).join(' ').trim()

  const present = [fullName, d.certificateNumber, d.company, d.certificationBody].filter(hasValue).length
  return Object.freeze({
    fullName: fullName || null,
    certificateNumber: normalizeCertificateNumber(d.certificateNumber) || null,
    company: hasValue(d.company) ? String(d.company).trim() : null,
    certificationBody: hasValue(d.certificationBody) ? String(d.certificationBody).trim() : null,
    ademeDiagnosticianId: null,
    diagnosticDate: parsed?.diagnosticDate || null,
    sourceState: present ? 'ADEME_FULL_DPE' : 'IDENTITY_NOT_AVAILABLE_IN_FULL_DPE',
  })
}

export function resolveAuthorSource(row = {}, parsed = null) {
  const full = parsed ? extractAuthorFromFullDpe(parsed) : null
  if (full && full.sourceState === 'ADEME_FULL_DPE') return full
  return extractAuthorSource(row)
}

export function comparisonState(items, key){
  const vals=items.map(x=>x?.[key]).filter(hasValue).map(norm)
  if(!vals.length || vals.length !== items.length) return 'INDETERMINE'
  return new Set(vals).size === 1 ? 'CONVERGENCE' : 'DIVERGENCE'
}

export function compareAuthorRecords(items=[]){
  const source=items.map(x=>x?.sourceRecord || null)
  const verified=items.map(x=>x?.verifiedRecord || null)
  return Object.freeze([
    Object.freeze({key:'fullName',label:'Diagnostiqueur ADEME',status:comparisonState(source,'fullName'),values:source.map(x=>x?.fullName||null)}),
    Object.freeze({key:'company',label:'Société ADEME',status:comparisonState(source,'company'),values:source.map(x=>x?.company||null)}),
    Object.freeze({key:'certificateNumber',label:'N° certificat ADEME',status:comparisonState(source,'certificateNumber'),values:source.map(x=>x?.certificateNumber||null)}),
    Object.freeze({key:'certificationBody',label:'Organisme certificateur ADEME',status:comparisonState(source,'certificationBody'),values:source.map(x=>x?.certificationBody||null)}),
    Object.freeze({key:'validOnDiagnosticDate',label:'Certification MADI valide à la date du DPE',status:comparisonState(verified,'validOnDiagnosticDate'),values:verified.map(x=>x?.validOnDiagnosticDate ?? null)}),
  ])
}

export function describeAuthorVerificationCore(){
  return Object.freeze({
    contract:DPE_AUTHOR_VERIFICATION_CONTRACT,
    version:DPE_AUTHOR_VERIFICATION_VERSION,
    semanticLocks:Object.freeze([
      'CERTIFICATE_VALIDITY_IS_NOT_DPE_TECHNICAL_CORRECTNESS',
      'DIFFERENT_DIAGNOSTICIAN_IS_NOT_INDEPENDENT_OBSERVATION',
      'SAME_COMPANY_IS_NOT_SAME_AUTHOR',
      'MADI_MATCH_IS_NOT_PROOF_OF_DPE_AUTHORSHIP',
      'MISSING_OPEN_DATA_IDENTITY_IS_NOT_AUTHOR_ABSENCE',
      'FULL_DPE_IDENTITY_IS_ADEME_DECLARATION_NOT_MATERIAL_AUTHORSHIP_PROOF',
    ])
  })
}
