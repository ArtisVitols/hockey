import { describe, it, expect } from 'vitest'
import { SkaterBody } from '../physics/skaterBody'
import { pickOpenMate, autoShotTarget, leadPoint } from './targeting'
import { GOAL } from '../config'

function skater(x: number, z: number, vx = 0, vz = 0): SkaterBody {
  const s = new SkaterBody()
  s.pos.set(x, 0, z)
  s.vel.set(vx, 0, vz)
  return s
}

describe('pickOpenMate', () => {
  it('prefers the open teammate ahead over a covered one', () => {
    const carrier = skater(0, 0)
    const openAhead = skater(6, -4)
    const covered = skater(8, 4)
    const defender = skater(8.5, 4.5) // right on top of `covered`
    const pick = pickOpenMate(carrier, [carrier, openAhead, covered], [defender], 1)
    expect(pick).toBe(openAhead)
  })

  it('returns null when everyone is covered', () => {
    const carrier = skater(0, 0)
    const mate = skater(5, 0)
    const defender = skater(5.5, 0.5)
    expect(pickOpenMate(carrier, [mate], [defender], 1)).toBeNull()
  })

  it('leads a moving receiver', () => {
    const receiver = skater(5, 0, 4, 0)
    const p = leadPoint(receiver)
    expect(p.x).toBeGreaterThan(5)
  })
})

describe('autoShotTarget', () => {
  it('aims at the attacked goal, far corner from the shooter', () => {
    const shooter = skater(10, 5)
    const t = autoShotTarget(shooter, 1)
    expect(t.x).toBe(GOAL.lineX)
    expect(t.z).toBeLessThan(0) // shooter on +z aims to -z corner
  })
})
