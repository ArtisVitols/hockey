import { Raycaster, Plane, Vector3, Vector2, type Camera } from 'three'
import { emptyIntent, type PlayerIntent } from './intent'

// Player 1: WASD skating, mouse aim, LMB hold-to-charge shot, RMB/E pass,
// Shift sprint. Movement is rink-absolute (broadcast-camera convention).
export class KeyboardMouseInput {
  readonly intent: PlayerIntent = emptyIntent()
  // 0..1, grows while LMB held; consumed by the shot system on release
  shootCharge = 0
  private keys = new Set<string>()
  private raycaster = new Raycaster()
  private icePlane = new Plane(new Vector3(0, 1, 0), 0)
  private ndc = new Vector2()
  private hit = new Vector3()
  private mouseX = 0
  private mouseY = 0
  private passQueued = false

  constructor(private camera: Camera) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (e.code === 'KeyE') this.passQueued = true
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('pointermove', (e) => {
      this.mouseX = e.clientX
      this.mouseY = e.clientY
    })
    window.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.intent.shootHeld = true
      if (e.button === 2) this.passQueued = true
    })
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.intent.shootHeld = false
    })
    window.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.intent.shootHeld = false
    })
  }

  update(dt: number): void {
    const i = this.intent
    i.moveX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
    i.moveZ = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0)
    const len = Math.hypot(i.moveX, i.moveZ)
    if (len > 1) {
      i.moveX /= len
      i.moveZ /= len
    }
    i.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    i.passPressed = this.passQueued
    this.passQueued = false

    // charge while held (full charge after 0.8 s)
    this.shootCharge = i.shootHeld ? Math.min(1, this.shootCharge + dt / 0.8) : this.shootCharge

    // mouse ray → ice plane aim point
    this.ndc.set((this.mouseX / window.innerWidth) * 2 - 1, -(this.mouseY / window.innerHeight) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    if (this.raycaster.ray.intersectPlane(this.icePlane, this.hit)) {
      i.aimX = this.hit.x
      i.aimZ = this.hit.z
    }
  }

  consumeCharge(): number {
    const c = this.shootCharge
    this.shootCharge = 0
    return c
  }
}
