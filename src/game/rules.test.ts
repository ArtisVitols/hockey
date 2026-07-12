import { describe, it, expect } from 'vitest'
import { World } from '../physics/world'
import { Rules } from './rules'
import { faceoffSlots, neutralDot, endZoneDot } from './faceoff'
import { boardsSDF } from '../physics/geometry'
import { RINK, GOAL } from '../config'

function makeWorld() {
  const world = new World()
  const team0 = [world.addSkater(-5, 0), world.addSkater(-5, 3)]
  const team1 = [world.addSkater(5, 0), world.addSkater(5, 3)]
  for (const s of team0) world.teamOf.set(s, 0)
  for (const s of team1) world.teamOf.set(s, 1)
  const rules = new Rules(world, [team0, team1], (t) => (t === 0 ? 1 : -1))
  return { world, team0, team1, rules }
}

describe('offside', () => {
  it('whistles when a teammate precedes the puck across the blue line', () => {
    const { world, team0, rules } = makeWorld()
    team0[1]!.pos.set(RINK.blueLineFromCenter + 2, 0, 3) // already in the zone
    world.lastTouchTeam = 0
    world.puck.pos.x = RINK.blueLineFromCenter - 0.1
    rules.reset()
    world.puck.pos.x = RINK.blueLineFromCenter + 0.1
    const stop = rules.check()
    expect(stop?.reason).toBe('offside')
    expect(stop?.againstTeam).toBe(0)
    expect(stop?.dot).toEqual(neutralDot(1, 1))
  })

  it('allows a clean zone entry', () => {
    const { world, rules } = makeWorld()
    world.lastTouchTeam = 0
    world.puck.pos.x = RINK.blueLineFromCenter - 0.1
    rules.reset()
    world.puck.pos.x = RINK.blueLineFromCenter + 0.1
    expect(rules.check()).toBeNull()
  })
})

describe('icing', () => {
  it('whistles a dump from behind center crossing the far goal line', () => {
    const { world, rules } = makeWorld()
    world.lastTouchTeam = 0
    world.lastTouchX = -5
    world.puck.pos.set(GOAL.lineX - 0.2, 0.02, 4)
    rules.reset()
    world.puck.pos.x = GOAL.lineX + 0.2
    const stop = rules.check()
    expect(stop?.reason).toBe('icing')
    expect(stop?.againstTeam).toBe(0)
    expect(stop?.dot).toEqual(endZoneDot(-1, 1))
  })

  it('no icing when released from beyond center', () => {
    const { world, rules } = makeWorld()
    world.lastTouchTeam = 0
    world.lastTouchX = 5
    world.puck.pos.set(GOAL.lineX - 0.2, 0.02, 4)
    rules.reset()
    world.puck.pos.x = GOAL.lineX + 0.2
    expect(rules.check()).toBeNull()
  })

  it('no icing through the goal frame (that is a goal)', () => {
    const { world, rules } = makeWorld()
    world.lastTouchTeam = 0
    world.lastTouchX = -5
    world.puck.pos.set(GOAL.lineX - 0.2, 0.02, 0)
    rules.reset()
    world.puck.pos.x = GOAL.lineX + 0.2
    expect(rules.check()).toBeNull()
  })
})

describe('faceoff slots', () => {
  it('centers face each other across the dot', () => {
    const dot = { x: 0, z: 0 }
    const a = faceoffSlots(dot, 1)
    const b = faceoffSlots(dot, -1)
    expect(a.C.x).toBeLessThan(dot.x)
    expect(b.C.x).toBeGreaterThan(dot.x)
  })

  it('keeps end-zone lineups inside the boards', () => {
    const dot = endZoneDot(1, 1)
    for (const attackDir of [1, -1] as const) {
      const slots = faceoffSlots(dot, attackDir)
      for (const s of Object.values(slots)) {
        expect(boardsSDF(s.x, s.z)).toBeLessThan(-1)
      }
    }
  })
})
