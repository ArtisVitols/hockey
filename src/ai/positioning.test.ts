import { describe, it, expect } from 'vitest'
import { teamState, roleTarget, repelTargets, circleTopAx } from './positioning'
import { RINK, GOAL } from '../config'

const BLUE = RINK.blueLineFromCenter

describe('teamState', () => {
  it('classifies possession by zone (attacking +x)', () => {
    expect(teamState(0, 0, BLUE + 3)).toBe('offense')
    expect(teamState(0, 0, -BLUE - 3)).toBe('breakout')
    expect(teamState(0, 0, 0)).toBe('advance')
  })

  it('classifies opponent possession', () => {
    expect(teamState(1, 0, -BLUE - 1)).toBe('defense')
    expect(teamState(1, 0, BLUE + 1)).toBe('forecheck')
    expect(teamState(1, 0, 0)).toBe('neutral')
  })

  it('treats loose pucks near our net as defense', () => {
    expect(teamState(null, 0, -BLUE - 4)).toBe('defense')
    expect(teamState(null, 0, 0)).toBe('neutral')
  })
})

describe('roleTarget invariants', () => {
  const puck = { x: GOAL.lineX - 4, z: 5 } // deep in the +x zone

  it('offense: D hold the points inside the blue line (both attack dirs)', () => {
    for (const dir of [1, -1] as const) {
      for (const d of ['D1', 'D2'] as const) {
        const t = roleTarget(d, 'offense', puck.x * dir, puck.z, dir)
        const ax = t.x * dir
        expect(ax).toBeGreaterThan(BLUE - 3)
        expect(ax).toBeLessThan(BLUE)
      }
    }
  })

  it('offense: strong-side winger low, weak-side winger at the net', () => {
    // puck at z=5 → RW (+z) is strong side
    const rw = roleTarget('RW', 'offense', puck.x, puck.z, 1)
    const lw = roleTarget('LW', 'offense', puck.x, puck.z, 1)
    expect(Math.abs(rw.z)).toBeGreaterThan(7) // half-wall
    expect(Math.abs(lw.z)).toBeLessThan(3) // net-front
  })

  it('defense: wingers cover the points above the D', () => {
    const dPuck = { x: -(GOAL.lineX - 3), z: -6 }
    for (const w of ['LW', 'RW'] as const) {
      const t = roleTarget(w, 'defense', dPuck.x, dPuck.z, 1)
      expect(t.x * 1).toBeGreaterThan(-BLUE - 1) // near our blue line
      expect(t.x * 1).toBeLessThan(-BLUE + 4)
    }
    // net-front D (weak side, +z here since puck z<0) parks at the crease
    const d2 = roleTarget('D2', 'defense', dPuck.x, dPuck.z, 1)
    expect(d2.x).toBeLessThan(-(GOAL.lineX - 4))
  })

  it('defense: strong-side D pressures a puck below the circle tops', () => {
    const lowPuck = { x: -(circleTopAx() + 2), z: -6 }
    const d1 = roleTarget('D1', 'defense', lowPuck.x, lowPuck.z, 1)
    expect(d1.x).toBeCloseTo(lowPuck.x, 1)
    expect(d1.z).toBeCloseTo(lowPuck.z, 1)
  })

  it('breakout: wingers post up on the half-walls', () => {
    const bPuck = { x: -(GOAL.lineX - 2), z: 0 }
    for (const w of ['LW', 'RW'] as const) {
      const t = roleTarget(w, 'breakout', bPuck.x, bPuck.z, 1)
      expect(Math.abs(t.z)).toBeGreaterThan(RINK.halfWidth - 5)
    }
  })

  it('advance: forwards clamp onside at the blue line', () => {
    const nPuck = { x: BLUE - 2, z: 0 }
    for (const f of ['C', 'LW', 'RW'] as const) {
      const t = roleTarget(f, 'advance', nPuck.x, nPuck.z, 1)
      expect(t.x).toBeLessThan(BLUE)
    }
  })
})

describe('repelTargets', () => {
  it('pushes overlapping targets apart', () => {
    const targets = [
      { x: 0, z: 0 },
      { x: 0.5, z: 0 },
      { x: 10, z: 10 },
    ]
    repelTargets(targets)
    const d = Math.hypot(targets[1]!.x - targets[0]!.x, targets[1]!.z - targets[0]!.z)
    expect(d).toBeGreaterThanOrEqual(2.4)
    expect(targets[2]).toEqual({ x: 10, z: 10 })
  })
})
