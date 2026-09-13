// Input is normalised into a single shape the car reads each frame, so keyboard,
// touch and gamepad all feed the same code path.
export class Controls {
  constructor() {
    this.state = { throttle: 0, steer: 0, handbrake: false }
    this.keys = new Set()
    this.touch = { forward: false, back: false, left: false, right: false, brake: false }
    this.lastInputAt = 0
    this.hasDriven = false
    // Camera zoom multiplier, remembered between visits.
    this.zoom = clampZoom(Number(readStored('zoom')) || 1)
    this._listeners = { interact: [], reset: [], camera: [], nitro: [] }

    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
      if (this.keys.has(k)) return
      this.keys.add(k)
      if (k === 'e' || k === 'enter') this._emit('interact')
      if (k === 'r') this._emit('reset')
      if (k === 'c') this._emit('camera')
      if (k === 'shift') this._emit('nitro')
      if (k === '+' || k === '=') this.setZoom(this.zoom / 1.12)
      if (k === '-' || k === '_') this.setZoom(this.zoom * 1.12)
    }
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase())
    this._onBlur = () => this.keys.clear()

    this._onWheel = (e) => {
      e.preventDefault()
      this.setZoom(this.zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08))
    }

    // Pinch to zoom, tracked as the distance between the first two touches.
    this._pinch = null
    this._onTouchStart = (e) => {
      if (e.touches.length === 2) this._pinch = touchGap(e.touches)
    }
    this._onTouchMove = (e) => {
      if (e.touches.length !== 2 || !this._pinch) return
      const gap = touchGap(e.touches)
      if (gap > 0) this.setZoom(this.zoom * (this._pinch / gap))
      this._pinch = gap
    }
    this._onTouchEnd = () => {
      this._pinch = null
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onBlur)
    window.addEventListener('wheel', this._onWheel, { passive: false })
    window.addEventListener('touchstart', this._onTouchStart, { passive: true })
    window.addEventListener('touchmove', this._onTouchMove, { passive: true })
    window.addEventListener('touchend', this._onTouchEnd, { passive: true })
  }

  setZoom(value) {
    this.zoom = clampZoom(value)
    writeStored('zoom', this.zoom.toFixed(3))
    return this.zoom
  }

  on(event, fn) {
    this._listeners[event]?.push(fn)
  }

  _emit(event) {
    for (const fn of this._listeners[event] || []) fn()
  }

  /** Wire up the on-screen buttons rendered by the UI layer. */
  bindTouch(root) {
    const map = {
      'btn-forward': 'forward',
      'btn-back': 'back',
      'btn-left': 'left',
      'btn-right': 'right',
      'btn-brake': 'brake',
    }
    const nitro = root.querySelector('#btn-nitro')
    if (nitro) {
      nitro.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        this._emit('nitro')
      })
    }

    for (const [id, key] of Object.entries(map)) {
      const el = root.querySelector('#' + id)
      if (!el) continue
      const set = (v) => (e) => {
        e.preventDefault()
        this.touch[key] = v
      }
      el.addEventListener('pointerdown', set(true))
      el.addEventListener('pointerup', set(false))
      el.addEventListener('pointercancel', set(false))
      el.addEventListener('pointerleave', set(false))
    }
  }

  sample(dt) {
    const k = this.keys
    const kf = k.has('w') || k.has('arrowup') || k.has('z')
    const kb = k.has('s') || k.has('arrowdown')
    const kl = k.has('a') || k.has('arrowleft') || k.has('q')
    const kr = k.has('d') || k.has('arrowright')

    let throttle = 0
    let steer = 0
    if (kf || this.touch.forward) throttle += 1
    if (kb || this.touch.back) throttle -= 1
    if (kl || this.touch.left) steer -= 1
    if (kr || this.touch.right) steer += 1
    let handbrake = k.has(' ') || this.touch.brake

    // Gamepad overrides when a stick or trigger is actually being moved.
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    for (const pad of pads) {
      if (!pad) continue
      const lx = Math.abs(pad.axes[0]) > 0.14 ? pad.axes[0] : 0
      const rt = pad.buttons[7]?.value || 0
      const lt = pad.buttons[6]?.value || 0
      if (lx) steer = lx
      if (rt > 0.05 || lt > 0.05) throttle = rt - lt
      if (pad.buttons[0]?.pressed) handbrake = true
      break
    }

    this.state.throttle = Math.max(-1, Math.min(1, throttle))
    this.state.steer = Math.max(-1, Math.min(1, steer))
    this.state.handbrake = handbrake
    if (this.state.throttle || this.state.steer) this.hasDriven = true
    return this.state
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('blur', this._onBlur)
    window.removeEventListener('wheel', this._onWheel)
    window.removeEventListener('touchstart', this._onTouchStart)
    window.removeEventListener('touchmove', this._onTouchMove)
    window.removeEventListener('touchend', this._onTouchEnd)
  }
}

const clampZoom = (v) => Math.min(2.4, Math.max(0.6, v))

const touchGap = (touches) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

// Storage is a nicety, not a requirement — private windows and blocked site
// data both throw, and the game must start regardless.
function readStored(key) {
  try {
    return localStorage.getItem('portfolio:' + key)
  } catch {
    return null
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem('portfolio:' + key, value)
  } catch {
    /* ignore */
  }
}
