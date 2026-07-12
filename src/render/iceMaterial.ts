import { MeshPhysicalNodeMaterial } from 'three/webgpu'
import type { Object3D } from 'three'
import type { CanvasTexture } from 'three'
import {
  texture,
  uv,
  vec2,
  vec3,
  float,
  cameraPosition,
  positionWorld,
  normalWorld,
  reflector,
  textureBicubic,
} from 'three/tsl'

export interface IceMaterialResult {
  material: MeshPhysicalNodeMaterial
  // Must be added to the scene at the ice plane's position (y = 0).
  reflectionTarget: Object3D
}

// Layered glossy ice: painted markings in the albedo, skate scratches
// modulating roughness, clearcoat sheen, and a real-time planar reflection
// blurred by local scratch roughness and faded by fresnel.
export function createIceMaterial(paintTex: CanvasTexture, scratchTex: CanvasTexture): IceMaterialResult {
  const reflection = reflector({ resolutionScale: 0.5, generateMipmaps: true, bounces: false })
  reflection.target.rotateX(-Math.PI / 2)

  const scratch = texture(scratchTex, uv().mul(vec2(14, 6))).r

  const material = new MeshPhysicalNodeMaterial()
  material.roughnessNode = scratch.remapClamp(0, 1, 0.06, 0.42)
  material.metalness = 0
  material.clearcoat = 1
  material.clearcoatRoughness = 0.07
  material.envMapIntensity = 1.2

  // Grazing angles reflect strongly (fresnel), scuffed areas blur and dim.
  const viewDir = cameraPosition.sub(positionWorld).normalize()
  const fresnel = viewDir.dot(normalWorld).clamp(0, 1).oneMinus().pow(float(2.5))
  const glossMask = scratch.remapClamp(0, 1, 1, 0.5)
  const reflectivity = fresnel.mul(0.88).add(0.06).mul(glossMask)
  const blurred = textureBicubic(reflection, scratch.remapClamp(0, 1, 0.05, 0.5))

  // Energy-conserving blend: at grazing angles the mirrored scene replaces
  // the diffuse paint instead of merely adding to it — dark boards and
  // players must visibly reflect in the white ice.
  material.colorNode = texture(paintTex).mul(reflectivity.oneMinus())
  material.emissiveNode = blurred.rgb.mul(reflectivity)

  // `?ice=mirror` renders the raw reflection target (debug aid)
  if (new URLSearchParams(window.location.search).get('ice') === 'mirror') {
    material.colorNode = vec3(0)
    material.emissiveNode = reflection.rgb
  }

  return { material, reflectionTarget: reflection.target }
}
