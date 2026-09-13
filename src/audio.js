// Fully procedural audio — no asset files. Everything is synthesised from
// oscillators and a noise buffer so the whole site stays a single JS bundle.
export class Audio {
  constructor() {
    this.enabled = false
    this.ctx = null
    this.started = false
  }

  _init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.ctx.destination)

    // Engine: two detuned saws through a lowpass that opens with revs.
    this.engineGain = this.ctx.createGain()
    this.engineGain.gain.value = 0.0
    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 420
    this.filter.Q.value = 3

    this.osc1 = this.ctx.createOscillator()
    this.osc1.type = 'sawtooth'
    this.osc1.frequency.value = 60
    this.osc2 = this.ctx.createOscillator()
    this.osc2.type = 'square'
    this.osc2.frequency.value = 90
    const sub = this.ctx.createGain()
    sub.gain.value = 0.35
    this.osc2.connect(sub)

    this.osc1.connect(this.filter)
    sub.connect(this.filter)
    this.filter.connect(this.engineGain)
    this.engineGain.connect(this.master)
    this.osc1.start()
    this.osc2.start()

    // Tyre/road noise.
    const len = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6
    this.noise = this.ctx.createBufferSource()
    this.noise.buffer = buffer
    this.noise.loop = true
    this.noiseFilter = this.ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 900
    this.noiseGain = this.ctx.createGain()
    this.noiseGain.gain.value = 0
    this.noise.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.master)
    this.noise.start()
  }

  toggle() {
    this._init()
    if (!this.ctx) return false
    this.enabled = !this.enabled
    if (this.enabled && this.ctx.state === 'suspended') this.ctx.resume()
    this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.08)
    return this.enabled
  }

  update(speed, throttle) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const rev = Math.min(1, speed / 26)
    const base = 52 + rev * 128 + Math.abs(throttle) * 22
    this.osc1.frequency.setTargetAtTime(base, t, 0.08)
    this.osc2.frequency.setTargetAtTime(base * 1.51, t, 0.08)
    this.filter.frequency.setTargetAtTime(380 + rev * 1500 + Math.abs(throttle) * 400, t, 0.1)
    this.engineGain.gain.setTargetAtTime(0.06 + rev * 0.1 + Math.abs(throttle) * 0.05, t, 0.12)
    this.noiseGain.gain.setTargetAtTime(rev * 0.035, t, 0.15)
    this.noiseFilter.frequency.setTargetAtTime(500 + rev * 1600, t, 0.15)
  }

  /** Short percussive hit when the car connects with a prop. */
  thud(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(150 * (0.8 + Math.random() * 0.4), t)
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.16)
    gain.gain.setValueAtTime(Math.min(0.4, 0.12 * intensity), t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.25)
  }

  /** Splintering noise burst for something breaking apart. */
  crack(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const dur = 0.34

    const len = Math.ceil(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      // Decaying noise, roughened so it reads as splintering rather than a hiss.
      const fade = 1 - i / len
      data[i] = (Math.random() * 2 - 1) * fade * fade * (i % 7 < 3 ? 1 : 0.4)
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2600, t)
    filter.frequency.exponentialRampToValueAtTime(420, t + dur)
    filter.Q.value = 1.1
    const gain = this.ctx.createGain()
    gain.gain.value = Math.min(0.5, 0.3 * intensity)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t)
    src.stop(t + dur)

    this.thud(intensity * 1.6)
  }

  /** Rising arpeggio for shard pickups. */
  chime() {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    ;[880, 1108, 1318].forEach((f, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0, t + i * 0.07)
      gain.gain.linearRampToValueAtTime(0.16, t + i * 0.07 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.4)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t + i * 0.07)
      osc.stop(t + i * 0.07 + 0.45)
    })
  }
}
