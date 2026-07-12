// Fixed-timestep simulation loop (120 Hz) with render interpolation alpha.
export class Engine {
  static readonly STEP = 1 / 120
  private accumulator = 0

  // Advances the sim zero or more fixed steps, returns the interpolation
  // alpha (0..1) between the previous and current sim states for rendering.
  advance(frameDt: number, step: (dt: number) => void): number {
    this.accumulator += Math.min(frameDt, 0.25)
    while (this.accumulator >= Engine.STEP) {
      step(Engine.STEP)
      this.accumulator -= Engine.STEP
    }
    return this.accumulator / Engine.STEP
  }
}
