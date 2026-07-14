import { PerspectiveCamera, Vector3 } from 'three'

export type CameraMode = 'broadcast' | 'close' | 'vertical'
export const CAMERA_MODES: CameraMode[] = ['broadcast', 'close', 'vertical']

const _target = new Vector3()
const _desired = new Vector3()
const _offset = new Vector3()

// Follow camera with three selectable views:
//  broadcast — classic side-on TV framing between skater and puck
//  close     — tight on the controlled skater, lower and nearer
//  vertical  — NHL-PC up-ice view from behind the defended net at ~45°;
//              your net sits at the bottom of the screen, theirs at the top
export class FollowCamera {
  readonly camera: PerspectiveCamera
  mode: CameraMode = 'broadcast'
  private focus = new Vector3()

  constructor() {
    this.camera = new PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300)
    this.camera.position.set(0, 12.5, 17.5)
    this.camera.lookAt(0, 0, 0)
  }

  // yaw that maps screen-space input (up = away from camera) to world space;
  // broadcast/close look down -z so screen axes already match the rink
  viewYaw(defendSide: 1 | -1): number {
    if (this.mode !== 'vertical') return 0
    // camera sits at x = defendSide·D looking toward -defendSide·x, so
    // screen-right is -defendSide·z → rotate inputs by -defendSide·90°
    return -defendSide * (Math.PI / 2)
  }

  update(dt: number, skaterPos: Vector3, puckPos: Vector3, defendSide: 1 | -1): void {
    let smoothing = 3.2
    if (this.mode === 'close') {
      _target.copy(skaterPos).lerp(puckPos, 0.15)
      _target.x = Math.max(-27, Math.min(27, _target.x))
      _offset.set(0, 6.5, 9)
      smoothing = 4.5
    } else if (this.mode === 'vertical') {
      _target.copy(skaterPos).lerp(puckPos, 0.3)
      // keep both nets reachable in frame; don't chase into the corners
      _target.x = Math.max(-18, Math.min(18, _target.x))
      _target.z = Math.max(-10, Math.min(10, _target.z))
      // bias the frame up-ice so more of the attack is visible
      _target.x -= defendSide * 4
      _offset.set(defendSide * 16, 15, 0)
    } else {
      _target.copy(skaterPos).lerp(puckPos, 0.35)
      _target.x = Math.max(-24, Math.min(24, _target.x))
      _offset.set(0, 12.5, 17.5)
    }
    _target.y = 0

    const k = 1 - Math.exp(-smoothing * dt)
    this.focus.lerp(_target, k)

    _desired.copy(this.focus).add(_offset)
    this.camera.position.lerp(_desired, k)
    this.camera.lookAt(this.focus.x, 0.5, this.focus.z)
  }
}
