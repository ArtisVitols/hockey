import { GOAL } from '../config'
import type { SkaterBody } from '../physics/skaterBody'

// Far-corner shot target: shooters aim across the goalie to the corner
// opposite their side of the ice.
export function autoShotTarget(shooter: SkaterBody, attackDir: 1 | -1): { x: number; z: number } {
  const corner = shooter.pos.z >= 0 ? -0.7 : 0.7
  return { x: attackDir * GOAL.lineX, z: corner }
}

// Most-open teammate biased toward the attack. Shared by the AI carrier
// brain and the classic control scheme's auto-pass.
export function pickOpenMate(
  carrier: SkaterBody,
  mates: readonly SkaterBody[],
  opponents: readonly SkaterBody[],
  attackDir: 1 | -1,
  minOpenness = 2.5,
): SkaterBody | null {
  let best: SkaterBody | null = null
  let bestScore = -Infinity
  for (const m of mates) {
    if (m === carrier) continue
    const ahead = (m.pos.x - carrier.pos.x) * attackDir
    const nearestOpp = Math.min(
      ...opponents.map((o) => Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z)),
    )
    const score = ahead + nearestOpp * 1.5
    if (nearestOpp > minOpenness && score > bestScore) {
      best = m
      bestScore = score
    }
  }
  return best
}

// Pass aim point for a chosen receiver, led by their velocity.
export function leadPoint(receiver: SkaterBody): { x: number; z: number } {
  return { x: receiver.pos.x + receiver.vel.x * 0.35, z: receiver.pos.z + receiver.vel.z * 0.35 }
}
