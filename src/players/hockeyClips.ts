import {
  AnimationClip,
  Euler,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three'
import type { Rig, RigBone } from './rigMap'

// Character-space authoring convention (the wrapper faces +X):
//   +X forward · +Y up · rotation about Z swings limbs forward/back
//   (positive = forward for hanging limbs, backward-lean for the spine),
//   rotation about X splays limbs sideways, rotation about Y twists.
// Deltas are converted into each bone's local space through the captured
// rest pose, so the same clips drive both the Mixamo and procedural rigs.

type EKey = [time: number, rx: number, ry: number, rz: number]

const _e = new Euler()
const _w = new Quaternion()
const _p = new Quaternion()
const _out = new Quaternion()
const _v = new Vector3()

class ClipBuilder {
  private tracks: KeyframeTrack[] = []

  constructor(private rig: Rig) {}

  rot(bone: RigBone, keys: EKey[]): this {
    const info = this.rig.bones[bone]
    if (!info) return this
    const times: number[] = []
    const values: number[] = []
    for (const [t, rx, ry, rz] of keys) {
      times.push(t)
      _w.setFromEuler(_e.set(rx, ry, rz, 'XYZ'))
      if (info.baselineWorldQ) _w.multiply(info.baselineWorldQ)
      // local = parentRest⁻¹ ∘ world ∘ parentRest ∘ restLocal
      _p.copy(info.parentRestWorldQ)
      _out.copy(_p).invert().multiply(_w).multiply(_p).multiply(info.restLocalQ)
      values.push(_out.x, _out.y, _out.z, _out.w)
    }
    this.tracks.push(new QuaternionKeyframeTrack(`${info.bone.name}.quaternion`, times, values))
    return this
  }

  // vertical hips offset in character-space meters (crouch/bob/fall)
  hipsY(keys: Array<[time: number, dy: number]>): this {
    const info = this.rig.bones.hips
    if (!info) return this
    const times: number[] = []
    const values: number[] = []
    for (const [t, dy] of keys) {
      times.push(t)
      _v.set(0, dy * this.rig.hipsUnitScale, 0)
      _p.copy(info.parentRestWorldQ).invert()
      _v.applyQuaternion(_p)
      values.push(info.restLocalP.x + _v.x, info.restLocalP.y + _v.y, info.restLocalP.z + _v.z)
    }
    this.tracks.push(new VectorKeyframeTrack(`${info.bone.name}.position`, times, values))
    return this
  }

  build(name: string, duration: number): AnimationClip {
    return new AnimationClip(name, duration, this.tracks)
  }
}

export interface ClipSet {
  idle: AnimationClip
  glide: AnimationClip
  skate: AnimationClip
  sprint: AnimationClip
  shot: AnimationClip
  poke: AnimationClip
  check: AnimationClip
  fall: AnimationClip
  getup: AnimationClip
  stop: AnimationClip
  butterfly?: AnimationClip
}

// hockey posture baseline: knees bent, torso forward, head up
interface Posture {
  lean: number
  knee: number
  crouch: number
}
const SKATE_POSTURE: Posture = { lean: -0.38, knee: 0.62, crouch: -0.14 }
const IDLE_POSTURE: Posture = { lean: -0.16, knee: 0.28, crouch: -0.06 }

function makeStride(rig: Rig, name: string, T: number, drive: number, bob: number): AnimationClip {
  const P = SKATE_POSTURE
  const b = new ClipBuilder(rig)
  const half = T / 2
  const legFwd = P.knee * 0.55 + drive * 0.55 // recovered leg, under the body
  const legBack = -drive * 0.9 // extended push behind
  const splay = drive * 0.5

  // legs: alternating diagonal drive; knee (leg) flexes on recovery
  b.rot('upLegL', [
    [0, 0, 0, P.knee + legFwd],
    [half, -splay, 0, legBack + P.knee * 0.4],
    [T, 0, 0, P.knee + legFwd],
  ])
  b.rot('legL', [
    [0, 0, 0, -P.knee * 1.7 - drive * 0.5],
    [half, 0, 0, -P.knee * 0.5],
    [T, 0, 0, -P.knee * 1.7 - drive * 0.5],
  ])
  b.rot('footL', [
    [0, 0, 0, P.knee * 0.9],
    [half, 0, 0, P.knee * 0.3 - drive * 0.4],
    [T, 0, 0, P.knee * 0.9],
  ])
  b.rot('upLegR', [
    [0, splay, 0, legBack + P.knee * 0.4],
    [half, 0, 0, P.knee + legFwd],
    [T, splay, 0, legBack + P.knee * 0.4],
  ])
  b.rot('legR', [
    [0, 0, 0, -P.knee * 0.5],
    [half, 0, 0, -P.knee * 1.7 - drive * 0.5],
    [T, 0, 0, -P.knee * 0.5],
  ])
  b.rot('footR', [
    [0, 0, 0, P.knee * 0.3 - drive * 0.4],
    [half, 0, 0, P.knee * 0.9],
    [T, 0, 0, P.knee * 0.3 - drive * 0.4],
  ])

  // torso: forward lean + slight counter-roll with the stride
  const roll = drive * 0.16
  b.rot('spine', [
    [0, roll, 0, P.lean * 0.5],
    [half, -roll, 0, P.lean * 0.5],
    [T, roll, 0, P.lean * 0.5],
  ])
  b.rot('spine1', [[0, 0, 0, P.lean * 0.3]])
  b.rot('spine2', [
    [0, -roll * 0.6, drive * 0.14, P.lean * 0.35],
    [half, roll * 0.6, -drive * 0.14, P.lean * 0.35],
    [T, -roll * 0.6, drive * 0.14, P.lean * 0.35],
  ])
  b.rot('neck', [[0, 0, 0, -P.lean * 0.9]])
  b.rot('head', [[0, 0, 0, -P.lean * 0.35]])

  // arms: bent elbows, alternating swing opposite the legs
  const arm = drive * 0.7
  b.rot('armL', [
    [0, 0.12, 0, -arm * 0.7],
    [half, 0.12, 0, arm],
    [T, 0.12, 0, -arm * 0.7],
  ])
  b.rot('foreArmL', [[0, 0, 0, 0.5 + drive * 0.25]])
  b.rot('armR', [
    [0, -0.12, 0, arm],
    [half, -0.12, 0, -arm * 0.7],
    [T, -0.12, 0, arm],
  ])
  b.rot('foreArmR', [[0, 0, 0, 0.5 + drive * 0.25]])

  // weight-shift bob
  b.hipsY([
    [0, P.crouch],
    [T * 0.25, P.crouch - bob],
    [half, P.crouch],
    [T * 0.75, P.crouch - bob],
    [T, P.crouch],
  ])

  return b.build(name, T)
}

function makeGlide(rig: Rig): AnimationClip {
  const P = SKATE_POSTURE
  const T = 2.4
  const b = new ClipBuilder(rig)
  for (const s of ['L', 'R'] as const) {
    b.rot(`upLeg${s}`, [[0, 0, 0, P.knee * 0.85]])
    b.rot(`leg${s}`, [[0, 0, 0, -P.knee * 1.5]])
    b.rot(`foot${s}`, [[0, 0, 0, P.knee * 0.75]])
    b.rot(`arm${s}`, [[0, s === 'L' ? 0.14 : -0.14, 0, 0.18]])
    b.rot(`foreArm${s}`, [[0, 0, 0, 0.55]])
  }
  b.rot('spine', [
    [0, 0, 0, P.lean * 0.45],
    [T / 2, 0, 0, P.lean * 0.52],
    [T, 0, 0, P.lean * 0.45],
  ])
  b.rot('spine2', [[0, 0, 0, P.lean * 0.3]])
  b.rot('neck', [[0, 0, 0, -P.lean * 0.85]])
  b.hipsY([
    [0, P.crouch * 0.8],
    [T / 2, P.crouch],
    [T, P.crouch * 0.8],
  ])
  return b.build('glide', T)
}

function makeIdle(rig: Rig): AnimationClip {
  const P = IDLE_POSTURE
  const T = 3
  const b = new ClipBuilder(rig)
  for (const s of ['L', 'R'] as const) {
    b.rot(`upLeg${s}`, [[0, s === 'L' ? -0.05 : 0.05, 0, P.knee]])
    b.rot(`leg${s}`, [[0, 0, 0, -P.knee * 1.8]])
    b.rot(`foot${s}`, [[0, 0, 0, P.knee * 0.85]])
    b.rot(`arm${s}`, [[0, s === 'L' ? 0.1 : -0.1, 0, 0.15]])
    b.rot(`foreArm${s}`, [[0, 0, 0, 0.45]])
  }
  b.rot('spine', [
    [0, 0, 0, P.lean],
    [T / 2, 0, 0.03, P.lean - 0.03],
    [T, 0, 0, P.lean],
  ])
  b.rot('neck', [[0, 0, 0, -P.lean * 0.8]])
  b.hipsY([
    [0, P.crouch],
    [T / 2, P.crouch - 0.012],
    [T, P.crouch],
  ])
  return b.build('idle', T)
}

// one-shot: shot swing (used for wrist/slap/pass with different fade times)
function makeShot(rig: Rig): AnimationClip {
  const T = 0.55
  const b = new ClipBuilder(rig)
  b.rot('spine2', [
    [0, 0, 0, 0],
    [T * 0.3, 0, 0.75, -0.1],
    [T * 0.55, 0, -0.7, -0.05],
    [T, 0, 0, 0],
  ])
  b.rot('spine', [
    [0, 0, 0, 0],
    [T * 0.3, 0, 0.3, 0],
    [T * 0.55, 0, -0.35, 0],
    [T, 0, 0, 0],
  ])
  b.rot('armR', [
    [0, 0, 0, 0],
    [T * 0.3, -0.25, 0, -0.9],
    [T * 0.55, 0.1, 0, 0.9],
    [T, 0, 0, 0],
  ])
  b.rot('armL', [
    [0, 0, 0, 0],
    [T * 0.3, 0.15, 0, 0.5],
    [T * 0.55, -0.1, 0, -0.55],
    [T, 0, 0, 0],
  ])
  b.rot('foreArmR', [
    [0, 0, 0, 0.5],
    [T * 0.3, 0, 0, 0.95],
    [T * 0.55, 0, 0, 0.15],
    [T, 0, 0, 0.5],
  ])
  return b.build('shot', T)
}

function makePoke(rig: Rig): AnimationClip {
  const T = 0.4
  const b = new ClipBuilder(rig)
  b.rot('spine', [
    [0, 0, 0, 0],
    [T * 0.4, 0, 0, -0.3],
    [T, 0, 0, 0],
  ])
  for (const s of ['L', 'R'] as const) {
    b.rot(`arm${s}`, [
      [0, 0, 0, 0],
      [T * 0.4, 0, 0, 1.15],
      [T, 0, 0, 0],
    ])
    b.rot(`foreArm${s}`, [
      [0, 0, 0, 0.5],
      [T * 0.4, 0, 0, 0.1],
      [T, 0, 0, 0.5],
    ])
  }
  return b.build('poke', T)
}

function makeCheck(rig: Rig): AnimationClip {
  const T = 0.45
  const b = new ClipBuilder(rig)
  b.rot('spine2', [
    [0, 0, 0, 0],
    [T * 0.35, 0.2, -0.55, -0.25],
    [T, 0, 0, 0],
  ])
  b.rot('armR', [
    [0, 0, 0, 0],
    [T * 0.35, -0.7, 0, 0.5],
    [T, 0, 0, 0],
  ])
  b.rot('foreArmR', [
    [0, 0, 0, 0.5],
    [T * 0.35, 0, 0, 1.0],
    [T, 0, 0, 0.5],
  ])
  return b.build('check', T)
}

// knocked down: pitch back and drop to the ice
function makeFall(rig: Rig): AnimationClip {
  const T = 0.6
  const b = new ClipBuilder(rig)
  b.rot('spine', [
    [0, 0, 0, 0],
    [T * 0.5, 0, 0, 0.55],
    [T, 0, 0, 0.7],
  ])
  b.rot('spine2', [
    [0, 0, 0, 0],
    [T, 0, 0, 0.35],
  ])
  b.rot('neck', [
    [0, 0, 0, 0],
    [T, 0, 0, -0.5],
  ])
  for (const s of ['L', 'R'] as const) {
    b.rot(`upLeg${s}`, [
      [0, 0, 0, 0.3],
      [T, s === 'L' ? -0.25 : 0.25, 0, 1.15],
    ])
    b.rot(`leg${s}`, [
      [0, 0, 0, -0.6],
      [T, 0, 0, -0.5],
    ])
    b.rot(`arm${s}`, [
      [0, 0, 0, 0],
      [T * 0.5, s === 'L' ? 0.9 : -0.9, 0, -0.6],
      [T, s === 'L' ? 0.7 : -0.7, 0, -0.3],
    ])
  }
  b.hipsY([
    [0, -0.1],
    [T * 0.55, -0.55],
    [T, -0.78],
  ])
  return b.build('fall', T)
}

function makeGetup(rig: Rig): AnimationClip {
  const T = 0.9
  const b = new ClipBuilder(rig)
  b.rot('spine', [
    [0, 0, 0, 0.7],
    [T * 0.5, 0, 0, 0.3],
    [T, 0, 0, 0],
  ])
  b.rot('spine2', [
    [0, 0, 0, 0.35],
    [T, 0, 0, 0],
  ])
  for (const s of ['L', 'R'] as const) {
    b.rot(`upLeg${s}`, [
      [0, 0, 0, 1.15],
      [T * 0.6, 0, 0, 0.8],
      [T, 0, 0, 0.35],
    ])
    b.rot(`leg${s}`, [
      [0, 0, 0, -0.5],
      [T * 0.6, 0, 0, -1.2],
      [T, 0, 0, -0.5],
    ])
  }
  b.hipsY([
    [0, -0.78],
    [T * 0.55, -0.4],
    [T, -0.08],
  ])
  return b.build('getup', T)
}

// hockey stop: body swings sideways, both knees deep, shave the ice
function makeStop(rig: Rig): AnimationClip {
  const T = 0.5
  const b = new ClipBuilder(rig)
  b.rot('spine', [
    [0, 0, 0, -0.3],
    [T * 0.35, 0, 0.55, -0.42],
    [T, 0, 0, -0.3],
  ])
  b.rot('spine2', [
    [0, 0, 0, -0.2],
    [T * 0.35, 0, 0.35, -0.25],
    [T, 0, 0, -0.2],
  ])
  b.rot('upLegL', [
    [0, 0, 0, 0.5],
    [T * 0.35, -0.35, 0.4, 0.8],
    [T, 0, 0, 0.5],
  ])
  b.rot('upLegR', [
    [0, 0, 0, 0.5],
    [T * 0.35, 0.15, 0.4, 0.65],
    [T, 0, 0, 0.5],
  ])
  for (const s of ['L', 'R'] as const) {
    b.rot(`leg${s}`, [
      [0, 0, 0, -1],
      [T * 0.35, 0, 0, -1.35],
      [T, 0, 0, -1],
    ])
    b.rot(`arm${s}`, [
      [0, 0, 0, 0.2],
      [T * 0.35, s === 'L' ? 0.5 : -0.5, 0, 0.35],
      [T, 0, 0, 0.2],
    ])
  }
  b.hipsY([
    [0, -0.14],
    [T * 0.35, -0.3],
    [T, -0.14],
  ])
  return b.build('stop', T)
}

// goalie butterfly: drop, knees together, pads flared
function makeButterfly(rig: Rig): AnimationClip {
  const T = 0.35
  const b = new ClipBuilder(rig)
  for (const s of ['L', 'R'] as const) {
    const out = s === 'L' ? -1 : 1
    b.rot(`upLeg${s}`, [
      [0, 0, 0, 0.5],
      [T, out * 0.85, 0, 1.05],
    ])
    b.rot(`leg${s}`, [
      [0, 0, 0, -1],
      [T, out * 0.3, 0, -1.5],
    ])
    b.rot(`arm${s}`, [
      [0, 0, 0, 0.2],
      [T, out * 0.35, 0, 0.35],
    ])
  }
  b.rot('spine', [
    [0, 0, 0, -0.25],
    [T, 0, 0, -0.1],
  ])
  b.hipsY([
    [0, -0.2],
    [T, -0.62],
  ])
  return b.build('butterfly', T)
}

export function buildSkaterClips(rig: Rig): ClipSet {
  return {
    idle: makeIdle(rig),
    glide: makeGlide(rig),
    skate: makeStride(rig, 'skate', 0.9, 0.62, 0.035),
    sprint: makeStride(rig, 'sprint', 0.72, 0.85, 0.05),
    shot: makeShot(rig),
    poke: makePoke(rig),
    check: makeCheck(rig),
    fall: makeFall(rig),
    getup: makeGetup(rig),
    stop: makeStop(rig),
  }
}

export function buildGoalieClips(rig: Rig): ClipSet {
  const set = buildSkaterClips(rig)
  // goalies idle deeper and move in a compact stance
  const P: Posture = { lean: -0.3, knee: 0.5, crouch: -0.18 }
  const b = new ClipBuilder(rig)
  for (const s of ['L', 'R'] as const) {
    b.rot(`upLeg${s}`, [[0, s === 'L' ? -0.18 : 0.18, 0, P.knee]])
    b.rot(`leg${s}`, [[0, 0, 0, -P.knee * 1.9]])
    b.rot(`foot${s}`, [[0, 0, 0, P.knee * 0.95]])
    b.rot(`arm${s}`, [[0, s === 'L' ? 0.35 : -0.35, 0, 0.35]])
    b.rot(`foreArm${s}`, [[0, 0, 0, 0.7]])
  }
  b.rot('spine', [[0, 0, 0, P.lean]])
  b.rot('neck', [[0, 0, 0, -P.lean * 0.9]])
  b.hipsY([[0, P.crouch]])
  set.idle = b.build('stance', 2)
  set.butterfly = makeButterfly(rig)
  return set
}
