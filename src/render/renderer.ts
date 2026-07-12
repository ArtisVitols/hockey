import { WebGPURenderer } from 'three/webgpu'
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three'

export async function createRenderer(container: HTMLElement, forceWebGL: boolean): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  await renderer.init()
  container.appendChild(renderer.domElement)
  return renderer
}

export function backendName(renderer: WebGPURenderer): string {
  const backend = renderer.backend as { isWebGPUBackend?: boolean }
  return backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'
}
