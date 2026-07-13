import type { Puck } from './puck'
import type { SkaterBody } from './skaterBody'
import { PUCK } from '../config'

const PICKUP_RANGE = 1.0
// receivers can corral firm passes; only genuine shots stay uncatchable
const PICKUP_MAX_REL_SPEED = 19
const STICK_REACH = 1.05 // stick point ahead of the skater
const RELEASE_COOLDOWN = 0.35

// Stick-puck leash: while owned, the puck is spring-driven to a point ahead
// of the skater; pickups need proximity and a manageable closing speed.
export class Possession {
  owner: SkaterBody | null = null
  private cooldown = 0

  update(dt: number, puck: Puck, skaters: SkaterBody[], passTarget: SkaterBody | null = null): void {
    this.cooldown = Math.max(0, this.cooldown - dt)

    if (this.owner) {
      const o = this.owner
      const sx = o.pos.x + Math.cos(o.heading) * STICK_REACH
      const sz = o.pos.z + Math.sin(o.heading) * STICK_REACH
      // critically-damped pull toward the stick point
      const k = 18
      this.puckToStick(puck, sx, sz, k, dt)
      return
    }

    if (this.cooldown > 0 || puck.pos.y > 0.25) return
    // nearest eligible skater wins; random jitter breaks faceoff ties fairly
    let best: SkaterBody | null = null
    let bestD = Infinity
    for (const s of skaters) {
      // the intended pass receiver gets soft hands: bigger reach, higher
      // tolerated closing speed, and priority over incidental bystanders
      const isTarget = s === passTarget
      const range = isTarget ? 1.9 : PICKUP_RANGE
      const maxRel = isTarget ? 24 : PICKUP_MAX_REL_SPEED
      const dx = puck.pos.x - s.pos.x
      const dz = puck.pos.z - s.pos.z
      const d = Math.hypot(dx, dz)
      if (d > range + PUCK.radius) continue
      const relX = puck.vel.x - s.vel.x
      const relZ = puck.vel.z - s.vel.z
      if (Math.hypot(relX, relZ) > maxRel) continue
      const scored = d + (Math.random() - 0.5) * 0.3 - (isTarget ? 1.5 : 0)
      if (scored < bestD) {
        bestD = scored
        best = s
      }
    }
    if (best) this.owner = best
  }

  release(cooldown = RELEASE_COOLDOWN): void {
    this.owner = null
    this.cooldown = cooldown
  }

  private puckToStick(puck: Puck, sx: number, sz: number, k: number, dt: number): void {
    const dx = sx - puck.pos.x
    const dz = sz - puck.pos.z
    puck.vel.x = (dx * k) / (1 + k * dt)
    puck.vel.z = (dz * k) / (1 + k * dt)
    // cap so the puck can't teleport through walls
    const sp = Math.hypot(puck.vel.x, puck.vel.z)
    const cap = 18
    if (sp > cap) {
      puck.vel.x *= cap / sp
      puck.vel.z *= cap / sp
    }
  }
}
