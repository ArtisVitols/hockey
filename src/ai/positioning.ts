import { RINK, GOAL } from '../config'

// Tactical layer encoding real hockey systems (sources: icehockeysystems.com,
// beerleaguetips.com): defensive-zone coverage (net-front D, C low, wingers
// on the points), offensive attack triangle with D at the blue-line points,
// a 1-2-2 forecheck, and a boards breakout.
//
// All positions are computed in attack-forward coordinates:
//   ax = x · attackDir   (ax grows toward the goal we attack)
// and mirrored back through attackDir at the end.

export type TeamState = 'offense' | 'breakout' | 'advance' | 'defense' | 'forecheck' | 'neutral'

export type SkaterRole = 'C' | 'LW' | 'RW' | 'D1' | 'D2'

export interface Pt {
  x: number
  z: number
}

const BLUE = RINK.blueLineFromCenter
// "tops of the circles": x-extent where low-zone pressure begins
const CIRCLE_TOP_AX = RINK.endZoneDotFromCenterX - RINK.faceoffCircleRadius

export function circleTopAx(): number {
  return CIRCLE_TOP_AX
}

// Classify the team's tactical situation from possession + puck position.
export function teamState(
  possessionTeam: 0 | 1 | null,
  team: 0 | 1,
  puckAx: number,
): TeamState {
  const wePossess = possessionTeam === team
  const theyPossess = possessionTeam !== null && possessionTeam !== team

  if (wePossess) {
    if (puckAx > BLUE) return 'offense'
    if (puckAx < -BLUE) return 'breakout'
    return 'advance'
  }
  if (theyPossess) {
    if (puckAx < -BLUE + 2) return 'defense'
    if (puckAx > BLUE) return 'forecheck'
    return 'neutral'
  }
  // loose puck: defend if it's in/near our zone, otherwise neutral
  if (puckAx < -BLUE + 2) return 'defense'
  if (puckAx > BLUE) return 'forecheck'
  return 'neutral'
}

// side helper: ±1 by the puck's z, used to bias strong-side assignments
function sideOf(z: number): 1 | -1 {
  return z >= 0 ? 1 : -1
}

// Home position for a role in the given state, in REAL world coordinates.
// puck is the real puck position; attackDir converts to/from ax space.
export function roleTarget(
  role: SkaterRole,
  state: TeamState,
  puckX: number,
  puckZ: number,
  attackDir: 1 | -1,
): Pt {
  const pax = puckX * attackDir
  const strong = sideOf(puckZ)
  // winger side identity: LW patrols -z, RW +z (z is not mirrored by ends)
  const wingSide = role === 'LW' ? -1 : 1

  let ax: number
  let z: number

  switch (state) {
    case 'offense': {
      if (role === 'C') {
        // high slot, triangle top
        ax = GOAL.lineX - 9
        z = puckZ * 0.25
      } else if (role === 'LW' || role === 'RW') {
        if (wingSide === strong) {
          // strong-side winger works the half-wall near the puck
          ax = Math.min(pax + 1.5, GOAL.lineX - 1.5)
          z = wingSide * 9
        } else {
          // weak-side winger takes the net-front
          ax = GOAL.lineX - 2.2
          z = wingSide * 1.4
        }
      } else {
        // D at the points, just inside the blue line
        ax = BLUE - 1.2
        z = (role === 'D1' ? -1 : 1) * 7
      }
      break
    }
    case 'breakout': {
      if (role === 'C') {
        // low swing through the middle as the outlet
        ax = Math.min(pax + 6, -BLUE + 5)
        z = puckZ * 0.3
      } else if (role === 'LW' || role === 'RW') {
        // half-wall outlets at the hash marks
        ax = -BLUE - 2
        z = wingSide * (RINK.halfWidth - 3.5)
      } else {
        // net-side support / trail
        ax = Math.max(pax - 4, -(GOAL.lineX - 1.5))
        z = (role === 'D1' ? -1 : 1) * 3
      }
      break
    }
    case 'advance': {
      if (role === 'C') {
        ax = Math.min(pax + 5, BLUE - 0.8) // onside clamp
        z = puckZ * 0.3
      } else if (role === 'LW' || role === 'RW') {
        ax = Math.min(pax + 4, BLUE - 0.8)
        z = wingSide * 8.5
      } else {
        // close trail so the points are reachable when the zone is gained
        ax = pax - 5
        z = (role === 'D1' ? -1 : 1) * 5
      }
      break
    }
    case 'defense': {
      if (role === 'C') {
        // third defenseman: low slot
        ax = -(GOAL.lineX - 5.5)
        z = puckZ * 0.35
      } else if (role === 'LW' || role === 'RW') {
        // cover the points
        ax = -BLUE + 2
        z = wingSide * 6.5
      } else {
        const pressureSide = role === 'D1' ? -1 : 1
        if (pax < -CIRCLE_TOP_AX && pressureSide === strong) {
          // strong-side D pressures the puck low
          ax = pax
          z = puckZ
        } else {
          // net-front / slot protection
          ax = -(GOAL.lineX - 1.8)
          z = pressureSide * 1.3
        }
      }
      break
    }
    case 'forecheck': {
      // 1-2-2: F1 (handled as chaser) pressures; wingers seal the half-walls;
      // D pinch up to the blue line, ready to hold the zone
      if (role === 'C') {
        ax = pax - 2
        z = puckZ
      } else if (role === 'LW' || role === 'RW') {
        ax = BLUE + 2
        z = wingSide * 8
      } else {
        ax = BLUE - 2.5
        z = (role === 'D1' ? -1 : 1) * 6
      }
      break
    }
    case 'neutral': {
      if (role === 'C') {
        ax = pax * 0.5
        z = puckZ * 0.5
      } else if (role === 'LW' || role === 'RW') {
        ax = pax * 0.4
        z = wingSide * 8
      } else {
        ax = pax - 7
        z = (role === 'D1' ? -1 : 1) * 4
      }
      break
    }
  }

  // clamp inside the rink with margin
  ax = Math.max(-(RINK.halfLength - 1.5), Math.min(RINK.halfLength - 1.5, ax))
  z = Math.max(-(RINK.halfWidth - 1.5), Math.min(RINK.halfWidth - 1.5, z))

  return { x: ax * attackDir, z }
}

// Nudge targets apart when two teammates would stand on the same spot.
// Later entries (lower priority) get pushed; order = [C, LW, RW, D1, D2].
export function repelTargets(targets: Pt[], minDist = 2.5): void {
  for (let i = 1; i < targets.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = targets[j]!
      const b = targets[i]!
      const dx = b.x - a.x
      const dz = b.z - a.z
      const d = Math.hypot(dx, dz)
      if (d < minDist) {
        const push = minDist - d
        if (d < 1e-4) {
          b.z += minDist * (i % 2 === 0 ? 1 : -1)
        } else {
          b.x += (dx / d) * push
          b.z += (dz / d) * push
        }
      }
    }
  }
}
