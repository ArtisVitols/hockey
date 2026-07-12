import type { ProceduralPlayerColors } from '../players/proceduralPlayer'
import { GOAL } from '../config'

export type Role = 'C' | 'LW' | 'RW' | 'D1' | 'D2' | 'G'

export interface TeamDef {
  name: string
  colors: ProceduralPlayerColors
  // -1 defends the -x goal, +1 defends the +x goal
  defends: -1 | 1
}

export const TEAMS: [TeamDef, TeamDef] = [
  {
    name: 'GLACIER',
    colors: { jersey: 0x0a3a7c, pants: 0x11214d, accent: 0xc8d2e0, skin: 0xd9a37e },
    defends: -1,
  },
  {
    name: 'NORTHBANK',
    colors: { jersey: 0xb01020, pants: 0x1c1014, accent: 0xe0c8c8, skin: 0xc98f6a },
    defends: 1,
  },
]

// Center-ice faceoff lineup, in the frame of a team defending the -x goal.
// [x, z] pairs; mirrored via defends for the other side.
const LINEUP: Record<Role, [number, number]> = {
  C: [-1.1, 0],
  LW: [-1.8, -6.7],
  RW: [-1.8, 6.7],
  D1: [-7, -2.5],
  D2: [-7, 2.5],
  G: [-(GOAL.lineX - 0.9), 0],
}

export const SKATER_ROLES: Role[] = ['C', 'LW', 'RW', 'D1', 'D2']

export function lineupPosition(role: Role, defends: -1 | 1): { x: number; z: number } {
  const [x, z] = LINEUP[role]
  return defends === -1 ? { x, z } : { x: -x, z }
}
