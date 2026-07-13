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
  // intended receiver of the pass in flight (route-running + catch assist)
  passTarget: SkaterBody | null = null
  private passTargetTimer = 0
  // running tally of targeted passes (test/tuning telemetry)
  readonly passStats = { attempts: 0, completed: 0, intercepted: 0, missed: 0 }
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

    // pass-target bookkeeping: expires by timer or on any pickup
    if (this.passTarget) {
      this.passTargetTimer -= dt
      if (this.passTargetTimer <= 0) {
        this.passTarget = null
        this.passStats.missed++
      }
    }
    this.possession.update(dt, this.puck, this.skaters, this.passTarget)
    if (this.possession.owner && this.passTarget) {
      if (this.possession.owner === this.passTarget) this.passStats.completed++
      else if (this.teamOf.get(this.possession.owner) !== this.teamOf.get(this.passTarget))
        this.passStats.intercepted++
      else this.passStats.completed++ // a different teammate corralled it
      this.passTarget = null
    }

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
    // scale pace to distance so the puck arrives catchable (ice friction
    // is low; a fixed-speed pass overshoots everything nearby)
    const dist = Math.hypot(aimX - this.puck.pos.x, aimZ - this.puck.pos.z)
    this.puck.shootToward(_aim, Math.min(17, 8 + dist * 0.6))
  }

  // Targeted pass: solves the intercept so puck and receiver arrive at the
  // same spot together, and marks the receiver so he runs the route and
  // gets a catch assist. Pass speed follows the same distance scaling.
  passTo(passer: SkaterBody, receiver: SkaterBody): void {
    if (this.possession.owner !== passer) return

    // fixed-point iteration: flight time depends on distance, distance on
    // the receiver's future position
    const px = this.puck.pos.x
    const pz = this.puck.pos.z
    let tx = receiver.pos.x
    let tz = receiver.pos.z
    let flight = 0
    for (let i = 0; i < 4; i++) {
      const dist = Math.hypot(tx - px, tz - pz)
      const speed = Math.min(17, 8 + dist * 0.6)
      // average speed over the glide ≈ launch − friction·t/2; keep simple
      flight = dist / Math.max(6, speed - (PUCK.friction * dist) / speed / 2)
      tx = receiver.pos.x + receiver.vel.x * flight
      tz = receiver.pos.z + receiver.vel.z * flight
    }

    this.recordRelease(passer)
    this.possession.release()
    _aim.set(tx, 0, tz)
    const dist = Math.hypot(tx - px, tz - pz)
    this.puck.shootToward(_aim, Math.min(17, 8 + dist * 0.6))
    this.passTarget = receiver
    this.passTargetTimer = flight + 1.2
    this.passStats.attempts++
  }

  // quick low snap shot: instant release, modest speed, slight lift
  wristShot(shooter: SkaterBody, aimX: number, aimZ: number): void {
    if (this.possession.owner !== shooter) return
    this.recordRelease(shooter)
    this.possession.release()
    _aim.set(aimX, 0, aimZ)
    this.puck.shootToward(_aim, 21)
    this.puck.vel.y = 1.2
  }

  // stick poke: knock the puck loose from a carrier ahead of the poker.
  // Returns true if the puck was stripped (for animation triggers).
  pokeCheck(poker: SkaterBody): boolean {
    if (poker.pokeCooldown > 0) return false
    poker.pokeCooldown = 0.8
    const owner = this.possession.owner
    if (!owner || owner === poker) return false
    if (this.teamOf.get(owner) === this.teamOf.get(poker)) return false
    const dx = this.puck.pos.x - poker.pos.x
    const dz = this.puck.pos.z - poker.pos.z
    const d = Math.hypot(dx, dz)
    if (d > 1.7) return false
    // must be roughly facing the puck
    const facing = (dx * Math.cos(poker.heading) + dz * Math.sin(poker.heading)) / (d || 1)
    if (facing < 0.25) return false
    this.possession.release(0.45)
    // knock the puck onward, away from the poker
    this.puck.vel.x = (dx / d) * 7
    this.puck.vel.z = (dz / d) * 7
    return true
  }

  // body check: shove the nearest opponent, stun them, strip the puck.
  // Returns the victim if a hit landed.
  bodyCheck(checker: SkaterBody): SkaterBody | null {
    if (checker.checkCooldown > 0) return null
    checker.checkCooldown = 1.2
    let victim: SkaterBody | null = null
    let bestD = 1.4
    for (const s of this.skaters) {
      if (s === checker || this.blockers.has(s)) continue
      if (this.teamOf.get(s) === this.teamOf.get(checker)) continue
      const d = Math.hypot(s.pos.x - checker.pos.x, s.pos.z - checker.pos.z)
      if (d < bestD) {
        bestD = d
        victim = s
      }
    }
    if (!victim) return null
    // long enough to play the full fall + get-up
    victim.stunTimer = 1.5
    victim.vel.x += Math.cos(checker.heading) * 5.5
    victim.vel.z += Math.sin(checker.heading) * 5.5
    // checker bleeds speed delivering the hit
    checker.vel.multiplyScalar(0.45)
    if (this.possession.owner === victim) this.possession.release(0.35)
    return victim
  }

  // quick lateral burst; the possession leash carries the puck along
  deke(carrier: SkaterBody, side: -1 | 1): void {
    if (carrier.dekeCooldown > 0) return
    carrier.dekeCooldown = 1
    // perpendicular to heading: heading rotated +90° is (-sin, +cos)
    carrier.vel.x += -Math.sin(carrier.heading) * side * 4.5
    carrier.vel.z += Math.cos(carrier.heading) * side * 4.5
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
