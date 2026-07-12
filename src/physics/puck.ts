import { Vector3 } from 'three'
import { PUCK, GOAL } from '../config'
import { boardsSDF, boardsNormal } from './geometry'

const GRAVITY = 9.81
const ICE_BOUNCE = 0.45

// 2.5D puck: slides on the ice plane, can be lifted by shots, bounces off
// boards, goal posts, and the ice.
export class Puck {
  readonly pos = new Vector3(0, PUCK.height / 2, 0)
  readonly prevPos = new Vector3(0, PUCK.height / 2, 0)
  readonly vel = new Vector3()
  onBoardHit: ((speed: number, x: number, z: number) => void) | null = null

  step(dt: number): void {
    this.prevPos.copy(this.pos)

    const airborne = this.pos.y > PUCK.height / 2 + 0.001

    // ice friction only while sliding on the surface
    if (!airborne) {
      const speed = Math.hypot(this.vel.x, this.vel.z)
      if (speed > 0) {
        const scale = Math.max(0, speed - PUCK.friction * dt) / speed
        this.vel.x *= scale
        this.vel.z *= scale
      }
    }

    this.vel.y -= GRAVITY * dt
    this.pos.addScaledVector(this.vel, dt)

    // ice plane
    if (this.pos.y < PUCK.height / 2) {
      this.pos.y = PUCK.height / 2
      if (this.vel.y < 0) this.vel.y = -this.vel.y * ICE_BOUNCE
      if (Math.abs(this.vel.y) < 0.4) this.vel.y = 0
    }

    // goal posts (vertical cylinders at the goal mouth)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = sx * GOAL.lineX
        const pz = (sz * GOAL.width) / 2
        const dx = this.pos.x - px
        const dz = this.pos.z - pz
        const d = Math.hypot(dx, dz)
        const minD = GOAL.postRadius + PUCK.radius
        if (d < minD && d > 1e-6 && this.pos.y < GOAL.height) {
          const nx = dx / d
          const nz = dz / d
          this.pos.x = px + nx * minD
          this.pos.z = pz + nz * minD
          const vn = this.vel.x * nx + this.vel.z * nz
          if (vn < 0) {
            this.vel.x -= 1.8 * vn * nx
            this.vel.z -= 1.8 * vn * nz
          }
        }
      }
    }

    // netting: heavy damping inside the goal volume so pucks die in the net
    for (const sx of [-1, 1]) {
      const behindLine = sx > 0 ? this.pos.x > GOAL.lineX + 0.05 : this.pos.x < -GOAL.lineX - 0.05
      const inBox =
        behindLine &&
        Math.abs(this.pos.x) < GOAL.lineX + GOAL.depth &&
        Math.abs(this.pos.z) < GOAL.width / 2 &&
        this.pos.y < GOAL.height
      if (inBox) {
        const damp = Math.max(0, 1 - 8 * dt)
        this.vel.multiplyScalar(damp)
        // back of the net
        const backX = GOAL.lineX + GOAL.depth - PUCK.radius
        if (Math.abs(this.pos.x) > backX) {
          this.pos.x = Math.sign(this.pos.x) * backX
          this.vel.x *= -0.2
        }
      }
    }

    // boards
    const sd = boardsSDF(this.pos.x, this.pos.z)
    if (sd > -PUCK.radius) {
      const { nx, nz } = boardsNormal(this.pos.x, this.pos.z)
      const push = sd + PUCK.radius
      this.pos.x += nx * push
      this.pos.z += nz * push
      const vn = this.vel.x * nx + this.vel.z * nz
      if (vn < 0) {
        const tx = this.vel.x - vn * nx
        const tz = this.vel.z - vn * nz
        this.vel.x = tx * PUCK.tangentialDamping - vn * nx * PUCK.boardRestitution
        this.vel.z = tz * PUCK.tangentialDamping - vn * nz * PUCK.boardRestitution
        if (-vn > 2.5) this.onBoardHit?.(-vn, this.pos.x, this.pos.z)
      }
    }
  }

  shootToward(target: Vector3, power: number): void {
    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const len = Math.hypot(dx, dz)
    if (len < 1e-4) return
    const speed = Math.min(PUCK.maxSpeed, power)
    this.vel.x = (dx / len) * speed
    this.vel.z = (dz / len) * speed
  }
}
