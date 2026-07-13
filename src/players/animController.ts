import {
  AnimationMixer,
  LoopOnce,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three'
import type { ClipSet } from './hockeyClips'

const CROSSFADE = 0.22

type LocoTier = 'idle' | 'glide' | 'skate' | 'sprint'

// Locomotion layer (idle ↔ glide ↔ skate ↔ sprint cross-faded by speed,
// timeScale synced to ground velocity) + one-shot action layer + a fall
// state that locks locomotion until the get-up finishes.
export class AnimController {
  private mixer: AnimationMixer
  private loco: Record<LocoTier, AnimationAction>
  private shot: AnimationAction
  private poke: AnimationAction
  private check: AnimationAction
  private fall: AnimationAction
  private getup: AnimationAction
  private stop: AnimationAction
  private butterfly: AnimationAction | null = null
  private tier: LocoTier = 'idle'
  private fallTimer = 0
  private stopCooldown = 0

  constructor(root: Object3D, clips: ClipSet) {
    this.mixer = new AnimationMixer(root)
    const loop = (c: AnimationClip) => this.mixer.clipAction(c)
    const once = (c: AnimationClip) => {
      const a = this.mixer.clipAction(c)
      a.setLoop(LoopOnce, 1)
      return a
    }
    this.loco = {
      idle: loop(clips.idle),
      glide: loop(clips.glide),
      skate: loop(clips.skate),
      sprint: loop(clips.sprint),
    }
    this.shot = once(clips.shot)
    this.poke = once(clips.poke)
    this.check = once(clips.check)
    this.fall = once(clips.fall)
    this.fall.clampWhenFinished = true
    this.getup = once(clips.getup)
    this.stop = once(clips.stop)
    if (clips.butterfly) {
      this.butterfly = once(clips.butterfly)
      this.butterfly.clampWhenFinished = true
    }
    this.loco.idle.play()
  }

  update(dt: number, speed: number, braking = false): void {
    this.stopCooldown = Math.max(0, this.stopCooldown - dt)
    if (braking && this.stopCooldown <= 0 && this.fallTimer <= 0) {
      this.stopCooldown = 0.9
      this.stop.reset().fadeIn(0.06).play()
      this.stop.fadeOut(0.45)
    }
    if (this.fallTimer > 0) {
      this.fallTimer -= dt
      if (this.fallTimer <= 0) {
        this.getup.reset().fadeIn(0.08).play()
        this.getup.fadeOut(0.9)
        this.fall.fadeOut(0.15)
        this.loco[this.tier].reset().fadeIn(0.4).play()
      }
      this.mixer.update(dt)
      return
    }

    const want: LocoTier = speed > 9 ? 'sprint' : speed > 3 ? 'skate' : speed > 0.55 ? 'glide' : 'idle'
    if (want !== this.tier) {
      const from = this.loco[this.tier]
      const to = this.loco[want]
      to.reset().play()
      to.crossFadeFrom(from, CROSSFADE, true)
      this.tier = want
    }
    // feet match the ice: stride cycles tuned for ~5.5 (skate) / 10 (sprint) m/s
    this.loco.skate.timeScale = Math.max(0.55, speed / 5.5)
    this.loco.sprint.timeScale = Math.max(0.7, speed / 10)
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

  // full knockdown: fall now, get up automatically (~1.5 s total)
  playStumble(): void {
    this.fallTimer = 0.65
    this.fall.reset().fadeIn(0.06).play()
    this.loco[this.tier].fadeOut(0.15)
  }

  playButterfly(): void {
    if (!this.butterfly) return
    this.butterfly.reset().fadeIn(0.08).play()
    this.butterfly.fadeOut(1.1)
  }
}
