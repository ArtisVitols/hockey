import type { World } from '../physics/world'
import type { SkaterBody } from '../physics/skaterBody'
import { TEAMS } from './teams'
import { Rules, type Stoppage } from './rules'
import { CENTER_DOT, placeTeam, type Dot } from './faceoff'
import { PUCK } from '../config'

export type Phase =
  | 'faceoff_setup'
  | 'faceoff'
  | 'play'
  | 'goal'
  | 'stoppage'
  | 'period_end'
  | 'game_over'

export interface MatchEvent {
  type: 'goal' | 'offside' | 'icing' | 'period_end' | 'period_start' | 'game_over' | 'puck_drop'
  scoringTeam?: 0 | 1
}

export interface MatchOptions {
  periodSeconds: number
}

// Top-level game flow: faceoff → play → stoppage/goal → faceoff, three
// periods with side swaps, sudden-death OT if tied.
export class Match {
  phase: Phase = 'faceoff_setup'
  period = 1
  clock: number
  readonly score: [number, number] = [0, 0]
  onEvent: ((e: MatchEvent) => void) | null = null

  private rules: Rules
  private timer = 1.2
  private dot: Dot = CENTER_DOT
  private pendingGoalSide: 1 | -1 | null = null

  constructor(
    private world: World,
    private teamSkaters: [SkaterBody[], SkaterBody[]],
    private goalies: [SkaterBody, SkaterBody],
    readonly options: MatchOptions = { periodSeconds: 180 },
  ) {
    this.clock = options.periodSeconds
    this.rules = new Rules(world, teamSkaters, (t) => this.attackDirOf(t))
    world.onGoal = (e) => {
      if (this.phase !== 'play') return
      const scoring = this.defendsOf(0) === e.side ? 1 : 0
      this.score[scoring]++
      this.pendingGoalSide = e.side
      this.phase = 'goal'
      this.timer = 2.4
      this.onEvent?.({ type: 'goal', scoringTeam: scoring as 0 | 1 })
    }
    this.enterFaceoffSetup(CENTER_DOT)
  }

  restart(periodSeconds?: number): void {
    if (periodSeconds) this.options.periodSeconds = periodSeconds
    this.score[0] = 0
    this.score[1] = 0
    this.period = 1
    this.clock = this.options.periodSeconds
    this.pendingGoalSide = null
    this.enterFaceoffSetup(CENTER_DOT)
  }

  // which goal (+1/-1 x side) team t defends this period (sides swap each period)
  defendsOf(t: 0 | 1): -1 | 1 {
    const base = TEAMS[t].defends
    return this.period % 2 === 0 ? ((base * -1) as -1 | 1) : base
  }

  attackDirOf(t: 0 | 1): 1 | -1 {
    return (this.defendsOf(t) * -1) as 1 | -1
  }

  isOvertime(): boolean {
    return this.period > 3
  }

  step(dt: number): void {
    switch (this.phase) {
      case 'faceoff_setup': {
        this.pinPuck()
        this.timer -= dt
        if (this.timer <= 0) {
          this.phase = 'faceoff'
          this.timer = 0.5 + Math.random() * 0.6
        }
        break
      }
      case 'faceoff': {
        this.pinPuck()
        this.timer -= dt
        if (this.timer <= 0) {
          this.phase = 'play'
          this.rules.reset()
          this.onEvent?.({ type: 'puck_drop' })
        }
        break
      }
      case 'play': {
        this.clock -= dt
        if (this.clock <= 0) {
          this.clock = 0
          this.phase = 'period_end'
          this.timer = 3.5
          this.onEvent?.({ type: 'period_end' })
          break
        }
        const stop = this.rules.check()
        if (stop) this.enterStoppage(stop)
        break
      }
      case 'goal': {
        this.timer -= dt
        if (this.timer <= 0) {
          // OT sudden death ends the game on any goal
          if (this.isOvertime()) {
            this.phase = 'game_over'
            this.onEvent?.({ type: 'game_over' })
          } else {
            this.enterFaceoffSetup(CENTER_DOT)
          }
          this.pendingGoalSide = null
        }
        break
      }
      case 'stoppage': {
        this.timer -= dt
        if (this.timer <= 0) this.enterFaceoffSetup(this.dot)
        break
      }
      case 'period_end': {
        this.timer -= dt
        if (this.timer <= 0) {
          if (this.period >= 3 && this.score[0] !== this.score[1]) {
            this.phase = 'game_over'
            this.onEvent?.({ type: 'game_over' })
          } else {
            this.period++
            this.clock = this.isOvertime() ? this.options.periodSeconds / 2 : this.options.periodSeconds
            this.onEvent?.({ type: 'period_start' })
            this.enterFaceoffSetup(CENTER_DOT)
          }
        }
        break
      }
      case 'game_over':
        break
    }
  }

  private enterFaceoffSetup(dot: Dot): void {
    this.phase = 'faceoff_setup'
    this.dot = dot
    this.timer = 1.2
    for (const t of [0, 1] as const) {
      placeTeam(this.teamSkaters[t], this.goalies[t], dot, this.attackDirOf(t))
    }
    this.world.placePuck(dot.x, dot.z)
  }

  private enterStoppage(stop: Stoppage): void {
    this.phase = 'stoppage'
    this.dot = stop.dot
    this.timer = 1.8
    this.onEvent?.({ type: stop.reason })
  }

  private pinPuck(): void {
    const p = this.world.puck
    p.pos.set(this.dot.x, PUCK.height / 2, this.dot.z)
    p.prevPos.copy(p.pos)
    p.vel.set(0, 0, 0)
  }
}
