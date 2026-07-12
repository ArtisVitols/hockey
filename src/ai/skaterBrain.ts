import { GOAL } from '../config'
import type { World } from '../physics/world'
import type { SkaterBody } from '../physics/skaterBody'
import { pickOpenMate } from './targeting'

export interface Difficulty {
  // seconds between AI decisions (reaction time)
  reaction: number
  // radians of aim error on shots
  aimError: number
  // shot charge cap
  maxCharge: number
}

export const DIFFICULTIES: Record<string, Difficulty> = {
  easy: { reaction: 0.55, aimError: 0.16, maxCharge: 0.55 },
  medium: { reaction: 0.35, aimError: 0.09, maxCharge: 0.75 },
  hard: { reaction: 0.2, aimError: 0.04, maxCharge: 1 },
}

export type CarrierAction =
  | { kind: 'carry'; tx: number; tz: number }
  | { kind: 'shoot'; tx: number; tz: number; charge: number }
  | { kind: 'pass'; to: SkaterBody }

// Decides for the AI puck carrier: drive the net, shoot from range, or feed
// an open teammate when pressured.
export function decideCarrier(
  world: World,
  carrier: SkaterBody,
  mates: SkaterBody[],
  opponents: SkaterBody[],
  attackDir: 1 | -1,
  diff: Difficulty,
  rand: () => number,
): CarrierAction {
  const goalX = attackDir * GOAL.lineX
  const dxGoal = goalX - carrier.pos.x
  const distGoal = Math.hypot(dxGoal, carrier.pos.z)

  // shoot when in range with a lane
  if (distGoal < 13 && carrier.pos.x * attackDir > 2) {
    const err = (rand() * 2 - 1) * diff.aimError * distGoal
    const corner = rand() < 0.5 ? -0.75 : 0.75
    return {
      kind: 'shoot',
      tx: goalX,
      tz: corner + err,
      charge: Math.min(diff.maxCharge, 0.4 + rand() * 0.5),
    }
  }

  // pass when pressured and a teammate is open and not behind the play
  const pressure = opponents.some(
    (o) => Math.hypot(o.pos.x - carrier.pos.x, o.pos.z - carrier.pos.z) < 2.2,
  )
  if (pressure) {
    const best = pickOpenMate(carrier, mates, opponents, attackDir)
    if (best) return { kind: 'pass', to: best }
  }

  // otherwise carry toward the net, drifting to open ice
  return { kind: 'carry', tx: goalX * 0.85, tz: carrier.pos.z * 0.5 }
}
