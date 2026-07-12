import {
  CapsuleGeometry,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { SkaterBody } from '../physics/skaterBody'

// M2 stand-in until the rigged players land in M3: a jersey-colored capsule
// with a stick so heading is readable.
export class PlaceholderSkater {
  readonly group = new Group()

  constructor(color: number) {
    const body = new Mesh(
      new CapsuleGeometry(0.34, 0.9, 4, 12),
      new MeshStandardMaterial({ color, roughness: 0.7 }),
    )
    body.position.y = 0.85
    body.castShadow = true
    this.group.add(body)

    const helmet = new Mesh(
      new CapsuleGeometry(0.16, 0.05, 4, 10),
      new MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4 }),
    )
    helmet.position.y = 1.62
    this.group.add(helmet)

    const stickMat = new MeshStandardMaterial({ color: 0x8a6b3c, roughness: 0.8 })
    const shaft = new Mesh(new CylinderGeometry(0.02, 0.02, 1.35, 6), stickMat)
    shaft.position.set(0.75, 0.55, 0.25)
    shaft.rotation.z = -Math.PI / 3.2
    this.group.add(shaft)
    const blade = new Mesh(new BoxGeometry(0.35, 0.03, 0.08), stickMat)
    blade.position.set(1.05, 0.03, 0.25)
    this.group.add(blade)
  }

  sync(body: SkaterBody, alpha: number, tmp: Vector3): void {
    tmp.copy(body.prevPos).lerp(body.pos, alpha)
    this.group.position.set(tmp.x, 0, tmp.z)
    this.group.rotation.y = -body.heading
  }
}
