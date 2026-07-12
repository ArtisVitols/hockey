import { Group, Vector3, type Object3D } from 'three'
import { buildProceduralPlayer, BONES, type ProceduralPlayerColors } from './proceduralPlayer'
import { AnimController } from './animController'
import type { SkaterBody } from '../physics/skaterBody'

const _pos = new Vector3()

// Owns one player's scene-graph presence: procedural skinned mesh (a rigged
// GLB can replace it behind the same interface), animation state machine,
// turn lean, and head tracking of the puck.
export class PlayerVisual {
  readonly group = new Group()
  readonly anim: AnimController
  private headBone: Object3D
  private prevHeading = 0

  constructor(colors: ProceduralPlayerColors, goalie = false) {
    const { mesh, skeleton } = buildProceduralPlayer(colors, goalie)
    this.group.add(mesh)
    this.anim = new AnimController(mesh, goalie)
    this.headBone = skeleton.bones[BONES.head]!
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
    const targetLean = Math.max(-0.35, Math.min(0.35, (dHeading / Math.max(dt, 1e-4)) * speed * 0.012))
    this.group.rotation.x += (targetLean - this.group.rotation.x) * Math.min(1, 6 * dt)

    // head tracks the puck (clamped)
    const dx = puckPos.x - _pos.x
    const dz = puckPos.z - _pos.z
    let headYaw = Math.atan2(dz, dx) - body.heading
    while (headYaw > Math.PI) headYaw -= Math.PI * 2
    while (headYaw < -Math.PI) headYaw += Math.PI * 2
    headYaw = Math.max(-1.1, Math.min(1.1, headYaw))
    this.headBone.rotation.y += (-headYaw - this.headBone.rotation.y) * Math.min(1, 8 * dt)

    this.anim.update(dt, speed)
  }
}
