import { GOAL, RINK } from '../config'
import type { World } from '../physics/world'
import type { SkaterBody } from '../physics/skaterBody'
import { steerToward } from './steering'

// Crease positioning: hold a point on the arc between the goal center and
// the puck, square to the shot. Butterfly when a fast puck closes in.
export class GoalieBrain {
  saveTriggered = false
  // false = pulled: skate to the bench and stay there (empty net)
  enabled = true
  private butterflyLatch = 0
  private holdTimer = 0

  constructor(
    private goalie: SkaterBody,
    private world: World,
    private defendsOf: () => -1 | 1,
  ) {}

  update(dt: number, playing: boolean): void {
    const intent = this.world.intents.get(this.goalie)
    if (!intent) return
    this.saveTriggered = false

    const d = this.defendsOf()
    const goalX = d * GOAL.lineX
    const puck = this.world.puck

    if (!this.enabled) {
      // pulled: head for the bench gate at center ice
      steerToward(intent, this.goalie, d * 2.5, RINK.halfWidth - 1.4, true)
      return
    }

    // caught it: hold briefly, then clear up the boards
    if (this.world.possession.owner === this.goalie) {
      this.holdTimer += dt
      if (this.holdTimer > 0.6) {
        this.holdTimer = 0
        const side = this.goalie.pos.z >= 0 ? 1 : -1
        this.world.pass(this.goalie, -d * 5, side * 10)
      }
      return
    }
    this.holdTimer = 0

    if (!playing) {
      steerToward(intent, this.goalie, d * (GOAL.lineX - 0.9), 0)
      return
    }

    // arc point: from goal center toward the puck, ~1 m out, clamped to the
    // crease width and never behind the goal line
    const dx = puck.pos.x - goalX
    const dz = puck.pos.z
    const len = Math.hypot(dx, dz) || 1
    let tx = goalX + (dx / len) * 0.8
    let tz = (dz / len) * 0.8
    tz = Math.max(-1.1, Math.min(1.1, tz))
    if ((tx - goalX) * d > -0.15) tx = goalX - d * 0.15
    steerToward(intent, this.goalie, tx, tz)

    // face the puck
    this.goalie.heading = Math.atan2(puck.pos.z - this.goalie.pos.z, puck.pos.x - this.goalie.pos.x)

    // butterfly on incoming shots
    this.butterflyLatch -= dt
    const puckSpeed = Math.hypot(puck.vel.x, puck.vel.z)
    const dist = Math.hypot(puck.pos.x - this.goalie.pos.x, puck.pos.z - this.goalie.pos.z)
    const incoming = puck.vel.x * d > 4 // x-velocity toward the defended goal
    if (dist < 7 && puckSpeed > 12 && incoming && this.butterflyLatch <= 0) {
      this.butterflyLatch = 1.2
      this.saveTriggered = true
    }
  }
}
