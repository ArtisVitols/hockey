import type { SkaterBody } from '../physics/skaterBody'
import type { World } from '../physics/world'

// Chooses which skater the human controls: the team possessor if any,
// otherwise the nearest teammate to the puck (with hysteresis so control
// doesn't flicker between two equidistant skaters).
export class PlayerSwitcher {
  current: SkaterBody

  constructor(private team: SkaterBody[]) {
    this.current = team[0]!
  }

  update(world: World): SkaterBody {
    const owner = world.possession.owner
    if (owner && this.team.includes(owner)) {
      this.current = owner
      return this.current
    }
    const puck = world.puck.pos
    let best = this.current
    let bestD = dist(this.current, puck.x, puck.z) * 0.82 // hysteresis bias
    for (const s of this.team) {
      const d = dist(s, puck.x, puck.z)
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    this.current = best
    return best
  }
}

function dist(s: SkaterBody, x: number, z: number): number {
  return Math.hypot(s.pos.x - x, s.pos.z - z)
}
