import { Vector3 } from 'three'
import { Puck } from './puck'
import { SkaterBody, SKATER_RADIUS } from './skaterBody'
import { Possession } from './possession'
import type { PlayerIntent } from '../input/intent'
import { GOAL, PUCK } from '../config'

export interface GoalEvent {
  // +1 = goal at +x end, -1 = goal at -x end
  side: 1 | -1
}

const _aim = new Vector3()

// Owns and steps every dynamic entity; detects goals via segment crossing of
// the goal line inside the frame.
export class World {
  readonly puck = new Puck()
  readonly skaters: SkaterBody[] = []
  readonly possession = new Possession()
  readonly intents = new Map<SkaterBody, PlayerIntent>()
  readonly teamOf = new Map<SkaterBody, 0 | 1>()
  // bodies that physically block the puck (goalies)
  readonly blockers = new Set<SkaterBody>()
  onGoal: ((e: GoalEvent) => void) | null = null
  // last team to touch the puck and where the touch/release happened
  lastTouchTeam: 0 | 1 | null = null
  lastTouchX = 0
  private prevOwner: SkaterBody | null = null
  private goalLatch = false

  addSkater(x: number, z: number): SkaterBody {
    const s = new SkaterBody()
    s.pos.set(x, 0, z)
    s.prevPos.copy(s.pos)
    this.skaters.push(s)
    return s
  }

  step(dt: number): void {
    for (const s of this.skaters) {
      const intent = this.intents.get(s)
      if (intent) s.step(dt, intent)
    }
    this.resolveSkaterCollisions()
    this.possession.update(dt, this.puck, this.skaters)

    // track touches for icing/offside attribution
    const owner = this.possession.owner
    if (owner && owner !== this.prevOwner) {
      const team = this.teamOf.get(owner)
      if (team !== undefined) {
        this.lastTouchTeam = team
        this.lastTouchX = this.puck.pos.x
      }
    }
    this.prevOwner = owner

    this.puck.step(dt)
    this.resolveBlockers()
    this.detectGoal()
  }

  // goalies stop pucks with their body: circle collision with damped rebound
  private resolveBlockers(): void {
    if (this.possession.owner && this.blockers.has(this.possession.owner)) return
    const p = this.puck
    if (p.pos.y > 1.15) return // over the shoulder
    const BLOCK_R = 0.45
    for (const g of this.blockers) {
      if (this.possession.owner === g) continue
      const dx = p.pos.x - g.pos.x
      const dz = p.pos.z - g.pos.z
      const d = Math.hypot(dx, dz)
      if (d < BLOCK_R && d > 1e-6) {
        const nx = dx / d
        const nz = dz / d
        p.pos.x = g.pos.x + nx * BLOCK_R
        p.pos.z = g.pos.z + nz * BLOCK_R
        const vn = p.vel.x * nx + p.vel.z * nz
        if (vn < 0) {
          p.vel.x = (p.vel.x - 1.6 * vn * nx) * 0.35
          p.vel.z = (p.vel.z - 1.6 * vn * nz) * 0.35
          p.vel.y = Math.min(p.vel.y, 0)
        }
        const team = this.teamOf.get(g)
        if (team !== undefined) {
          this.lastTouchTeam = team
          this.lastTouchX = p.pos.x
        }
      }
    }
  }

  shoot(shooter: SkaterBody, aimX: number, aimZ: number, charge: number): void {
    if (this.possession.owner !== shooter) return
    this.recordRelease(shooter)
    this.possession.release()
    _aim.set(aimX, 0, aimZ)
    const speed = 14 + charge * 22 // wrist flick → full slap shot
    this.puck.shootToward(_aim, speed)
    // raised shot: lift grows with charge
    this.puck.vel.y = charge * 4.2
  }

  pass(passer: SkaterBody, aimX: number, aimZ: number): void {
    if (this.possession.owner !== passer) return
    this.recordRelease(passer)
    this.possession.release()
    _aim.set(aimX, 0, aimZ)
    this.puck.shootToward(_aim, 16)
  }

  private recordRelease(skater: SkaterBody): void {
    const team = this.teamOf.get(skater)
    if (team !== undefined) {
      this.lastTouchTeam = team
      this.lastTouchX = this.puck.pos.x
    }
  }

  private resolveSkaterCollisions(): void {
    for (let i = 0; i < this.skaters.length; i++) {
      for (let j = i + 1; j < this.skaters.length; j++) {
        const a = this.skaters[i]!
        const b = this.skaters[j]!
        const dx = b.pos.x - a.pos.x
        const dz = b.pos.z - a.pos.z
        const d = Math.hypot(dx, dz)
        const minD = SKATER_RADIUS * 2
        if (d < minD && d > 1e-6) {
          const push = (minD - d) / 2
          const nx = dx / d
          const nz = dz / d
          a.pos.x -= nx * push
          a.pos.z -= nz * push
          b.pos.x += nx * push
          b.pos.z += nz * push
        }
      }
    }
  }

  private detectGoal(): void {
    const p = this.puck
    for (const side of [1, -1] as const) {
      const lineX = side * GOAL.lineX
      const before = side > 0 ? p.prevPos.x < lineX : p.prevPos.x > lineX
      const after = side > 0 ? p.pos.x >= lineX + PUCK.radius : p.pos.x <= lineX - PUCK.radius
      if (before && after && !this.goalLatch) {
        // interpolate z/y at the crossing
        const t = (lineX - p.prevPos.x) / (p.pos.x - p.prevPos.x)
        const z = p.prevPos.z + (p.pos.z - p.prevPos.z) * t
        const y = p.prevPos.y + (p.pos.y - p.prevPos.y) * t
        if (Math.abs(z) < GOAL.width / 2 - PUCK.radius && y < GOAL.height - PUCK.radius) {
          this.goalLatch = true
          this.onGoal?.({ side })
        }
      }
    }
  }

  placePuck(x: number, z: number): void {
    this.puck.pos.set(x, PUCK.height / 2, z)
    this.puck.prevPos.copy(this.puck.pos)
    this.puck.vel.set(0, 0, 0)
    this.possession.release(0.1)
    this.goalLatch = false
    this.lastTouchTeam = null
  }
}
