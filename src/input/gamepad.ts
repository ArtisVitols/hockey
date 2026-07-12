import { emptyIntent, type PlayerIntent } from './intent'
import type { SkaterBody } from '../physics/skaterBody'

const DEADZONE = 0.18

// Player 2 on a standard-mapping gamepad: left stick skates, right stick
// aims (relative to the controlled skater), RT/A charges shots, LB/X passes,
// L3 or LT sprints. Hot-plugs via the Gamepad API.
export class GamepadInput {
  readonly intent: PlayerIntent = emptyIntent()
  connected = false
  shootCharge = 0
  private prevPass = false

  update(dt: number, controlled: SkaterBody | null): void {
    const pads = navigator.getGamepads?.() ?? []
    let pad: Gamepad | null = null
    for (const p of pads) {
      if (p && p.mapping === 'standard') {
        pad = p
        break
      }
      if (p) pad = p
    }
    this.connected = !!pad
    const i = this.intent
    if (!pad) {
      i.moveX = 0
      i.moveZ = 0
      i.shootHeld = false
      i.passPressed = false
      return
    }

    const ax = (v: number) => (Math.abs(v) > DEADZONE ? v : 0)
    i.moveX = ax(pad.axes[0] ?? 0)
    i.moveZ = ax(pad.axes[1] ?? 0)

    // right stick sets the aim point ~9 m from the skater
    const rx = ax(pad.axes[2] ?? 0)
    const rz = ax(pad.axes[3] ?? 0)
    if (controlled && (rx !== 0 || rz !== 0)) {
      const len = Math.hypot(rx, rz)
      i.aimX = controlled.pos.x + (rx / len) * 9
      i.aimZ = controlled.pos.z + (rz / len) * 9
    } else if (controlled) {
      // default aim: straight ahead
      i.aimX = controlled.pos.x + Math.cos(controlled.heading) * 9
      i.aimZ = controlled.pos.z + Math.sin(controlled.heading) * 9
    }

    const rt = (pad.buttons[7]?.value ?? 0) > 0.4 || pad.buttons[0]?.pressed === true
    i.shootHeld = rt
    this.shootCharge = rt ? Math.min(1, this.shootCharge + dt / 0.8) : this.shootCharge

    const passNow = pad.buttons[4]?.pressed === true || pad.buttons[2]?.pressed === true
    i.passPressed = passNow && !this.prevPass
    this.prevPass = passNow

    i.sprint = pad.buttons[10]?.pressed === true || (pad.buttons[6]?.value ?? 0) > 0.4
  }

  consumeCharge(): number {
    const c = this.shootCharge
    this.shootCharge = 0
    return c
  }
}
