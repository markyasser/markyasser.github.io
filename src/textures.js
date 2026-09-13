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
 * The long side of a shipping container: corrugated steel with the title
 * stencilled across it. Containers carry the CV now, so this has to stay
 * readable from a moving car.
 */
export function containerSideTexture(renderer, {
  title, sub = '', meta = '', color = '#2f6fa8', width = 1024, height = 420,
}) {
  const key = `cside|${title}|${sub}|${meta}|${color}|${width}x${height}`
  if (cache.has(key)) return cache.get(key)

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)

  // Corrugation: vertical ribs drawn as alternating light and shade, so the
  // panel reads as pressed steel without costing any geometry.
  const rib = 34
  for (let x = 0; x < width; x += rib) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    ctx.fillRect(x, 0, rib * 0.42, height)
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.fillRect(x + rib * 0.42, 0, rib * 0.24, height)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.32)'
  ctx.fillRect(0, 0, width, height * 0.075)
  ctx.fillRect(0, height * 0.925, width, height * 0.075)

  // A dark plate behind the type keeps it legible over the ribs.
  const plateH = height * 0.56
  const plateY = (height - plateH) / 2
  ctx.fillStyle = 'rgba(9,18,33,0.82)'
  roundRect(ctx, width * 0.045, plateY, width * 0.91, plateH, 18)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const inner = width * 0.84
  const hasSub = Boolean(sub || meta)

  const tf = fitLines(ctx, title, inner, Math.round(height * (hasSub ? 0.3 : 0.4)), 800, 1)
  ctx.font = `800 ${tf.size}px ${FONT_STACK}`
  ctx.letterSpacing = '2px'
  ctx.fillStyle = '#eef4ff'
  ctx.fillText(title, width / 2, plateY + (hasSub ? plateH * 0.36 : plateH * 0.5))
  ctx.letterSpacing = '0px'

  if (sub) {
    const sf = fitLines(ctx, sub, inner, Math.round(height * 0.11), 600, 1)
    ctx.font = `600 ${sf.size}px ${FONT_STACK}`
    ctx.fillStyle = 'rgba(226,236,255,0.78)'
    ctx.fillText(sub, width / 2, plateY + plateH * 0.64)
  }
  if (meta) {
    const mf = fitLines(ctx, meta.toUpperCase(), inner, Math.round(height * 0.085), 700, 1)
    ctx.font = `700 ${mf.size}px ${FONT_STACK}`
    ctx.letterSpacing = '3px'
    ctx.fillStyle = 'rgba(226,236,255,0.5)'
    ctx.fillText(meta.toUpperCase(), width / 2, plateY + plateH * 0.85)
    ctx.letterSpacing = '0px'
  }

  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** The roof of a container — the face the overhead camera actually sees. */
export function containerTopTexture(renderer, { title, items = [], color = '#2f6fa8', width = 1024, height = 420 }) {
  const key = `ctop|${title}|${items.join('~')}|${color}|${width}x${height}`
  if (cache.has(key)) return cache.get(key)

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  const rib = 40
  for (let y = 0; y < height; y += rib) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, y, width, rib * 0.4)
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fillRect(0, y + rib * 0.4, width, rib * 0.22)
  }

  ctx.fillStyle = 'rgba(9,18,33,0.78)'
  roundRect(ctx, width * 0.03, height * 0.08, width * 0.94, height * 0.84, 20)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const inner = width * 0.86

  if (items.length) {
    const tf = fitLines(ctx, title, inner, Math.round(height * 0.26), 800, 1)
    ctx.font = `800 ${tf.size}px ${FONT_STACK}`
    ctx.fillStyle = '#eef4ff'
    ctx.fillText(title, width / 2, height * 0.3)

    const lf = fitLines(ctx, items.join('   ·   '), inner, Math.round(height * 0.12), 600, 2)
    ctx.font = `600 ${lf.size}px ${FONT_STACK}`
    ctx.fillStyle = 'rgba(226,236,255,0.76)'
    let y = height * 0.58
    for (const l of lf.lines) {
      ctx.fillText(l, width / 2, y)
      y += lf.size * 1.3
    }
  } else {
    const tf = fitLines(ctx, title, inner, Math.round(height * 0.38), 800, 2)
    ctx.font = `800 ${tf.size}px ${FONT_STACK}`
    ctx.fillStyle = '#eef4ff'
    let y = height / 2 - ((tf.lines.length - 1) * tf.size * 1.1) / 2
    for (const l of tf.lines) {
      ctx.fillText(l, width / 2, y)
      y += tf.size * 1.1
    }
  }

  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** Plain corrugated end panel, with the doors' locking bars. */
export function containerEndTexture(renderer, { color = '#2f6fa8', size = 512 }) {
  const key = `cend|${color}|${size}`
  if (cache.has(key)) return cache.get(key)
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(0, 0, size, size * 0.08)
  ctx.fillRect(0, size * 0.92, size, size * 0.08)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(size * 0.48, size * 0.08, size * 0.04, size * 0.84)
  for (const x of [0.2, 0.32, 0.66, 0.78]) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(size * x, size * 0.12, size * 0.035, size * 0.76)
  }
  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}

/** A hanging banner for a flag: colour field with the title across it. */
export function bannerTexture(renderer, { title, color = '#ef7360', width = 512, height = 320 }) {
  const key = `banner|${title}|${color}|${width}x${height}`
  if (cache.has(key)) return cache.get(key)
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fillRect(0, 0, width * 0.06, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const f = fitLines(ctx, title.toUpperCase(), width * 0.82, Math.round(height * 0.3), 800, 2)
  ctx.font = `800 ${f.size}px ${FONT_STACK}`
  ctx.letterSpacing = '2px'
  ctx.fillStyle = '#0b1526'
  let y = height / 2 - ((f.lines.length - 1) * f.size * 1.15) / 2
  for (const l of f.lines) {
    ctx.fillText(l, width * 0.53, y)
    y += f.size * 1.15
  }
  const tex = finish(canvas, renderer)
  cache.set(key, tex)
  return tex
}
