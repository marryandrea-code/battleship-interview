/**
 * Tiny Web Audio synthesiser so the game ships with zero audio assets.
 * Every sound is a short envelope on an oscillator or noise buffer.
 */
export type SoundName = 'fire' | 'miss' | 'hit' | 'sunk' | 'win' | 'lose' | 'place' | 'click'

const MUTE_KEY = 'battleship.muted'

class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      this.muted = false
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called from a user gesture on first use so the context can start. */
  private ensure(): { ctx: AudioContext; master: GainNode } | null {
    if (typeof window === 'undefined') return null
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!this.ctx) {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.35
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return { ctx: this.ctx, master: this.master! }
  }

  play(name: SoundName) {
    if (this.muted) return
    const audio = this.ensure()
    if (!audio) return
    const { ctx, master } = audio
    const t = ctx.currentTime
    switch (name) {
      case 'click':
        this.tone(ctx, master, 'square', 880, 0.04, t, 0.08)
        break
      case 'place':
        this.tone(ctx, master, 'triangle', 330, 0.12, t, 0.2)
        this.tone(ctx, master, 'triangle', 495, 0.1, t + 0.06, 0.2)
        break
      case 'fire':
        this.noise(ctx, master, 0.18, t, 1800, 0.25)
        this.sweep(ctx, master, 'sawtooth', 220, 60, 0.25, t, 0.2)
        break
      case 'miss':
        this.noise(ctx, master, 0.35, t, 600, 0.3)
        this.sweep(ctx, master, 'sine', 300, 120, 0.3, t, 0.15)
        break
      case 'hit':
        this.noise(ctx, master, 0.4, t, 900, 0.5)
        this.sweep(ctx, master, 'square', 160, 40, 0.4, t, 0.35)
        break
      case 'sunk':
        this.noise(ctx, master, 0.8, t, 400, 0.6)
        this.sweep(ctx, master, 'sawtooth', 140, 30, 0.9, t, 0.4)
        this.tone(ctx, master, 'sine', 55, 0.9, t + 0.1, 0.5)
        break
      case 'win':
        ;[523, 659, 784, 1047].forEach((f, i) =>
          this.tone(ctx, master, 'triangle', f, 0.35, t + i * 0.14, 0.25),
        )
        break
      case 'lose':
        ;[392, 349, 311, 233].forEach((f, i) =>
          this.tone(ctx, master, 'sawtooth', f, 0.4, t + i * 0.22, 0.18),
        )
        break
    }
  }

  private tone(
    ctx: AudioContext,
    out: AudioNode,
    type: OscillatorType,
    freq: number,
    dur: number,
    at: number,
    vol: number,
  ) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, at)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  private sweep(
    ctx: AudioContext,
    out: AudioNode,
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    at: number,
    vol: number,
  ) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + dur)
    gain.gain.setValueAtTime(vol, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  private noise(
    ctx: AudioContext,
    out: AudioNode,
    dur: number,
    at: number,
    cutoff: number,
    vol: number,
  ) {
    const length = Math.ceil(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoff, at)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(filter).connect(gain).connect(out)
    src.start(at)
    src.stop(at + dur + 0.02)
  }
}

export const synth = new Synth()
