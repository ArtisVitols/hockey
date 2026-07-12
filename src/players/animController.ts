import {
  AnimationClip,
  AnimationMixer,
  Euler,
  LoopOnce,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  type AnimationAction,
  type SkinnedMesh,
} from 'three'

const _e = new Euler()
const _q = new Quaternion()

// Quaternion track from euler keyframes: [time, rx, ry, rz][]
function qTrack(bone: string, keys: Array<[number, number, number, number]>): QuaternionKeyframeTrack {
  const times: number[] = []
  const values: number[] = []
  for (const [t, rx, ry, rz] of keys) {
    times.push(t)
    _q.setFromEuler(_e.set(rx, ry, rz))
    values.push(_q.x, _q.y, _q.z, _q.w)
  }
  return new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values)
}

// Skating stride: legs swing about z (forward axis is +x), splay about x on
// the push, arms counter-swing, constant forward lean, damped hip bob.
function makeSkateClip(): AnimationClip {
  const T = 0.9
  const swing = 0.62
  const splay = 0.3
  return new AnimationClip('skate', T, [
    qTrack('thighL', [
      [0, swing, 0, -splay],
      [T * 0.5, -swing, 0, splay * 0.4],
      [T, swing, 0, -splay],
    ]),
    qTrack('thighR', [
      [0, -swing, 0, splay * 0.4],
      [T * 0.5, swing, 0, -splay],
      [T, -swing, 0, splay * 0.4],
    ]),
    qTrack('shinL', [
      [0, -swing * 0.5, 0, 0],
      [T * 0.5, swing * 0.9, 0, 0],
      [T, -swing * 0.5, 0, 0],
    ]),
    qTrack('shinR', [
      [0, swing * 0.9, 0, 0],
      [T * 0.5, -swing * 0.5, 0, 0],
      [T, swing * 0.9, 0, 0],
    ]),
    qTrack('upperArmL', [
      [0, -0.45, 0, 0],
      [T * 0.5, 0.45, 0, 0],
      [T, -0.45, 0, 0],
    ]),
    qTrack('upperArmR', [
      [0, 0.45, 0, 0],
      [T * 0.5, -0.45, 0, 0],
      [T, 0.45, 0, 0],
    ]),
    qTrack('chest', [
      [0, 0, 0, 0.3],
      [T * 0.5, 0, 0, 0.34],
      [T, 0, 0, 0.3],
    ]),
    new VectorKeyframeTrack('hips.position', [0, T * 0.25, T * 0.5, T * 0.75, T], [
      0, 0.95, 0,
      0, 0.92, 0,
      0, 0.95, 0,
      0, 0.92, 0,
      0, 0.95, 0,
    ]),
  ])
}

function makeIdleClip(): AnimationClip {
  const T = 3
  return new AnimationClip('idle', T, [
    qTrack('chest', [
      [0, 0, 0, 0.12],
      [T * 0.5, 0, 0.04, 0.15],
      [T, 0, 0, 0.12],
    ]),
    qTrack('thighL', [[0, 0, 0, -0.06]]),
    qTrack('thighR', [[0, 0, 0, 0.06]]),
  ])
}

// One-shot slap/wrist shot: wind up, torso twist, follow through.
function makeShotClip(): AnimationClip {
  const T = 0.55
  return new AnimationClip('shot', T, [
    qTrack('chest', [
      [0, 0, 0, 0.3],
      [T * 0.35, 0, 0.7, 0.35],
      [T * 0.6, 0, -0.6, 0.3],
      [T, 0, 0, 0.3],
    ]),
    qTrack('upperArmR', [
      [0, 0, 0, 0],
      [T * 0.35, 0.9, 0, -0.3],
      [T * 0.6, -0.8, 0, 0.2],
      [T, 0, 0, 0],
    ]),
    qTrack('upperArmL', [
      [0, 0, 0, 0],
      [T * 0.35, 0.5, 0, 0.2],
      [T * 0.6, -0.5, 0, -0.1],
      [T, 0, 0, 0],
    ]),
  ])
}

// Poke check: quick two-handed stick lunge.
function makePokeClip(): AnimationClip {
  const T = 0.4
  return new AnimationClip('poke', T, [
    qTrack('upperArmR', [
      [0, 0, 0, 0],
      [T * 0.4, 1.1, 0, -0.2],
      [T, 0, 0, 0],
    ]),
    qTrack('upperArmL', [
      [0, 0, 0, 0],
      [T * 0.4, 0.9, 0, 0.15],
      [T, 0, 0, 0],
    ]),
    qTrack('chest', [
      [0, 0, 0, 0.3],
      [T * 0.4, 0, 0, 0.55],
      [T, 0, 0, 0.3],
    ]),
  ])
}

