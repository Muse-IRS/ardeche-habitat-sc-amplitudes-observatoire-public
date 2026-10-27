import {
  FIRE_SAFETY_LAYERS,
  FIRE_SAFETY_STATES,
  createFireSafetyProfile,
  createSourceTrace,
  addSource,
  createObservation,
  addObservation,
  qualifyCompliance,
  sourceLayerSummary,
  exportFireSafetyProfile,
} from '../assets/fire-safety/core.js'
import {
  fetchRnbBuilding,
  normalizeRnbBuilding,
  normalizeRnbId,
  isValidRnbId,
} from '../assets/fire-safety/rnb-client.js'
import { FIRE_SAFETY_SOURCE_REGISTRY } from '../assets/fire-safety/source-registry.js'

const rnbForm=document.querySelector('#rnb-form')
const rnbInput=document.querySelector('#rnb-id')
const rnbStatus=document.querySelector('#rnb-status')
const buildingPanel=document.querySelector('#building-panel')
const buildingSummary=document.querySelector('#building-summary')
const sourceGrid=document.querySelector('#source-grid')
const evidencePanel=document.querySelector('#evidence-panel')
const evidenceForm=document.querySelector('#evidence-form')
const evidenceLayer=document.querySelector('#evidence-layer')
const evidenceDate=document.querySelector('#evidence-date')
const evidenceLabel=document.querySelector('#evidence-label')
const evidenceSubject=document.querySelector('#evidence-subject')
const evidenceStatement=document.querySelector('#evidence-statement')
const evidenceStatus=document.querySelector('#evidence-status')
const evidenceBody=document.querySelector('#evidence-body')
const statePanel=document.querySelector('#state-panel')
const stateSummary=document.querySelector('#state-summary')
const boundedClaim=document.querySelector('#bounded-claim')
const exportButton=document.querySelector('#export-profile')

let profile=null

function addDefinition(target,label,value){
  if(value===null||value===undefined||value==='') return
  const div=document.createElement('div')
  const dt=document.createElement('dt')
  const dd=document.createElement('dd')
  dt.textContent=label
  dd.textContent=String(value)
  div.append(dt,dd)
  target.append(div)
}

function renderSourceRegistry(){
  sourceGrid.innerHTML=''
  for(const source of FIRE_SAFETY_SOURCE_REGISTRY){
    const card=document.createElement('article')
    card.className='source-card'
    const h=document.createElement('h3')
    h.textContent=source.label
    const mode=document.createElement('p')
    mode.innerHTML='<strong>Mode :</strong> '+source.mode
    const scope=document.createElement('p')
    scope.textContent=source.scope
    const limit=document.createElement('p')
    limit.className='invariant'
    limit.textContent=source.limitation
    card.append(h,mode,scope,limit)
    if(source.url){
      const a=document.createElement('a')
      a.href=source.url
      a.target='_blank'
      a.rel='noopener noreferrer'
      a.textContent='Ouvrir la source →'
      card.append(a)
    }
    sourceGrid.append(card)
  }
}

function formatAddress(a){
  return [a.streetNumber,a.streetRep,a.street,a.postcode,a.city].filter(Boolean).join(' ')
}

function renderBuilding(building){
  buildingSummary.innerHTML=''
  addDefinition(buildingSummary,'ID-RNB',building.rnbId)
  addDefinition(buildingSummary,'Statut RNB',building.status)
  addDefinition(buildingSummary,'Actif dans le RNB',building.isActive===true?'Oui':building.isActive===false?'Non':'Indéterminé')
  addDefinition(buildingSummary,'Adresse(s)',building.addresses.map(formatAddress).filter(Boolean).join(' | '))
  addDefinition(buildingSummary,'Coordonnées',building.coordinates ? building.coordinates.latitude+', '+building.coordinates.longitude : null)
  addDefinition(buildingSummary,'Parcelles intersectées',building.plots.map(p=>p.id).filter(Boolean).join(' · '))
  addDefinition(buildingSummary,'Identifiants externes',building.externalIds.map(x=>[x.source,x.id].filter(Boolean).join(':')).filter(Boolean).join(' · '))
  buildingPanel.hidden=false
}

function renderEvidence(){
  evidenceBody.innerHTML=''
  for(const obs of profile?.observations||[]){
    const source=(profile.sources||[]).find(s=>s.id===obs.sourceId)
    const tr=document.createElement('tr')
    for(const value of [obs.layer,source?.label||'—',obs.subject||'—',obs.state,obs.observedAt||'—']){
      const td=document.createElement('td')
      td.textContent=String(value)
      tr.append(td)
    }
    evidenceBody.append(tr)
  }
}

