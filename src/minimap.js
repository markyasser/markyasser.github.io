import { ZONES, BOUNDS } from './world.js'

const VIEW = BOUNDS + 12

// Small top-down map. Redrawn every frame — it is only ~300px square, and the
// static layer is pre-rendered to an offscreen canvas so the per-frame cost is
// one blit plus a handful of dots.
export class Minimap {
  constructor(canvas, { shards }) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.shards = shards
    this.size = canvas.width
    this.base = document.createElement('canvas')
    this.base.width = this.base.height = this.size
    this._drawBase()
  }

  _p(v) {
    return ((v + VIEW) / (VIEW * 2)) * this.size
  }

  _drawBase() {
    const ctx = this.base.getContext('2d')
    const s = this.size
    ctx.clearRect(0, 0, s, s)

    ctx.fillStyle = '#132339'
    ctx.fillRect(0, 0, s, s)

    // Roads.
    ctx.strokeStyle = '#41597f'
    ctx.lineWidth = s * 0.035
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(this._p(0), this._p(-90))
    ctx.lineTo(this._p(0), this._p(58))
    ctx.moveTo(this._p(-52), this._p(0))
    ctx.lineTo(this._p(86), this._p(0))
    ctx.stroke()

    ctx.lineWidth = s * 0.024
    ctx.beginPath()
    ctx.arc(this._p(0), this._p(0), (50 / (VIEW * 2)) * s, 0, Math.PI * 2)
    ctx.stroke()

    // Zone blobs.
    const colors = {
      hub: '#cddcf5', experience: '#f5806b', skills: '#3fc9bf',
      education: '#8f83f7', contact: '#f5b878', stunt: '#ef7ba8',
    }
    for (const [key, z] of Object.entries(ZONES)) {
      ctx.fillStyle = colors[key] || '#22304a'
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.arc(this._p(z.x), this._p(z.z), s * (key === 'hub' ? 0.026 : 0.033), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Border.
    ctx.strokeStyle = 'rgba(160,190,240,0.3)'
    ctx.lineWidth = s * 0.012
    ctx.strokeRect(this._p(-BOUNDS), this._p(-BOUNDS), this._p(BOUNDS) - this._p(-BOUNDS), this._p(BOUNDS) - this._p(-BOUNDS))
  }

  draw(car) {
    const ctx = this.ctx
    const s = this.size
    ctx.clearRect(0, 0, s, s)
    ctx.drawImage(this.base, 0, 0)

    for (const shard of this.shards) {
      if (shard.collected) continue
      ctx.fillStyle = '#ffd27a'
      ctx.beginPath()
      ctx.arc(this._p(shard.position.x), this._p(shard.position.z), s * 0.013, 0, Math.PI * 2)
      ctx.fill()
    }

    const x = this._p(car.position.x)
    const y = this._p(car.position.z)
    const f = car.forward()
    const angle = Math.atan2(f.x, f.z)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-angle)
    ctx.fillStyle = '#f5806b'
    ctx.strokeStyle = '#eaf1ff'
    ctx.lineWidth = s * 0.009
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.033)
    ctx.lineTo(s * 0.023, s * 0.026)
    ctx.lineTo(0, s * 0.012)
    ctx.lineTo(-s * 0.023, s * 0.026)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
