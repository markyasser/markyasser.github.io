import * as THREE from 'three'
import { CSS } from './palette.js'

const FONT_STACK = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const cache = new Map()

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function finish(canvas, renderer, { transparent = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8
  tex.needsUpdate = true
  if (transparent) tex.premultiplyAlpha = false
  return tex
}

/** Wrap text to a pixel width, returning lines. */
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Shrink the font until the text fits on `maxLines` lines within maxWidth. */
function fitLines(ctx, text, maxWidth, startSize, weight, maxLines) {
  let size = startSize
  let lines
  for (;;) {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`
    lines = wrap(ctx, text, maxWidth)
    if (lines.length <= maxLines || size <= 12) break
    size -= 2
  }
  return { size, lines }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * A billboard sign face: cream panel, coloured header bar, title + subtitle.
 * Used for company buildings and zone gateways.
 */
export function signTexture(renderer, {
  title,
  subtitle = '',
  meta = '',
  accent = CSS.coral,
  width = 1024,
  height = 512,
  bg = CSS.cream,
}) {
  const key = `sign|${title}|${subtitle}|${meta}|${accent}|${width}x${height}|${bg}`
  if (cache.has(key)) return cache.get(key)

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Accent header band.
  const band = height * 0.2
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, width, band)

  // Inner border so the panel reads as a physical sign.
  ctx.strokeStyle = 'rgba(34,48,74,0.16)'
  ctx.lineWidth = Math.round(width * 0.012)
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth)

  if (meta) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = `700 ${Math.round(band * 0.4)}px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '2px'
    ctx.fillText(meta.toUpperCase(), width * 0.05, band * 0.52)
    ctx.letterSpacing = '0px'
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const inner = width * 0.88
  const titleFit = fitLines(ctx, title, inner, Math.round(height * 0.24), 800, 2)
  const subFit = subtitle
    ? fitLines(ctx, subtitle, inner, Math.round(height * 0.115), 500, 2)
    : { size: 0, lines: [] }

  const titleLH = titleFit.size * 1.08
  const subLH = subFit.size * 1.25
  const blockH = titleFit.lines.length * titleLH + (subFit.lines.length ? subFit.lines.length * subLH + height * 0.05 : 0)
  let y = band + (height - band) / 2 - blockH / 2 + titleLH / 2

  ctx.fillStyle = CSS.ink
  ctx.font = `800 ${titleFit.size}px ${FONT_STACK}`
  for (const line of titleFit.lines) {
    ctx.fillText(line, width / 2, y)
    y += titleLH
  }

  if (subFit.lines.length) {
    y += height * 0.05 - titleLH + subLH
    ctx.fillStyle = CSS.muted
    ctx.font = `500 ${subFit.size}px ${FONT_STACK}`
    for (const line of subFit.lines) {
      ctx.fillText(line, width / 2, y)
      y += subLH
    }
  }

  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** The big hero sign at spawn: dark panel, huge name, accent rule. */
export function heroTexture(renderer, { name, title, tagline }) {
  const key = `hero|${name}|${title}|${tagline}`
  if (cache.has(key)) return cache.get(key)

  const width = 2048
  const height = 1024
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0, '#2b3b5a')
  grad.addColorStop(1, '#1a2435')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // Marquee bulbs around the edge.
  const pad = 42
  const step = 86
  ctx.fillStyle = CSS.amber
  const dot = (x, y) => {
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let x = pad; x <= width - pad; x += step) {
    dot(x, pad)
    dot(x, height - pad)
  }
  for (let y = pad + step; y <= height - pad - step; y += step) {
    dot(pad, y)
    dot(width - pad, y)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = CSS.cream
  ctx.letterSpacing = '10px'
  ctx.font = `800 210px ${FONT_STACK}`
  ctx.fillText(name.toUpperCase(), width / 2, height * 0.42)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = CSS.coral
  ctx.fillRect(width / 2 - 210, height * 0.585, 420, 10)

  ctx.fillStyle = 'rgba(247,243,232,0.92)'
  ctx.letterSpacing = '8px'
  ctx.font = `600 76px ${FONT_STACK}`
  ctx.fillText(title.toUpperCase(), width / 2, height * 0.7)

  ctx.fillStyle = 'rgba(247,243,232,0.6)'
  ctx.letterSpacing = '4px'
  ctx.font = `500 48px ${FONT_STACK}`
  ctx.fillText(tagline.toUpperCase(), width / 2, height * 0.82)
  ctx.letterSpacing = '0px'

  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** A skill crate face — coloured square with the skill name across it. */
export function crateTexture(renderer, { label, color }) {
  const key = `crate|${label}|${color}`
  if (cache.has(key)) return cache.get(key)

  const size = 512
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  // Plank shading gives the cube a crate-like read at a glance.
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  ctx.fillRect(0, 0, size, 46)
  ctx.fillRect(0, size - 46, size, 46)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(0, 46, size, 10)

  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 14
  ctx.strokeRect(7, 7, size - 14, size - 14)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const { size: fs, lines } = fitLines(ctx, label, size * 0.84, 92, 800, 3)
  ctx.font = `800 ${fs}px ${FONT_STACK}`
  const lh = fs * 1.12
  let y = size / 2 - ((lines.length - 1) * lh) / 2

  for (const line of lines) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.fillText(line, size / 2 + 3, y + 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line, size / 2, y)
    y += lh
  }

  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** Big number + caption, for the roadside stat markers. */
export function statTexture(renderer, { value, label, detail, accent = CSS.coral }) {
  const key = `stat|${value}|${label}|${detail}|${accent}`
  if (cache.has(key)) return cache.get(key)

  const width = 768
  const height = 768
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = CSS.cream
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, width, 28)
  ctx.fillRect(0, height - 28, width, 28)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = accent
  const vf = fitLines(ctx, value, width * 0.84, 300, 800, 1)
  ctx.font = `800 ${vf.size}px ${FONT_STACK}`
  ctx.fillText(value, width / 2, height * 0.4)

  ctx.fillStyle = CSS.ink
  const lf = fitLines(ctx, label.toUpperCase(), width * 0.84, 74, 700, 2)
  ctx.font = `700 ${lf.size}px ${FONT_STACK}`
  ctx.letterSpacing = '3px'
  let y = height * 0.63
  for (const line of lf.lines) {
    ctx.fillText(line, width / 2, y)
    y += lf.size * 1.2
  }
  ctx.letterSpacing = '0px'

  ctx.fillStyle = CSS.muted
  const df = fitLines(ctx, detail, width * 0.84, 46, 500, 2)
  ctx.font = `500 ${df.size}px ${FONT_STACK}`
  y = height * 0.8
  for (const line of df.lines) {
    ctx.fillText(line, width / 2, y)
    y += df.size * 1.25
  }

  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** Transparent floating label used for gate/portal captions and zone names. */
export function labelTexture(renderer, {
  text,
  color = CSS.cream,
  bg = 'rgba(34,48,74,0.88)',
  size = 128,
  padX = 60,
  weight = 800,
  spacing = '6px',
}) {
  const key = `label|${text}|${color}|${bg}|${size}|${weight}|${spacing}`
  if (cache.has(key)) return cache.get(key)

  const probe = makeCanvas(8, 8).getContext('2d')
  probe.font = `${weight} ${size}px ${FONT_STACK}`
  probe.letterSpacing = spacing
  const textW = probe.measureText(text).width
  const width = Math.ceil(textW + padX * 2)
  const height = Math.ceil(size * 1.9)

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)
  if (bg) {
    ctx.fillStyle = bg
    roundRect(ctx, 0, 0, width, height, height * 0.28)
    ctx.fill()
  }
  ctx.font = `${weight} ${size}px ${FONT_STACK}`
  ctx.letterSpacing = spacing
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, width / 2, height / 2)

  const tex = finish(canvas, renderer, { transparent: true })
  tex.userData.aspect = width / height
  cache.set(key, tex)
  return tex
}

/**
 * The ground texture: grass with a road network baked in. Painting the roads
 * into one large texture avoids hundreds of overlapping plane meshes and the
 * z-fighting that comes with them.
 */
export function groundTexture(renderer, { size = 2048, worldSize = 400, roads = [], pads = [] }) {
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const px = size / worldSize
  const toX = (x) => (x + worldSize / 2) * px
  const toY = (z) => (z + worldSize / 2) * px

  ctx.fillStyle = '#24485c'
  ctx.fillRect(0, 0, size, size)

  // Subtle mottling so the grass isn't a flat colour field.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 6 + Math.random() * 26
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(26,56,72,0.4)' : 'rgba(52,96,116,0.3)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const strokePath = (pts, widthWorld, color, dashed = false) => {
    ctx.strokeStyle = color
    ctx.lineWidth = widthWorld * px
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash(dashed ? [14 * px * 0.1, 10 * px * 0.1] : [])
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(toX(p[0]), toY(p[1])) : ctx.moveTo(toX(p[0]), toY(p[1]))))
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Pads first (plazas), then roads on top.
  for (const pad of pads) {
    ctx.fillStyle = pad.color || '#53697e'
    ctx.beginPath()
    ctx.arc(toX(pad.x), toY(pad.z), pad.r * px, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(214,226,250,0.45)'
    ctx.lineWidth = 0.6 * px
    ctx.stroke()
  }

  for (const road of roads) strokePath(road.points, road.width + 1.6, '#6d8a9e')
  for (const road of roads) strokePath(road.points, road.width, '#4a6378')
  for (const road of roads) {
    if (road.centerLine === false) continue
    strokePath(road.points, 0.35, 'rgba(226,236,255,0.8)', true)
  }

  const tex = finish(canvas, renderer)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/**
 * Vertical sky gradient. Three bands rather than two: deep blue overhead, a
 * mid blue, then the narrow warm strip of first light along the horizon. The
 * warm band is kept tight — spread it wider and the scene reads as sunset.
 */
export function skyTexture(top = '#0d1a38', horizon = '#f0a068', mid = '#2b4a80') {
  const canvas = makeCanvas(4, 1024)
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 1024)
  g.addColorStop(0, top)
  g.addColorStop(0.34, top)
  g.addColorStop(0.6, mid)
  g.addColorStop(0.83, '#6b7fae')
  g.addColorStop(0.93, '#c98f76')
  g.addColorStop(1, horizon)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 1024)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * A panel meant to be read lying flat on the ground. With a fixed high camera,
 * anything mounted vertically on a building is seen almost edge-on; the ground
 * is the one surface the player always has square on. Dark panel, accent rule,
 * light type — the same backlit-signage language as the billboards.
 */
export function groundPanelTexture(renderer, {
  title,
  items = [],
  note = '',
  accent = CSS.coral,
  columns = 2,
  width = 1024,
  height = 440,
}) {
  const key = `gpanel|${title}|${items.join('~')}|${note}|${accent}|${columns}|${width}x${height}`
  if (cache.has(key)) return cache.get(key)

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)

  const pad = 18
  const r = 34
  ctx.fillStyle = 'rgba(12,23,41,0.93)'
  roundRect(ctx, pad, pad, width - pad * 2, height - pad * 2, r)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 7
  roundRect(ctx, pad, pad, width - pad * 2, height - pad * 2, r)
  ctx.stroke()

  const innerX = pad + 46
  const innerW = width - (pad + 46) * 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  // Title
  const tf = fitLines(ctx, title.toUpperCase(), innerW, 78, 800, 1)
  ctx.font = `800 ${tf.size}px ${FONT_STACK}`
  ctx.letterSpacing = '4px'
  ctx.fillStyle = accent
  ctx.fillText(title.toUpperCase(), innerX, pad + 84)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = 'rgba(226,236,255,0.22)'
  ctx.fillRect(innerX, pad + 126, innerW, 3)

  if (note) {
    ctx.font = `500 40px ${FONT_STACK}`
    ctx.fillStyle = 'rgba(226,236,255,0.62)'
    ctx.fillText(note, innerX, pad + 168)
  }

  // Items laid out in columns.
  const top = pad + (note ? 214 : 176)
  const bottom = height - pad - 34
  const perCol = Math.ceil(items.length / columns)
  const colW = innerW / columns
  const lineH = Math.min(54, (bottom - top) / Math.max(1, perCol))
  const fontSize = Math.min(42, lineH * 0.74)

  items.forEach((item, i) => {
    const col = Math.floor(i / perCol)
    const row = i % perCol
    const x = innerX + col * colW
    const y = top + row * lineH + lineH / 2

    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(x + 9, y, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = `600 ${fontSize}px ${FONT_STACK}`
    ctx.fillStyle = '#e2ecff'
    const text = String(item)
    let size = fontSize
    while (ctx.measureText(text).width > colW - 46 && size > 16) {
      size -= 2
      ctx.font = `600 ${size}px ${FONT_STACK}`
    }
    ctx.fillText(text, x + 30, y)
  })

  const tex = finish(canvas, renderer, { transparent: true })
  cache.set(key, tex)
  return tex
}
