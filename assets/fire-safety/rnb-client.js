export const RNB_API_BASE='https://rnb-api.beta.gouv.fr/api/alpha'

export function normalizeRnbId(value){
  return String(value??'').trim().toUpperCase()
}

export function isValidRnbId(value){
  return /^[A-Z0-9]{12}$/.test(normalizeRnbId(value).replace(/-/g,'')) ||
    /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeRnbId(value))
}

function canonical(value){
  return normalizeRnbId(value).replace(/-/g,'')
}

export async function fetchRnbBuilding(rnbId){
  const id=canonical(rnbId)
  if(!isValidRnbId(id)) throw new Error('INVALID_RNB_ID')
  const response=await fetch(RNB_API_BASE+'/buildings/'+encodeURIComponent(id)+'/',{
    headers:{Accept:'application/json'},
    referrerPolicy:'no-referrer',
  })
  if(!response.ok) throw new Error('RNB_HTTP_'+response.status)
  return await response.json()
}

export function normalizeRnbBuilding(raw={}){
  const point=raw.point?.coordinates
  return Object.freeze({
    rnbId:raw.rnb_id||null,
    status:raw.status||null,
    isActive:raw.is_active ?? null,
    addresses:Object.freeze((raw.addresses||[]).map(a=>Object.freeze({
      banId:a.ban_id||null,
      interoperabilityId:a.id||null,
      streetNumber:a.street_number||null,
      streetRep:a.street_rep||null,
      street:a.street||null,
      city:a.city_name||null,
      postcode:a.city_zipcode||null,
      inseeCode:a.city_insee_code||null,
      source:a.source||null,
    }))),
    coordinates:Array.isArray(point)&&point.length>=2
      ? Object.freeze({longitude:Number(point[0]),latitude:Number(point[1])})
      : null,
    plots:Object.freeze((raw.plots||[]).map(p=>Object.freeze({
      id:p.id||null,
      buildingCoverRatio:p.bdg_cover_ratio ?? null,
    }))),
    externalIds:Object.freeze((raw.ext_ids||[]).map(x=>Object.freeze({
      id:x.id||null,source:x.source||null,sourceVersion:x.source_version||null,createdAt:x.created_at||null
    }))),
  })
}
