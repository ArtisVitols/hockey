import { Vector3 } from 'three'
import type { PlayerIntent } from '../input/intent'
import { boardsSDF, boardsNormal } from './geometry'

const MAX_SPEED = 8.2 // m/s cruising
const SPRINT_SPEED = 11.5
const ACCEL = 10 // m/s^2 toward target speed
const BRAKE = 16 // when reversing direction
const GLIDE_FRICTION = 0.7 // m/s^2 passive glide decay
const TURN_RATE = 4.2 // rad/s at standstill; tightens with speed
export const SKATER_RADIUS = 0.42

// Kinematic skating controller: accelerates toward the intent direction, but
// velocity direction can only carve at a speed-limited turn rate — fast
// skaters turn wide, slow skaters pivot tight.
export class SkaterBody {
  readonly pos = new Vector3()
  readonly prevPos = new Vector3()
  readonly vel = new Vector3()
  heading = 0 // facing angle (radians, atan2(-z, x) convention: angle in xz)
  // while > 0, input is ignored (body-check knockdown)
  stunTimer = 0
  // action cooldowns (seconds remaining)
  pokeCooldown = 0
  checkCooldown = 0
  dekeCooldown = 0

  step(dt: number, intent: PlayerIntent): void {
    this.prevPos.copy(this.pos)
    this.pokeCooldown = Math.max(0, this.pokeCooldown - dt)
    this.checkCooldown = Math.max(0, this.checkCooldown - dt)
    this.dekeCooldown = Math.max(0, this.dekeCooldown - dt)

    if (this.stunTimer > 0) {
      this.stunTimer -= dt
      // stunned: no control, scrub speed hard
      const speed = Math.hypot(this.vel.x, this.vel.z)
      if (speed > 0) {
        const scale = Math.max(0, speed - 7 * dt) / speed
        this.vel.x *= scale
        this.vel.z *= scale
      }
      this.pos.x += this.vel.x * dt
      this.pos.z += this.vel.z * dt
      this.collideBoards()
      return
    }

    const speed = Math.hypot(this.vel.x, this.vel.z)
    const hasInput = Math.hypot(intent.moveX, intent.moveZ) > 0.01

    if (hasInput) {
      const targetSpeed = intent.sprint ? SPRINT_SPEED : MAX_SPEED
      const desiredAngle = Math.atan2(intent.moveZ, intent.moveX)

      if (speed < 0.3) {
        // from (near) standstill: accelerate straight toward the input
        const newSpeed = Math.min(targetSpeed, speed + ACCEL * dt)
        this.vel.x = Math.cos(desiredAngle) * newSpeed
        this.vel.z = Math.sin(desiredAngle) * newSpeed
      } else {
        const curAngle = Math.atan2(this.vel.z, this.vel.x)
        let diff = desiredAngle - curAngle
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2

        // carve: turn rate falls off with speed
        const maxTurn = (TURN_RATE / (1 + speed * 0.28)) * dt
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff))
        const newAngle = curAngle + turn

        // hard direction reversals brake instead of turning
        const reversing = Math.abs(diff) > Math.PI * 0.7
        const rate = reversing ? -BRAKE : speed < targetSpeed ? ACCEL : -ACCEL * 0.5
        const newSpeed = Math.max(0, Math.min(targetSpeed, speed + rate * dt))
        this.vel.x = Math.cos(newAngle) * newSpeed
        this.vel.z = Math.sin(newAngle) * newSpeed
      }
      this.heading = Math.atan2(this.vel.z, this.vel.x)
    } else if (speed > 0) {
      // glide: keep direction, bleed speed slowly
      const newSpeed = Math.max(0, speed - GLIDE_FRICTION * dt)
      const scale = speed > 0 ? newSpeed / speed : 0
      this.vel.x *= scale
      this.vel.z *= scale
    }

    this.pos.x += this.vel.x * dt
    this.pos.z += this.vel.z * dt
    this.collideBoards()
  }

  private collideBoards(): void {
    const sd = boardsSDF(this.pos.x, this.pos.z)
    if (sd > -SKATER_RADIUS) {
      const { nx, nz } = boardsNormal(this.pos.x, this.pos.z)
      const push = sd + SKATER_RADIUS
      this.pos.x += nx * push
      this.pos.z += nz * push
      const vn = this.vel.x * nx + this.vel.z * nz
      if (vn < 0) {
        this.vel.x -= vn * nx
        this.vel.z -= vn * nz
      }
    }
  }
}
