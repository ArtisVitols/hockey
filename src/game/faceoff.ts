import { RINK, GOAL } from '../config'
import { boardsSDF, boardsNormal } from '../physics/geometry'
import type { SkaterBody } from '../physics/skaterBody'
import type { Role } from './teams'
import { SKATER_ROLES } from './teams'

export interface Dot {
  x: number
  z: number
}

export const CENTER_DOT: Dot = { x: 0, z: 0 }

export function neutralDot(xSide: 1 | -1, zSide: 1 | -1): Dot {
  return { x: xSide * RINK.neutralDotFromCenterX, z: zSide * RINK.dotY }
}

export function endZoneDot(xSide: 1 | -1, zSide: 1 | -1): Dot {
  return { x: xSide * RINK.endZoneDotFromCenterX, z: zSide * RINK.dotY }
}

export function zSideOf(z: number): 1 | -1 {
  return z >= 0 ? 1 : -1
}

// Faceoff formation around a dot for a team attacking toward `attackDir`.
// Positions are clamped inside the boards.
export function faceoffSlots(dot: Dot, attackDir: 1 | -1): Record<Exclude<Role, 'G'>, Dot> {
  const slots: Record<Exclude<Role, 'G'>, Dot> = {
    C: { x: dot.x - attackDir * 0.9, z: dot.z },
    LW: { x: dot.x - attackDir * 1.6, z: dot.z - 4.2 },
    RW: { x: dot.x - attackDir * 1.6, z: dot.z + 4.2 },
    D1: { x: dot.x - attackDir * 7.5, z: dot.z - 2.6 },
    D2: { x: dot.x - attackDir * 7.5, z: dot.z + 2.6 },
  }
  for (const role of SKATER_ROLES) {
    const s = slots[role as Exclude<Role, 'G'>]
    // keep clear of the boards
    const sd = boardsSDF(s.x, s.z)
    if (sd > -1.2) {
      const { nx, nz } = boardsNormal(s.x, s.z)
      s.x += nx * (sd + 1.2)
      s.z += nz * (sd + 1.2)
    }
  }
  return slots
}

export function creasePosition(defends: -1 | 1): Dot {
  return { x: defends * (GOAL.lineX - 0.9), z: 0 }
}

// Teleport a team into faceoff formation (setup phase).
export function placeTeam(
  skaters: SkaterBody[],
  goalie: SkaterBody,
  dot: Dot,
  attackDir: 1 | -1,
): void {
  const slots = faceoffSlots(dot, attackDir)
  SKATER_ROLES.forEach((role, i) => {
    const s = skaters[i]!
    const slot = slots[role as Exclude<Role, 'G'>]
    s.pos.set(slot.x, 0, slot.z)
    s.prevPos.copy(s.pos)
    s.vel.set(0, 0, 0)
    s.heading = attackDir > 0 ? 0 : Math.PI
  })
  const crease = creasePosition(attackDir > 0 ? -1 : 1)
  goalie.pos.set(crease.x, 0, crease.z)
  goalie.prevPos.copy(goalie.pos)
  goalie.vel.set(0, 0, 0)
  goalie.heading = attackDir > 0 ? 0 : Math.PI
}
