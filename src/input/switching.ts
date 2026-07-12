import type { SkaterBody } from '../physics/skaterBody'
import type { World } from '../physics/world'

// Chooses which skater the human controls: the team possessor if any,
// otherwise the nearest teammate to the puck (with hysteresis so control
// doesn't flicker between two equidistant skaters).
export class PlayerSwitcher {
  current: SkaterBody
  // manual selection stays pinned briefly so auto logic doesn't undo it
  private pinTimer = 0

  constructor(private team: SkaterBody[]) {
    this.current = team[0]!
  }

  update(world: World, dt = 0): SkaterBody {
    this.pinTimer = Math.max(0, this.pinTimer - dt)
    const owner = world.possession.owner
    if (owner && this.team.includes(owner)) {
      this.current = owner
      this.pinTimer = 0
      return this.current
    }
    if (this.pinTimer > 0) return this.current
    const puck = world.puck.pos
    let best = this.current
    // strong hysteresis: a teammate must be substantially closer to steal
    // control, so deliberate skating isn't interrupted mid-stride
    let bestD = dist(this.current, puck.x, puck.z) * 0.55
    for (const s of this.team) {
      if (s === this.current) continue
      const d = dist(s, puck.x, puck.z)
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    if (best !== this.current) {
      this.current = best
      this.pinTimer = 1.0 // cooldown so control doesn't ping-pong
    }
    return this.current
  }

  // manual switch (classic S): next-closest teammate to the puck
  requestSwitch(world: World): SkaterBody {
    const puck = world.puck.pos
    let best: SkaterBody | null = null
    let bestD = Infinity
    for (const s of this.team) {
      if (s === this.current) continue
      const d = dist(s, puck.x, puck.z)
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    if (best) {
      this.current = best
      this.pinTimer = 1.5
    }
    return this.current
  }
}

function dist(s: SkaterBody, x: number, z: number): number {
  return Math.hypot(s.pos.x - x, s.pos.z - z)
}
