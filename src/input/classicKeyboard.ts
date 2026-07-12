import { emptyIntent, type PlayerIntent } from './intent'

// Classic NHL 09 PC layout: Arrow keys skate; the A/S/D/W-Space cluster is
// context-sensitive (offense = puck on your controlled skater's stick):
//   Offense: S pass · D wrist shot · Space/W charge slap shot · A deke
//   Defense: S switch player · D poke check · Space/W body check
// E or Shift sprints. Aim points are resolved by the game (auto-aim), not
// by this class — it only reports intent flags.
export class ClassicKeyboardInput {
  readonly intent: PlayerIntent = emptyIntent()
  shootCharge = 0
  // one-frame manual switch request (defense S)
  switchRequested = false
  private keys = new Set<string>()
  private queued = new Set<string>()
  // possession state for context-sensitivity, updated by the game each frame
  hasPuck = false
  private lastDekeSide: -1 | 1 = 1

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      this.queued.add(e.code)
      // arrows scroll the page — not in this rink
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.intent.shootHeld = false
    })
  }

  update(dt: number): void {
    const i = this.intent
    i.moveX = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0)
    i.moveZ = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0)
    const len = Math.hypot(i.moveX, i.moveZ)
    if (len > 1) {
      i.moveX /= len
      i.moveZ /= len
    }
    i.sprint = this.keys.has('KeyE') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')

    // slap shot / body check share the charge key
    const chargeHeld = this.keys.has('Space') || this.keys.has('KeyW')
    i.passPressed = false
    i.wristShotPressed = false
    i.pokePressed = false
    i.checkPressed = false
    i.dekeDir = 0
    this.switchRequested = false

    if (this.hasPuck) {
      i.shootHeld = chargeHeld
      this.shootCharge = chargeHeld ? Math.min(1, this.shootCharge + dt / 0.8) : this.shootCharge
      if (this.queued.has('KeyS')) i.passPressed = true
      if (this.queued.has('KeyD')) i.wristShotPressed = true
      if (this.queued.has('KeyA')) {
        // alternate deke side, or follow held vertical arrow
        this.lastDekeSide = (this.lastDekeSide * -1) as -1 | 1
        if (this.keys.has('ArrowUp')) this.lastDekeSide = -1
        if (this.keys.has('ArrowDown')) this.lastDekeSide = 1
        i.dekeDir = this.lastDekeSide
      }
    } else {
      i.shootHeld = false
      this.shootCharge = 0
      if (this.queued.has('KeyS')) this.switchRequested = true
      if (this.queued.has('KeyD')) i.pokePressed = true
      if (this.queued.has('Space') || this.queued.has('KeyW')) i.checkPressed = true
    }

    this.queued.clear()
  }

  consumeCharge(): number {
    const c = this.shootCharge
    this.shootCharge = 0
    return c
  }

  // drop key presses queued while this scheme was inactive
  clearQueued(): void {
    this.queued.clear()
  }
}
