import { RINK } from '../config'

// Signed distance from a point on the ice to the board boundary.
// Negative inside the rink, positive outside.
export function boardsSDF(x: number, z: number): number {
  const qx = Math.abs(x) - (RINK.halfLength - RINK.cornerRadius)
  const qz = Math.abs(z) - (RINK.halfWidth - RINK.cornerRadius)
  const mx = Math.max(qx, 0)
  const mz = Math.max(qz, 0)
  return Math.min(Math.max(qx, qz), 0) + Math.hypot(mx, mz) - RINK.cornerRadius
}

// Inward-pointing boundary normal at (x, z), via central differences.
export function boardsNormal(x: number, z: number): { nx: number; nz: number } {
  const e = 0.01
  const dx = boardsSDF(x + e, z) - boardsSDF(x - e, z)
  const dz = boardsSDF(x, z + e) - boardsSDF(x, z - e)
  const len = Math.hypot(dx, dz) || 1
  // SDF gradient points outward; the inward normal is its negation.
  return { nx: -dx / len, nz: -dz / len }
}

// Sample the rounded-rect perimeter as a closed polyline (counter-clockwise
// seen from above), for building board/glass wall ribbons.
export function perimeterPoints(segmentsPerCorner = 16, segmentsPerSide = 24): Array<{ x: number; z: number }> {
  const hl = RINK.halfLength
  const hw = RINK.halfWidth
  const r = RINK.cornerRadius
  const pts: Array<{ x: number; z: number }> = []

  const arc = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i < segmentsPerCorner; i++) {
      const t = a0 + ((a1 - a0) * i) / segmentsPerCorner
      pts.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t) })
    }
  }
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    for (let i = 0; i < segmentsPerSide; i++) {
      const t = i / segmentsPerSide
      pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t })
    }
  }

  line(hl - r, hw, -(hl - r), hw)
  arc(-(hl - r), hw - r, Math.PI / 2, Math.PI)
  line(-hl, hw - r, -hl, -(hw - r))
  arc(-(hl - r), -(hw - r), Math.PI, Math.PI * 1.5)
  line(-(hl - r), -hw, hl - r, -hw)
  arc(hl - r, -(hw - r), Math.PI * 1.5, Math.PI * 2)
  line(hl, -(hw - r), hl, hw - r)
  arc(hl - r, hw - r, 0, Math.PI / 2)
  return pts
}
