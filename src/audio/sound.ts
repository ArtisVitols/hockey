// All sounds synthesized with WebAudio — no asset files. The context starts
// suspended; resume() is called on the first user gesture.
export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private crowdGain: GainNode | null = null

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      this.ctx = new AudioContext()
    } catch {
      return null
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.7
    this.master.connect(this.ctx.destination)
    this.startCrowdBed()
    return this.ctx
  }

  resume(): void {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  }

  // continuous filtered-noise crowd murmur; swells on excitement
  private startCrowdBed(): void {
    const ctx = this.ctx!
    const len = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // brown-ish noise
      last = (last + (Math.random() * 2 - 1) * 0.04) * 0.98
      data[i] = last * 4
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700
    bp.Q.value = 0.4
    this.crowdGain = ctx.createGain()
    this.crowdGain.gain.value = 0.05
    src.connect(bp).connect(this.crowdGain).connect(this.master!)
    src.start()
  }

  crowdSwell(intensity = 0.35, seconds = 2.5): void {
    if (!this.ctx || !this.crowdGain) return
    const t = this.ctx.currentTime
    const g = this.crowdGain.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(intensity, t + 0.25)
    g.exponentialRampToValueAtTime(0.05, t + seconds)
  }

  goalHorn(): void {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    for (const [freq, detune] of [
      [178, 0],
      [178, 8],
      [267, -6],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.16, t + 0.05)
      g.gain.setValueAtTime(0.16, t + 1.3)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8)
      osc.connect(g).connect(this.master!)
      osc.start(t)
      osc.stop(t + 1.9)
    }
    this.crowdSwell(0.5, 4)
  }

  whistle(): void {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(2350, t)
    // pea-whistle warble
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 28
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 160
    lfo.connect(lfoGain).connect(osc.frequency)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.05, t)
    g.gain.setValueAtTime(0.05, t + 0.35)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    osc.connect(g).connect(this.master!)
    osc.start(t)
    lfo.start(t)
    osc.stop(t + 0.5)
    lfo.stop(t + 0.5)
  }

  // impact thud; sharper and louder with speed
  boardHit(speed: number, pan = 0): void {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const dur = 0.09
    const buffer = ctx.createBuffer(1, Math.ceil(dur * ctx.sampleRate), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.25))
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 300 + Math.min(speed, 40) * 60
    const g = ctx.createGain()
    g.gain.value = Math.min(0.5, 0.04 + speed * 0.012)
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    src.connect(lp).connect(g).connect(panner).connect(this.master!)
    src.start(t)
  }
}