function renderState(){
  if(!profile) return
  stateSummary.innerHTML=''
  const compliance=qualifyCompliance(profile)
  const layers=sourceLayerSummary(profile)
  addDefinition(stateSummary,'Actif',profile.asset.rnbId||profile.asset.id)
  addDefinition(stateSummary,'Conformité incendie globale',compliance.complianceStatus)
  addDefinition(stateSummary,'Sources enregistrées',profile.sources.length)
  addDefinition(stateSummary,'Observations / assertions',profile.observations.length)
  addDefinition(stateSummary,'Couches documentées',Object.values(layers).filter(x=>x.sourceCount>0).length)
  boundedClaim.textContent=compliance.boundedClaim
  statePanel.hidden=false
}

function createInitialProfile(building){
  let next=createFireSafetyProfile({
    assetId:'building:rnb:'+building.rnbId,
    rnbId:building.rnbId,
    label:building.addresses[0] ? formatAddress(building.addresses[0]) : 'Bâtiment '+building.rnbId,
    assetStatus:building.status,
    addresses:building.addresses,
    coordinates:building.coordinates,
  })

  next=addSource(next,createSourceTrace({
    id:'source:rnb:'+building.rnbId,
    layer:FIRE_SAFETY_LAYERS.ASSET_IDENTITY,
    sourceType:'RNB_PUBLIC_API',
    label:'RNB — '+building.rnbId,
    sourceUrl:'https://rnb.beta.gouv.fr/',
    observedAt:new Date().toISOString(),
    state:FIRE_SAFETY_STATES.ESTABLISHED,
    scope:'Identité et localisation du bâtiment uniquement.',
    attributes:{status:building.status,isActive:building.isActive},
  }))

  for(const item of FIRE_SAFETY_SOURCE_REGISTRY.filter(x=>x.id!=='RNB')){
    next=addSource(next,createSourceTrace({
      id:'source:registry:'+item.id,
      layer:item.layer,
      sourceType:item.id,
      label:item.label,
      sourceUrl:item.url,
      state:FIRE_SAFETY_STATES.NOT_SEARCHED,
      scope:item.scope,
      attributes:{mode:item.mode,limitation:item.limitation},
    }))
  }

  return next
}

rnbForm.addEventListener('submit',async event=>{
  event.preventDefault()
  const value=normalizeRnbId(rnbInput.value)
  rnbInput.value=value
  buildingPanel.hidden=true
  evidencePanel.hidden=true
  statePanel.hidden=true
  evidenceBody.innerHTML=''
  profile=null

  if(!isValidRnbId(value)){
    rnbStatus.textContent='ID-RNB non reconnu.'
    return
  }

  rnbStatus.textContent='Consultation de l’API publique RNB…'
  try{
    const raw=await fetchRnbBuilding(value)
    const building=normalizeRnbBuilding(raw)
    profile=createInitialProfile(building)
    renderBuilding(building)
    renderEvidence()
    renderState()
    evidencePanel.hidden=false
    rnbStatus.textContent='Bâtiment identifié. Aucune conclusion de sécurité incendie n’est déduite de cette identité.'
  }catch(error){
    console.error(error)
    rnbStatus.textContent='Le bâtiment n’a pas pu être récupéré depuis le RNB.'
  }
})

evidenceForm.addEventListener('submit',event=>{
  event.preventDefault()
  if(!profile) return

  const label=evidenceLabel.value.trim()
  const subject=evidenceSubject.value.trim()
  const statement=evidenceStatement.value.trim()
  if(!label||!subject||!statement){
    evidenceStatus.textContent='Renseigner le document/source, l’élément concerné et ce que la trace affirme.'
    return
  }

  const id='source:local:'+Date.now()
  profile=addSource(profile,createSourceTrace({
    id,
    layer:evidenceLayer.value,
    sourceType:'LOCAL_USER_PROVIDED_TRACE',
    label,
    observedAt:evidenceDate.value||null,
    state:FIRE_SAFETY_STATES.DECLARED,
    scope:'Trace locale ajoutée par le visiteur ; authenticité et portée matérielle non vérifiées automatiquement.',
  }))
  profile=addObservation(profile,createObservation({
    id:'observation:'+Date.now(),
    layer:evidenceLayer.value,
    subject,
    property:'DOCUMENTARY_STATEMENT',
    value:statement,
    observedAt:evidenceDate.value||null,
    sourceId:id,
    state:FIRE_SAFETY_STATES.DECLARED,
  }))

  evidenceForm.reset()
  renderEvidence()
  renderState()
  evidenceStatus.textContent='Trace ajoutée comme DÉCLARÉE. Elle n’établit pas automatiquement l’état matériel ni la conformité.'
})

exportButton.addEventListener('click',()=>{
  if(!profile) return
  const blob=new Blob([exportFireSafetyProfile(profile)],{type:'application/json;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download='carte-securite-incendie-rnb.json'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
})

renderSourceRegistry()
