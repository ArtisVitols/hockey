import { RenderPipeline, type WebGPURenderer } from 'three/webgpu'
import type { Scene, Camera } from 'three'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

// Bloom tuned so light fixtures and glass glints glow, white ice does not.
export function createPostProcessing(renderer: WebGPURenderer, scene: Scene, camera: Camera): RenderPipeline {
  const post = new RenderPipeline(renderer)
  const scenePass = pass(scene, camera)
  const color = scenePass.getTextureNode()
  const bloomNode = bloom(color, 0.35, 0.3, 0.9)
  post.outputNode = color.add(bloomNode)
  return post
}
