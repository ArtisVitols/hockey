import { GOAL } from '../config'
import type { World } from '../physics/world'
import type { SkaterBody } from '../physics/skaterBody'
import type { PlayerIntent } from '../input/intent'
import { steerToward, stop } from './steering'
import { decideCarrier, type Difficulty } from './skaterBrain'
import {
  teamState,
  roleTarget,
  repelTargets,
  circleTopAx,
  type SkaterRole,
  type TeamState,
  type Pt,
} from './positioning'

// Index order in `skaters` matches game/teams SKATER_ROLES: C, LW, RW, D1, D2.
const ROLES: SkaterRole[] = ['C', 'LW', 'RW', 'D1', 'D2']

// Team tactical brain: classifies the situation (offense / breakout /
// advance / defense / forecheck / neutral), sends every skater to his
// system position, and picks a role-appropriate puck pursuer.
export class TeamBrain {
  onShot: ((shooter: SkaterBody) => void) | null = null
  onPoke: ((poker: SkaterBody) => void) | null = null
  private decisionTimer = 0
  // per-skater delay between poke attempts (120 Hz steps would otherwise
  // strip every carrier the instant the cooldown expires)
  private pokeTimers = new Map<SkaterBody, number>()
  // sticky tactical state: passes in flight briefly have no owner, which
  // must not yo-yo the whole formation between systems
  private state: TeamState = 'neutral'
  private stateTimer = 0
  private rand: () => number

  constructor(
    private team: 0 | 1,
    private skaters: SkaterBody[],
    private world: World,
    private attackDirOf: () => 1 | -1,
    public diff: Difficulty,
    seed = 1,
  ) {
    let s = seed
    this.rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
  }

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
    const possessionTeam = ownerTeam === undefined ? null : ownerTeam
    const rawState = teamState(possessionTeam, this.team, puck.pos.x * a)

    // Loose-puck states (pass in flight, rebounds) must not yo-yo the
    // formation, so they need 0.7 s persistence. Gaining possession or
    // dropping into defense is unambiguous — switch immediately.
    const immediate =
      rawState === 'defense' || rawState === 'offense' || rawState === 'breakout' || rawState === 'advance'
    if (rawState === this.state) {
      this.stateTimer = 0
    } else if (immediate || (this.stateTimer += dt) > 0.7) {
      this.state = rawState
      this.stateTimer = 0
    }
    const state = this.state

    this.decisionTimer -= dt

    const chaser = this.pickChaser(state, a, excluded)

    // system positions for everyone, with anti-overlap
    const targets: Pt[] = this.skaters.map((_, idx) =>
      roleTarget(ROLES[idx]!, state, puck.pos.x, puck.pos.z, a),
    )
    repelTargets(targets)

    this.skaters.forEach((s, idx) => {
      if (s === excluded) return
      const intent = intents.get(s)
      if (!intent) return
      intent.shootHeld = false
      intent.passPressed = false

      if (owner === s) {
        this.driveCarrier(s, ROLES[idx]!, state, intent, a)
        return
      }

      if (chaser === s) {
        // pursue the puck; poke attempts are rate-limited per skater so
        // carriers get realistic time on the puck between challenges
        steerToward(intent, s, puck.pos.x + puck.vel.x * 0.25, puck.pos.z + puck.vel.z * 0.25, true)
        const pokeTimer = (this.pokeTimers.get(s) ?? 0) - dt
        this.pokeTimers.set(s, pokeTimer)
        if (owner && pokeTimer <= 0 && Math.hypot(puck.pos.x - s.pos.x, puck.pos.z - s.pos.z) < 1.5) {
          this.pokeTimers.set(s, 1.2 + this.rand() * 0.8)
          if (this.world.pokeCheck(s)) this.onPoke?.(s)
        }
        return
      }

      const t = targets[idx]!
      // sprint when out of position (harder during transitions so D reach
      // the points while the zone is still established)
      const far = Math.hypot(t.x - s.pos.x, t.z - s.pos.z) > (state === 'offense' ? 5 : 9)
      steerToward(intent, s, t.x, t.z, far)
    })
  }

  // Role-aware pursuit: forwards forecheck, D only pressure low in our zone,
  // nobody chases while we possess (nearest forward hunts loose rebounds).
  private pickChaser(state: TeamState, a: 1 | -1, excluded: SkaterBody | null): SkaterBody | null {
    const puck = this.world.puck
    const owner = this.world.possession.owner
    const wePossess = owner !== null && this.world.teamOf.get(owner!) === this.team

    const nearest = (indices: number[]): SkaterBody | null => {
      let best: SkaterBody | null = null
      let bestD = Infinity
      for (const i of indices) {
        const s = this.skaters[i]!
        if (s === excluded || s.stunTimer > 0) continue
        const d = Math.hypot(s.pos.x - puck.pos.x, s.pos.z - puck.pos.z)
        if (d < bestD) {
          bestD = d
          best = s
        }
      }
      return best
    }
    const FORWARDS = [0, 1, 2]
    const DEFENSE = [3, 4]

    if (wePossess) {
      // loose-rebound insurance only: no chaser while a teammate carries
      return null
    }

    switch (state) {
      case 'defense': {
        const puckAx = puck.pos.x * a
        if (puckAx < -circleTopAx()) {
          // deep in our zone: strong-side D pressures (roleTarget already
          // sends him to the puck); C is the extra man
          return nearest(DEFENSE)
        }
        return nearest([0]) ?? nearest(FORWARDS)
      }
      case 'forecheck':
      case 'neutral': {
        return nearest(FORWARDS)
      }
      default:
        return nearest(FORWARDS)
    }
  }

  private driveCarrier(
    carrier: SkaterBody,
    role: SkaterRole,
    state: TeamState,
    intent: PlayerIntent,
    a: 1 | -1,
  ): void {
    if (this.decisionTimer > 0) {
      // between decisions: keep flowing toward the net (forwards) or hold
      // the point (D in the offensive zone)
      if ((role === 'D1' || role === 'D2') && state === 'offense') {
        const t = roleTarget(role, 'offense', this.world.puck.pos.x, this.world.puck.pos.z, a)
        steerToward(intent, carrier, t.x, t.z, false)
      } else {
        steerToward(intent, carrier, a * GOAL.lineX * 0.85, carrier.pos.z * 0.5, true)
      }
      return
    }
    this.decisionTimer = this.diff.reaction

    const mates = this.skaters.filter((s) => s !== carrier)
    const opponents = this.world.skaters.filter((s) => {
      const t = this.world.teamOf.get(s)
      return t !== undefined && t !== this.team
    })
    const action = decideCarrier(carrier, role, state, mates, opponents, a, this.diff, this.rand)

    switch (action.kind) {
      case 'shoot':
        this.world.shoot(carrier, action.tx, action.tz, action.charge)
        this.onShot?.(carrier)
        break
      case 'pass': {
        const to = action.to
        this.world.pass(carrier, to.pos.x + to.vel.x * 0.35, to.pos.z + to.vel.z * 0.35)
        this.onShot?.(carrier)
        break
      }
      case 'carry':
        steerToward(intent, carrier, action.tx, action.tz, action.sprint)
        break
    }
  }
}
