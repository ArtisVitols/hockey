import { Group, Quaternion, Vector3, type Object3D } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { buildProceduralPlayer, type ProceduralPlayerColors } from './proceduralPlayer'
import { buildGlbPlayer, makeStick, type StickParts } from './glbPlayer'
import { captureRig, type Rig } from './rigMap'
import { buildSkaterClips, buildGoalieClips } from './hockeyClips'
import { AnimController } from './animController'
import type { SkaterBody } from '../physics/skaterBody'

// `?noanim=1` freezes rigs at rest pose (debug aid)
const NO_ANIM = new URLSearchParams(window.location.search).has('noanim')

const _pos = new Vector3()
const _a = new Vector3()
const _b = new Vector3()
const _dir = new Vector3()
const _down = new Vector3(0, -1, 0)
const _q = new Quaternion()

// Owns one player's scene-graph presence. Prefers the rigged GLB mannequin
// (dressed in gear) and falls back to the procedural build when the model
// isn't available. Animation runs on the shared hockey clip set either way.
export class PlayerVisual {
  readonly group = new Group()
  readonly anim: AnimController
  private rig: Rig
  private headBone: Object3D | null
  private stick: StickParts | null = null
  private prevHeading = 0

  constructor(colors: ProceduralPlayerColors, goalie = false, model: GLTF | null = null) {
    let root: Object3D
    if (model) {
      const built = buildGlbPlayer(model, colors, goalie)
      root = built.root
      this.rig = built.rig
      this.stick = makeStick(this.group, goalie)
    } else {
      const { mesh } = buildProceduralPlayer(colors, goalie)
      const wrapper = new Group()
      wrapper.add(mesh)
      wrapper.updateWorldMatrix(true, true)
      root = wrapper
      this.rig = captureRig(wrapper, 'procedural')
    }
    this.group.add(root)
    const clips = goalie ? buildGoalieClips(this.rig) : buildSkaterClips(this.rig)
    this.anim = new AnimController(root, clips)
    this.headBone = this.rig.bones.head?.bone ?? null
  }

  sync(body: SkaterBody, alpha: number, dt: number, puckPos: Vector3): void {
    _pos.copy(body.prevPos).lerp(body.pos, alpha)
    this.group.position.set(_pos.x, 0, _pos.z)
    this.group.rotation.y = -body.heading

    // lean into turns proportional to heading rate × speed
    const speed = Math.hypot(body.vel.x, body.vel.z)
    let dHeading = body.heading - this.prevHeading
    while (dHeading > Math.PI) dHeading -= Math.PI * 2
    while (dHeading < -Math.PI) dHeading += Math.PI * 2
    this.prevHeading = body.heading
    const targetLean = Math.max(-0.32, Math.min(0.32, (dHeading / Math.max(dt, 1e-4)) * speed * 0.011))
    this.group.rotation.x += (targetLean - this.group.rotation.x) * Math.min(1, 6 * dt)

    // head tracks the puck (clamped yaw on the head bone)
    if (this.headBone) {
      const dx = puckPos.x - _pos.x
      const dz = puckPos.z - _pos.z
      let headYaw = Math.atan2(dz, dx) - body.heading
      while (headYaw > Math.PI) headYaw -= Math.PI * 2
      while (headYaw < -Math.PI) headYaw += Math.PI * 2
      headYaw = Math.max(-1.0, Math.min(1.0, headYaw))
      this.headBone.rotation.y += (-headYaw * 0.7 - this.headBone.rotation.y) * Math.min(1, 8 * dt)
    }

    if (!NO_ANIM) this.anim.update(dt, speed, body.braking)
    this.solveStick()
  }

  // two-hand hold: shaft from the top hand through the bottom hand, blade
  // pushed toward the ice
  private solveStick(): void {
    if (!this.stick) return
    const handR = this.rig.bones.handR?.bone
    const handL = this.rig.bones.handL?.bone
    if (!handR || !handL) return
    handR.getWorldPosition(_a)
    handL.getWorldPosition(_b)
    this.group.worldToLocal(_a)
    this.group.worldToLocal(_b)
    _dir.copy(_b).sub(_a)
    if (_dir.lengthSq() < 1e-6) return
    _dir.normalize()
    // blend the hand axis with a canonical down-forward stick line so the
    // blade stays ahead of the skates whatever the arms are doing
    _dir.multiplyScalar(0.35)
    _dir.x += 0.42
    _dir.y -= 0.78
    _dir.z += 0.1
    _dir.normalize()
    this.stick.group.position.copy(_a)
    _q.setFromUnitVectors(_down, _dir)
    this.stick.group.quaternion.copy(_q)
  }
}
