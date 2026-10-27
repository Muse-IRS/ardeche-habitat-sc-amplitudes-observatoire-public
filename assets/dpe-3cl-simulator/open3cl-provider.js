export const OPEN3CL_PROVIDER_VERSION = '0.1.0'
export const OPEN3CL_ENGINE_VERSION = '1.9.1'
export const OPEN3CL_ESM_URL = 'https://cdn.jsdelivr.net/npm/@open3cl/engine@1.9.1/+esm'

let enginePromise = null

export async function loadOpen3cl() {
  if (!enginePromise) {
    enginePromise = import(OPEN3CL_ESM_URL).then(module => {
      if (typeof module.calcul_3cl !== 'function' || typeof module.calcul_3cl_xml !== 'function') {
        throw new Error('OPEN3CL_API_UNEXPECTED')
      }
      return module
    })
  }
  return enginePromise
}

export async function calculateFromSource(source) {
  const engine = await loadOpen3cl()
  let input
  let calculated

  if (source.kind === 'xml') {
    input = source.text
    calculated = engine.calcul_3cl_xml(source.text)
  } else if (source.kind === 'json') {
    input = JSON.parse(source.text)
    calculated = engine.calcul_3cl(input)
  } else {
    throw new Error('UNSUPPORTED_SOURCE_KIND')
  }

  return Object.freeze({
    engineVersion: typeof engine.getVersion === 'function' ? engine.getVersion() : OPEN3CL_ENGINE_VERSION,
    input,
    calculated,
  })
}

export async function calculateScenario(dpeObject) {
  const engine = await loadOpen3cl()
  return Object.freeze({
    engineVersion: typeof engine.getVersion === 'function' ? engine.getVersion() : OPEN3CL_ENGINE_VERSION,
    calculated: engine.calcul_3cl(dpeObject),
  })
}
