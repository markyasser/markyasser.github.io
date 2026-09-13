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
    // Kept low deliberately: at Q=3 a static low sawtooth resonates into
    // something that sounds unnervingly like a human drone.
    this.filter.Q.value = 0.7

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

  /** Switch sound on. Safe to call only from inside a user gesture. */
  enable() {
    this._init()
    if (!this.ctx) return false
    this.enabled = true
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.08)
    return true
  }

  toggle() {
    this._init()
    if (!this.ctx) return false
    this.enabled = !this.enabled
    if (this.enabled && this.ctx.state === 'suspended') this.ctx.resume()
    this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.08)
    return this.enabled
  }

  /**
   * The engine note follows the revs, not road speed — that is what makes a
   * gearbox audible: the pitch climbs through a gear and drops on the shift.
   */
  update(speed, throttle, rev = null, shifting = false) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const effort = Math.abs(throttle)
    const revs = rev === null ? Math.min(1, speed / 30) : rev

    // A little wander keeps the idle from sitting on one dead pitch.
    const wobble = Math.sin(t * 7.3) * 1.6 + Math.sin(t * 3.1) * 0.9
    const base = 62 + revs * 196 + effort * 14 + wobble
    this.osc1.frequency.setTargetAtTime(base, t, 0.05)
    this.osc2.frequency.setTargetAtTime(base * 1.51, t, 0.05)
    this.filter.frequency.setTargetAtTime(300 + revs * 2300 + effort * 420, t, 0.07)

    // Near-silent when parked, and backed right off mid-shift so the pause in
    // the drive is heard as well as felt.
    const idle = 0.012
    const load = shifting ? 0.25 : 1
    this.engineGain.gain.setTargetAtTime((idle + revs * 0.115 + effort * 0.055) * load, t, 0.05)

    const road = Math.min(1, speed / 30)
    this.noiseGain.gain.setTargetAtTime(road * 0.04, t, 0.15)
    this.noiseFilter.frequency.setTargetAtTime(500 + road * 1800, t, 0.15)
  }

  /** The clunk of a gear going home. Up is a sharper knock than down. */
  shift(up = true) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    this._noise(t, {
      duration: up ? 0.075 : 0.1,
      from: up ? 2400 : 1500,
      to: 420,
      q: 1.8,
      gain: 0.13,
    })
    this._tone(t, {
      freq: up ? 210 : 150,
      endFreq: up ? 96 : 78,
      duration: 0.11,
      gain: 0.12,
    })
  }

  // --- impact voices -------------------------------------------------------
  // Everything below is synthesised: no sample files, in keeping with the rest
  // of the project. Each material gets its own envelope and filter so a tree,
  // a rock and a container are distinguishable without looking.

  /** Shaped noise burst — the backbone of most impact sounds. */
  _noise(t, { duration, from, to, q = 1, gain = 0.25, type = 'bandpass', curve = 2 }) {
    const len = Math.max(1, Math.ceil(this.ctx.sampleRate * duration))
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const fade = 1 - i / len
      data[i] = (Math.random() * 2 - 1) * Math.pow(fade, curve)
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(from, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + duration)
    filter.Q.value = q
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.02)
    return g
  }

  /** A pitched body, for things that ring. */
  _tone(t, { freq, endFreq = freq, duration, gain = 0.2, type = 'triangle', delay = 0 }) {
    const at = t + delay
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, at)
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + duration)
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    osc.connect(g)
    g.connect(this.master)
    osc.start(at)
    osc.stop(at + duration + 0.02)
  }

  /** Dry knock: trees, crates, anything wooden. */
  wood(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const i = Math.min(1.6, intensity)
    this._noise(t, { duration: 0.16, from: 1900, to: 380, q: 1.4, gain: 0.2 * i })
    this._tone(t, { freq: 180, endFreq: 92, duration: 0.17, gain: 0.16 * i })
  }

  /** Dull, gritty, and low: rocks. */
  stone(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const i = Math.min(1.6, intensity)
    this._noise(t, { duration: 0.26, from: 900, to: 140, q: 0.7, gain: 0.24 * i, curve: 1.4 })
    this._tone(t, { freq: 92, endFreq: 48, duration: 0.3, gain: 0.2 * i, type: 'sine' })
  }

  /** A soft rustle: bushes and foliage. */
  leaves(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    this._noise(t, { duration: 0.3, from: 5200, to: 2400, q: 0.6, gain: 0.1 * Math.min(1.4, intensity), curve: 1.1 })
  }

  /** Clang with a tail: containers, lamp posts, barrels. */
  metal(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const i = Math.min(1.6, intensity)
    this._noise(t, { duration: 0.12, from: 3600, to: 900, q: 2, gain: 0.16 * i })
    // Inharmonic partials are what make metal sound like metal.
    for (const [f, d, g] of [[430, 0.7, 0.12], [611, 0.55, 0.09], [917, 0.4, 0.06]]) {
      this._tone(t, { freq: f, duration: d, gain: g * i, type: 'triangle' })
    }
  }

  /** Light tick: cones and pins. */
  plastic(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    this._noise(t, { duration: 0.09, from: 2600, to: 1100, q: 2.2, gain: 0.14 * Math.min(1.5, intensity) })
    this._tone(t, { freq: 640, endFreq: 300, duration: 0.1, gain: 0.1 * Math.min(1.5, intensity) })
  }

  /** Hollow pock: the football. */
  ball(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const i = Math.min(1.5, intensity)
    this._tone(t, { freq: 260, endFreq: 110, duration: 0.2, gain: 0.24 * i, type: 'sine' })
    this._noise(t, { duration: 0.08, from: 1400, to: 500, q: 1.2, gain: 0.12 * i })
  }

  /** Two-tone telephone ring, twice. */
  ring() {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    for (const burst of [0, 0.45]) {
      for (let i = 0; i < 9; i++) {
        // Alternating pair, warbling the way a bell does.
        this._tone(t, {
          freq: i % 2 ? 440 : 480,
          duration: 0.042,
          gain: 0.17,
          type: 'square',
          delay: burst + i * 0.042,
        })
      }
    }
  }

  /** Paper: a flutter of short, airy bursts. */
  mail() {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    for (let i = 0; i < 6; i++) {
      this._noise(t + i * 0.07, {
        duration: 0.12,
        from: 4200 + Math.random() * 2500,
        to: 1600,
        q: 0.8,
        gain: 0.09,
        curve: 1.2,
      })
    }
  }

  /** Tyre scrub, while the car is sliding. */
  screech(intensity = 1) {
    if (!this.enabled || !this.ctx) return
    const now = this.ctx.currentTime
    if (now - (this._lastScreech || 0) < 0.18) return
    this._lastScreech = now
    this._noise(now, {
      duration: 0.3,
      from: 1300,
      to: 2100,
      q: 6,
      gain: 0.1 * Math.min(1.4, intensity),
      curve: 0.8,
    })
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

  /** A short fanfare, for a goal. */
  fanfare() {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      const at = t + i * 0.11
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.19, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(at)
      osc.stop(at + 0.6)
    })
    // Crackle under the melody, as the shells go up.
    for (let i = 0; i < 3; i++) setTimeout(() => this.crack(0.7), 120 + i * 340)
  }

  /** Nitrous: a rising hiss with a thump under it. */
  whoosh() {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime
    const dur = 0.7
    const len = Math.ceil(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, t)
    filter.frequency.exponentialRampToValueAtTime(5200, t + dur)
    filter.Q.value = 2.5
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.32, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t)
    src.stop(t + dur)
    this.thud(1.4)
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
