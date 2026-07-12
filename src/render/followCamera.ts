import { PerspectiveCamera, Vector3 } from 'three'

const OFFSET = new Vector3(0, 12.5, 17.5)
const _target = new Vector3()
const _desired = new Vector3()

// Broadcast-style camera: tracks a smoothed point between the controlled
// skater and the puck, always from the same side of the rink.
export class FollowCamera {
  readonly camera: PerspectiveCamera
  private focus = new Vector3()

  constructor() {
    this.camera = new PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300)
    this.camera.position.copy(OFFSET)
    this.camera.lookAt(0, 0, 0)
  }

  update(dt: number, skaterPos: Vector3, puckPos: Vector3): void {
    _target.copy(skaterPos).lerp(puckPos, 0.35)
    // keep the frame inside the rink ends
    _target.x = Math.max(-24, Math.min(24, _target.x))
    _target.y = 0

    const k = 1 - Math.exp(-3.2 * dt)
    this.focus.lerp(_target, k)

    _desired.copy(this.focus).add(OFFSET)
    this.camera.position.lerp(_desired, k)
    this.camera.lookAt(this.focus.x, 0.5, this.focus.z)
  }
}
