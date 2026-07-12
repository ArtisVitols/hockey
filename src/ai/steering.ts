import type { PlayerIntent } from '../input/intent'
import type { SkaterBody } from '../physics/skaterBody'

// Seek with arrive: full speed far away, ease in close, stop at the target.
export function steerToward(
  intent: PlayerIntent,
  body: SkaterBody,
  tx: number,
  tz: number,
  sprint = false,
): void {
  const dx = tx - body.pos.x
  const dz = tz - body.pos.z
  const d = Math.hypot(dx, dz)
  if (d < 0.2) {
    intent.moveX = 0
    intent.moveZ = 0
    intent.sprint = false
    return
  }
  const scale = d < 2.5 ? d / 2.5 : 1
  intent.moveX = (dx / d) * scale
  intent.moveZ = (dz / d) * scale
  intent.sprint = sprint && d > 5
}

export function stop(intent: PlayerIntent): void {
  intent.moveX = 0
  intent.moveZ = 0
  intent.sprint = false
  intent.shootHeld = false
  intent.passPressed = false
}
