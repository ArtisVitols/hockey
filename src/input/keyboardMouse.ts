import { Raycaster, Plane, Vector3, Vector2, type Camera } from 'three'
import { emptyIntent, type PlayerIntent } from './intent'

// Player 1: WASD skating, mouse aim, LMB hold-to-charge slap shot (a quick
// tap is a wrist shot), RMB/E pass, F poke check, Space body check, Q deke,
// Shift sprint. Movement is rink-absolute (broadcast-camera convention).
export class KeyboardMouseInput {
  readonly intent: PlayerIntent = emptyIntent()
  // 0..1, grows while LMB held; consumed by the shot system on release
  shootCharge = 0
  // true when the last LMB release was a quick tap (< 0.2 s)
  private heldTime = 0
  wasTap = false
  private keys = new Set<string>()
  private queued = new Set<string>()
  private raycaster = new Raycaster()
  private icePlane = new Plane(new Vector3(0, 1, 0), 0)
  private ndc = new Vector2()
  private hit = new Vector3()
  private mouseX = 0
  private mouseY = 0
  private passQueued = false

  constructor(private camera: Camera) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      this.queued.add(e.code)
      if (e.code === 'KeyE') this.passQueued = true
      if (e.code === 'Space') e.preventDefault()
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

    // action keys (one-frame triggers)
    i.pokePressed = this.queued.has('KeyF')
    i.checkPressed = this.queued.has('Space')
    i.dekeDir = this.queued.has('KeyQ') ? (i.moveZ < 0 ? -1 : 1) : 0
    this.queued.clear()

    // charge while held (full charge after 0.8 s); track hold time so a
    // quick tap can fire a wrist shot instead of a feeble slap shot
    if (i.shootHeld) {
      this.heldTime += dt
      this.shootCharge = Math.min(1, this.shootCharge + dt / 0.8)
    } else {
      this.wasTap = this.heldTime > 0 && this.heldTime < 0.2
      this.heldTime = 0
    }

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
