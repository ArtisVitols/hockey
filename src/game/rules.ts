import { RINK, GOAL } from '../config'
import type { World } from '../physics/world'
import { SKATER_RADIUS, type SkaterBody } from '../physics/skaterBody'
import { neutralDot, endZoneDot, zSideOf, type Dot } from './faceoff'

export type StoppageReason = 'offside' | 'icing'

export interface Stoppage {
  reason: StoppageReason
  dot: Dot
  againstTeam: 0 | 1
}

// Watches puck line-crossings each step for offside and icing.
// attackDirOf(team) → +1 if that team attacks the +x goal this period.
export class Rules {
  private prevPuckX = 0

  constructor(
    private world: World,
    private teamSkaters: [ReadonlyArray<SkaterBody>, ReadonlyArray<SkaterBody>],
    private attackDirOf: (team: 0 | 1) => 1 | -1,
  ) {}

  reset(): void {
    this.prevPuckX = this.world.puck.pos.x
  }

  check(): Stoppage | null {
    const puck = this.world.puck
    const prevX = this.prevPuckX
    const curX = puck.pos.x
    this.prevPuckX = curX
    const touch = this.world.lastTouchTeam
    if (touch === null) return null

    const a = this.attackDirOf(touch)
    const blue = RINK.blueLineFromCenter

    // ---- offside: puck enters the attacking zone while a teammate is
    // already across the blue line
    const crossedIn = prevX * a <= blue && curX * a > blue
    if (crossedIn) {
      for (const s of this.teamSkaters[touch]) {
        if (s === this.world.possession.owner) continue
        if (s.pos.x * a > blue + SKATER_RADIUS) {
          return {
            reason: 'offside',
            dot: neutralDot((a > 0 ? 1 : -1), zSideOf(puck.pos.z)),
            againstTeam: touch,
          }
        }
      }
    }

    // ---- icing: released from behind center, crosses the far goal line
    // outside the goal frame, untouched (unowned)
    if (this.world.possession.owner === null) {
      const goalLine = GOAL.lineX
      const crossedGoalLine = prevX * a < goalLine && curX * a >= goalLine
      const outsideFrame = Math.abs(puck.pos.z) > GOAL.width / 2
      const fromBehindCenter = this.world.lastTouchX * a < 0
      if (crossedGoalLine && outsideFrame && fromBehindCenter) {
        return {
          reason: 'icing',
          dot: endZoneDot((a > 0 ? -1 : 1), zSideOf(puck.pos.z)),
          againstTeam: touch,
        }
      }
    }

    return null
  }
}
