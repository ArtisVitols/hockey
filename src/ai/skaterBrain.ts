import { GOAL, RINK } from '../config'
import type { SkaterBody } from '../physics/skaterBody'
import { pickOpenMate } from './targeting'
import { circleTopAx, type SkaterRole, type TeamState } from './positioning'

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
  | { kind: 'carry'; tx: number; tz: number; sprint: boolean }
  | { kind: 'shoot'; tx: number; tz: number; charge: number }
  | { kind: 'pass'; to: SkaterBody }

// Role- and zone-aware carrier decisions:
// - forwards shoot from the slot, cycle low-to-high under pressure
// - point D take low-charge shots only with a lane, and never walk in deep
// - breakout carriers move it to the half-wall wingers / swinging C
// - D hand the puck to forwards approaching the offensive blue line
export function decideCarrier(
  carrier: SkaterBody,
  role: SkaterRole,
  state: TeamState,
  mates: SkaterBody[],
  opponents: SkaterBody[],
  attackDir: 1 | -1,
  diff: Difficulty,
  rand: () => number,
): CarrierAction {
  const a = attackDir
  const goalX = a * GOAL.lineX
  const ax = carrier.pos.x * a
  const dxGoal = goalX - carrier.pos.x
  const distGoal = Math.hypot(dxGoal, carrier.pos.z)
  const isD = role === 'D1' || role === 'D2'
  const pressured = opponents.some(
    (o) => o.stunTimer <= 0 && Math.hypot(o.pos.x - carrier.pos.x, o.pos.z - carrier.pos.z) < 2.4,
  )

  // ---- shooting (slot shots are gated so cycles can develop; point-blank
  // chances always release)
  const inSlot = distGoal < 11 && Math.abs(carrier.pos.z) < 4.5
  const pointBlank = distGoal < 7
  if (!isD && (pointBlank || (inSlot && rand() < 0.8)) && ax > RINK.blueLineFromCenter - 2) {
    const err = (rand() * 2 - 1) * diff.aimError * distGoal
    const corner = rand() < 0.5 ? -0.75 : 0.75
    return {
      kind: 'shoot',
      tx: goalX,
      tz: corner + err,
      charge: Math.min(diff.maxCharge, pointBlank ? 0.35 + rand() * 0.3 : 0.5 + rand() * 0.4),
    }
  }
  // point shot: D in the o-zone with a clear lane to the net
  if (isD && state === 'offense') {
    const laneBlocked = opponents.some((o) => {
      // rough lane test: opponent within 1.2 m of the carrier→goal segment
      const t =
        ((o.pos.x - carrier.pos.x) * dxGoal + (o.pos.z - carrier.pos.z) * -carrier.pos.z) /
        (distGoal * distGoal || 1)
      if (t < 0.05 || t > 0.9) return false
      const px = carrier.pos.x + dxGoal * t
      const pz = carrier.pos.z + -carrier.pos.z * t
      return Math.hypot(o.pos.x - px, o.pos.z - pz) < 1.2
    })
    if (!laneBlocked && rand() < 0.55) {
      const err = (rand() * 2 - 1) * diff.aimError * distGoal
      return {
        kind: 'shoot',
        tx: goalX,
        tz: (rand() < 0.5 ? -0.6 : 0.6) + err,
        charge: Math.min(diff.maxCharge, 0.45 + rand() * 0.3),
      }
    }
    // no lane: feed the triangle (bias toward forwards low/slot)
    const target = pickOpenMate(carrier, mates, opponents, a, 2)
    if (target) return { kind: 'pass', to: target }
    // walk the line instead of driving in
    return { kind: 'carry', tx: a * (RINK.blueLineFromCenter - 1) * 1, tz: -carrier.pos.z * 0.4, sprint: false }
  }

  // ---- breakout: first look is always the outlet pass
  if (state === 'breakout') {
    const outlet = pickOpenMate(carrier, mates, opponents, a, pressured ? 1.5 : 2.5)
    if (outlet && (pressured || rand() < 0.75)) return { kind: 'pass', to: outlet }
    // skate it out up the boards
    const side = carrier.pos.z >= 0 ? 1 : -1
    return { kind: 'carry', tx: a * -2, tz: side * (RINK.halfWidth - 4), sprint: !pressured }
  }

  // ---- D advancing through neutral ice: hand off near the blue line
  if (isD && ax > RINK.blueLineFromCenter - 4) {
    const fwd = pickOpenMate(carrier, mates, opponents, a, 2)
    if (fwd) return { kind: 'pass', to: fwd }
  }

  // ---- pressured anywhere: move it
  if (pressured) {
    const best = pickOpenMate(carrier, mates, opponents, a, 2.5)
    if (best) return { kind: 'pass', to: best }
  }

  // ---- otherwise carry: forwards drive wide then cut, D advance carefully
  if (isD) {
    return { kind: 'carry', tx: carrier.pos.x + a * 6, tz: carrier.pos.z * 0.7, sprint: false }
  }
  const wide = Math.abs(carrier.pos.z) > 4 ? carrier.pos.z * 0.75 : carrier.pos.z * 0.5
  return { kind: 'carry', tx: goalX * 0.85, tz: ax > circleTopAx() ? carrier.pos.z * 0.3 : wide, sprint: true }
}