// Body check: shoulder drive into the hit.
function makeCheckClip(): AnimationClip {
  const T = 0.45
  return new AnimationClip('check', T, [
    qTrack('chest', [
      [0, 0, 0, 0.3],
      [T * 0.35, 0, -0.55, 0.5],
      [T, 0, 0, 0.3],
    ]),
    qTrack('upperArmR', [
      [0, 0, 0, 0],
      [T * 0.35, 0.4, 0, -0.5],
      [T, 0, 0, 0],
    ]),
  ])
}

// Stumble: knocked off balance, pitches forward and recovers.
function makeStumbleClip(): AnimationClip {
  const T = 0.75
  return new AnimationClip('stumble', T, [
    qTrack('chest', [
      [0, 0, 0, 0.3],
      [T * 0.3, 0, 0.3, 0.95],
      [T * 0.65, 0, 0.2, 0.75],
      [T, 0, 0, 0.3],
    ]),
    qTrack('upperArmL', [
      [0, 0, 0, 0],
      [T * 0.3, -1.1, 0, 0.6],
      [T, 0, 0, 0],
    ]),
    qTrack('upperArmR', [
      [0, 0, 0, 0],
      [T * 0.3, -1.1, 0, -0.6],
      [T, 0, 0, 0],
    ]),
    new VectorKeyframeTrack('hips.position', [0, T * 0.3, T], [0, 0.95, 0, 0, 0.78, 0, 0, 0.95, 0]),
  ])
}

// Goalie butterfly save pose (also used as their idle crouch source).
function makeButterflyClip(): AnimationClip {
  const T = 0.4
  return new AnimationClip('butterfly', T, [
    qTrack('thighL', [
      [0, 0, 0, 0],
      [T, 1.15, 0, -0.5],
    ]),
    qTrack('thighR', [
      [0, 0, 0, 0],
      [T, -1.15, 0, 0.5],
    ]),
    qTrack('shinL', [
      [0, 0, 0, 0],
      [T, -1.2, 0, 0],
    ]),
    qTrack('shinR', [
      [0, 0, 0, 0],
      [T, 1.2, 0, 0],
    ]),
    new VectorKeyframeTrack('hips.position', [0, T], [0, 0.95, 0, 0, 0.55, 0]),
  ])
}

const CROSSFADE = 0.18

// Two-layer state machine: locomotion (idle ↔ skate, timeScale synced to
// ground speed) + one-shot actions (shot) faded on top.
export class AnimController {
  private mixer: AnimationMixer
  private idle: AnimationAction
  private skate: AnimationAction
  private shot: AnimationAction
  private poke: AnimationAction
  private check: AnimationAction
  private stumble: AnimationAction
  private butterfly: AnimationAction | null = null
  private skating = false

  constructor(mesh: SkinnedMesh, goalie = false) {
    this.mixer = new AnimationMixer(mesh)
    this.idle = this.mixer.clipAction(makeIdleClip())
    this.skate = this.mixer.clipAction(makeSkateClip())
    const oneShot = (clip: AnimationClip) => {
      const action = this.mixer.clipAction(clip)
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = false
      return action
    }
    this.shot = oneShot(makeShotClip())
    this.poke = oneShot(makePokeClip())
    this.check = oneShot(makeCheckClip())
    this.stumble = oneShot(makeStumbleClip())
    if (goalie) {
      this.butterfly = this.mixer.clipAction(makeButterflyClip())
      this.butterfly.setLoop(LoopOnce, 1)
      this.butterfly.clampWhenFinished = true
    }
    this.idle.play()
  }

  update(dt: number, speed: number): void {
    const shouldSkate = speed > 0.6
    if (shouldSkate !== this.skating) {
      this.skating = shouldSkate
      const from = shouldSkate ? this.idle : this.skate
      const to = shouldSkate ? this.skate : this.idle
      to.reset().play()
      to.crossFadeFrom(from, CROSSFADE, true)
    }
    // feet match ice speed: full cycle tuned for ~5.5 m/s
    this.skate.timeScale = Math.max(0.5, speed / 5.5)
    this.mixer.update(dt)
  }

  playShot(): void {
    this.shot.reset().fadeIn(0.05).play()
    this.shot.fadeOut(0.5)
  }

  playPoke(): void {
    this.poke.reset().fadeIn(0.05).play()
    this.poke.fadeOut(0.35)
  }

  playCheck(): void {
    this.check.reset().fadeIn(0.05).play()
    this.check.fadeOut(0.4)
  }

  playStumble(): void {
    this.stumble.reset().fadeIn(0.05).play()
    this.stumble.fadeOut(0.7)
  }

  playButterfly(): void {
    this.butterfly?.reset().fadeIn(0.1).play()
  }
}
