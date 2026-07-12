import { RINK, GOAL } from '../config'
import type { World } from '../physics/world'
import type { SkaterBody } from '../physics/skaterBody'
import type { PlayerIntent } from '../input/intent'
import { steerToward, stop } from './steering'
import { decideCarrier, type Difficulty } from './skaterBrain'

// Per-team tactical layer: assigns one chaser, keeps everyone else in
// role-appropriate support/defensive spots, and drives the carrier's
// shoot/pass/carry decisions. Writes into the shared PlayerIntent objects.
export class TeamBrain {
  onShot: ((shooter: SkaterBody) => void) | null = null
  onPoke: ((poker: SkaterBody) => void) | null = null
  private decisionTimer = 0
  private rand: () => number

  constructor(
    private team: 0 | 1,
    private skaters: SkaterBody[],
    private world: World,
    private attackDirOf: () => 1 | -1,
    public diff: Difficulty,
    seed = 1,
  ) {
    // deterministic PRNG so headless runs reproduce
    let s = seed
    this.rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
  }

  // `excluded` = the human-controlled skater (brain must not touch it)
  update(dt: number, playing: boolean, excluded: SkaterBody | null): void {
    const intents = this.world.intents
    if (!playing) {
      for (const s of this.skaters) {
        if (s === excluded) continue
        const i = intents.get(s)
        if (i) stop(i)
      }
      return
    }

    const a = this.attackDirOf()
    const puck = this.world.puck
    const owner = this.world.possession.owner
    const ownerTeam = owner ? this.world.teamOf.get(owner) : undefined
    const wePossess = ownerTeam === this.team
    const opponents = this.world.skaters.filter(
      (s) => this.world.teamOf.get(s) !== undefined && this.world.teamOf.get(s) !== this.team,
    )

    this.decisionTimer -= dt

    // one chaser: nearest non-excluded skater to the puck
    let chaser: SkaterBody | null = null
    if (!wePossess) {
      let bestD = Infinity
      for (const s of this.skaters) {
        if (s === excluded) continue
        const d = Math.hypot(s.pos.x - puck.pos.x, s.pos.z - puck.pos.z)
        if (d < bestD) {
          bestD = d
          chaser = s
        }
      }
    }

    this.skaters.forEach((s, idx) => {
      if (s === excluded) return
      const intent = intents.get(s)
      if (!intent) return
      intent.shootHeld = false
      intent.passPressed = false

      if (owner === s) {
        this.driveCarrier(s, intent, a)
        return
      }

      if (chaser === s) {
        // pursue the puck (lead it slightly by its velocity)
        steerToward(intent, s, puck.pos.x + puck.vel.x * 0.25, puck.pos.z + puck.vel.z * 0.25, true)
        // poke at a carrier in reach (world validates range/cooldown/facing)
        if (owner && Math.hypot(puck.pos.x - s.pos.x, puck.pos.z - s.pos.z) < 1.6) {
          if (this.world.pokeCheck(s)) this.onPoke?.(s)
        }
        return
      }

      const spot = wePossess
        ? this.offenseSpot(idx, a)
        : this.defenseSpot(idx, a)
      steerToward(intent, s, spot.x, spot.z, false)
    })
  }

  private driveCarrier(carrier: SkaterBody, intent: PlayerIntent, a: 1 | -1): void {
    if (this.decisionTimer > 0) {
      // between decisions: keep skating toward the net
      steerToward(intent, carrier, a * GOAL.lineX * 0.85, carrier.pos.z * 0.5, true)
      return
    }
    this.decisionTimer = this.diff.reaction

    const mates = this.skaters.filter((s) => s !== carrier)
    const opponents = this.world.skaters.filter((s) => {
      const t = this.world.teamOf.get(s)
      return t !== undefined && t !== this.team
    })
    const action = decideCarrier(this.world, carrier, mates, opponents, a, this.diff, this.rand)

    switch (action.kind) {
      case 'shoot':
        this.world.shoot(carrier, action.tx, action.tz, action.charge)
        this.onShot?.(carrier)
        break
      case 'pass': {
        // lead the receiver
        const to = action.to
        this.world.pass(carrier, to.pos.x + to.vel.x * 0.35, to.pos.z + to.vel.z * 0.35)
        this.onShot?.(carrier)
        break
      }
      case 'carry':
        steerToward(intent, carrier, action.tx, action.tz, true)
        break
    }
  }

  // forward-coordinate helpers: ax = x·a grows toward the attacked goal
  private offenseSpot(idx: number, a: 1 | -1): { x: number; z: number } {
    const puckAx = this.world.puck.pos.x * a
    const blue = RINK.blueLineFromCenter
    // wings flank high, D hold the points, others support center
    const wing = idx === 1 || idx === 2
    const dman = idx === 3 || idx === 4
    let ax: number
    let z: number
    if (wing) {
      ax = Math.min(puckAx + 5, 24)
      z = idx === 1 ? -5.6 : 5.6
    } else if (dman) {
      ax = Math.max(Math.min(puckAx - 7, blue + 1.5), -18)
      z = idx === 3 ? -3 : 3
    } else {
      ax = Math.min(puckAx + 2, 20)
      z = this.world.puck.pos.z * 0.4
    }
    // offside guard: never precede the puck into the zone
    if (puckAx < blue) ax = Math.min(ax, blue - 0.6)
    return { x: ax * a, z }
  }

  private defenseSpot(idx: number, a: 1 | -1): { x: number; z: number } {
    const puck = this.world.puck.pos
    const ownGoalX = -a * GOAL.lineX
    // stand on the puck→goal line, staggered by role
    const dx = ownGoalX - puck.x
    const dz = -puck.z
    const len = Math.hypot(dx, dz) || 1
    const depth = idx === 3 || idx === 4 ? 0.45 : 0.25
    const lateral = [0, -3.5, 3.5, -1.4, 1.4][idx] ?? 0
    return {
      x: puck.x + dx * depth,
      z: puck.z + dz * depth + lateral,
    }
  }
}
