import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

// Loads the rigged player mannequin. Returns null on failure so callers can
// fall back to the procedural player builder.
export async function loadPlayerModel(): Promise<GLTF | null> {
  try {
    return await new GLTFLoader().loadAsync('assets/models/xbot.glb')
  } catch (err) {
    console.warn('[assets] player model failed to load, using procedural fallback', err)
    return null
  }
}
