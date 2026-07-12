import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export interface CameraRig {
  camera: PerspectiveCamera
  controls: OrbitControls
}

export function createOrbitCamera(dom: HTMLElement): CameraRig {
  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300)
  camera.position.set(0, 16, 30)

  // `?cam=x,y,z` overrides the start position (debug/screenshot testing)
  const camParam = new URLSearchParams(window.location.search).get('cam')
  if (camParam) {
    const [x = 0, y = 16, z = 30] = camParam.split(',').map(Number)
    camera.position.set(x, y, z)
  }

  const controls = new OrbitControls(camera, dom)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = 1.52
  controls.minDistance = 2
  controls.maxDistance = 80
  controls.update()

  return { camera, controls }
}
