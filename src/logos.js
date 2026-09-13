// ---------------------------------------------------------------------------
// Logo marks, drawn as vector paths at runtime.
//
// Nothing in this project loads an image file: the CSP on the published page
// blocks external images, and keeping the site to a single JS bundle is the
// reason it has no asset pipeline at all. So the marks here are drawn with
// Canvas2D from geometry written by hand.
//
// They are deliberately *stylised originals* — recognisable at a glance by
// shape and colour, not facsimiles of anyone's trademark. To use a real brand
// asset instead, replace a mark with one that strokes the official SVG path;
// every mark is just a function that draws into a unit square.
//
// Each mark receives a context already translated and scaled so that (0,0) to
// (1,1) is its drawing area.
// ---------------------------------------------------------------------------

/** Brand-ish colours, used for the mark and as the crate's field colour. */
export const BRAND = {
  javascript: '#f0db4f', java: '#e76f00', csharp: '#68217a', python: '#3776ab',
  kotlin: '#a97bff', sql: '#4b8bbe', cplusplus: '#00599c',
  nodejs: '#5fa04e', express: '#d8dee9', dotnet: '#5c2d91', spring: '#6db33f',
  rest: '#4fb3c9', socketio: '#dfe6f0',
  aws: '#ff9900', terraform: '#7b42bc', docker: '#2496ed', githubactions: '#2088ff', cicd: '#6ad3a3',
  postgres: '#4169e1', clickhouse: '#ffcc00', sqlserver: '#cc2927', mysql: '#00758f', mongodb: '#47a248',
  keycloak: '#4d4d4d', sso: '#f2ac63', oauth: '#5b8def', identity: '#e2649b',
  react: '#61dafb', nextjs: '#e8eefc', flutter: '#54c5f8',
  microservices: '#7a6cf0', distributed: '#4f9ce8', events: '#f5b878', systemdesign: '#37bfb6',
  test: '#ff9068', pact: '#c7f0d8', agile: '#8aa0b8', scrum: '#8aa0b8',
  postmortem: '#ef7360', review: '#9fb6d8', mentoring: '#f2ac63',
  generic: '#8ea2c6',
}

// Skill names as they appear in data.js, mapped onto marks.
const ALIASES = {
  'javascript': 'javascript', 'java': 'java', 'c#': 'csharp', 'python': 'python',
  'kotlin': 'kotlin', 'sql': 'sql', 'c++': 'cplusplus',
  'node.js': 'nodejs', 'express.js': 'express', 'asp.net core': 'dotnet',
  'spring boot': 'spring', 'rest apis': 'rest', 'socket.io': 'socketio',
  'aws': 'aws', 'terraform': 'terraform', 'docker': 'docker',
  'github actions': 'githubactions', 'ci/cd': 'cicd',
  'postgresql': 'postgres', 'clickhouse': 'clickhouse', 'sql server': 'sqlserver',
  'mysql': 'mysql', 'mongodb': 'mongodb',
  'keycloak': 'keycloak', 'sso': 'sso', 'oauth2': 'oauth', 'identity mgmt': 'identity',
  'react': 'react', 'next.js': 'nextjs', 'flutter': 'flutter',
  'microservices': 'microservices', 'distributed systems': 'distributed',
  'event-driven': 'events', 'system design': 'systemdesign',
  'unit': 'test', 'integration': 'test', 'end-to-end': 'test', 'pact contract': 'pact',
  'agile': 'agile', 'scrum': 'scrum', 'post-mortems': 'postmortem',
  'code review': 'review', 'mentoring': 'mentoring',
}

export function markKey(label) {
  return ALIASES[String(label).trim().toLowerCase()] || 'generic'
}

export function brandColor(label) {
  return BRAND[markKey(label)] || BRAND.generic
}

// --- drawing helpers -------------------------------------------------------

const poly = (ctx, pts, fill) => {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
}

const circle = (ctx, x, y, r, fill) => {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
}

const glyph = (ctx, text, size = 0.52, color = '#0b1526', weight = 800) => {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0.5, 0.54)
  ctx.restore()
}

// --- the marks -------------------------------------------------------------

export const MARKS = {
  // Orange swoosh under a wordmark.
  aws(ctx) {
    glyph(ctx, 'aws', 0.4, '#ffffff')
    ctx.strokeStyle = '#ff9900'
    ctx.lineWidth = 0.075
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.17, 0.74)
    ctx.quadraticCurveTo(0.5, 0.92, 0.83, 0.74)
    ctx.stroke()
    poly(ctx, [[0.78, 0.66], [0.88, 0.72], [0.79, 0.8]], '#ff9900')
  },

  // Stacked containers riding a whale's back.
  docker(ctx) {
    ctx.fillStyle = '#eaf4ff'
    const box = (x, y, w, h) => ctx.fillRect(x, y, w, h)
    for (let i = 0; i < 4; i++) box(0.18 + i * 0.14, 0.42, 0.11, 0.13)
    for (let i = 0; i < 3; i++) box(0.32 + i * 0.14, 0.27, 0.11, 0.13)
    box(0.46, 0.12, 0.11, 0.13)
    ctx.beginPath()
    ctx.moveTo(0.08, 0.62)
    ctx.quadraticCurveTo(0.5, 0.62, 0.86, 0.58)
    ctx.quadraticCurveTo(0.9, 0.82, 0.5, 0.84)
    ctx.quadraticCurveTo(0.14, 0.84, 0.08, 0.62)
    ctx.fillStyle = '#eaf4ff'
    ctx.fill()
  },

  // Three tessellated parallelograms.
  terraform(ctx) {
    const p = (x, y) => poly(ctx, [[x, y], [x + 0.2, y + 0.115], [x + 0.2, y + 0.345], [x, y + 0.23]], '#eadcff')
    p(0.14, 0.34)
    p(0.4, 0.19)
    p(0.4, 0.49)
    p(0.66, 0.34)
  },

  // Rounded square with a play arrow, like a run button.
  githubactions(ctx) {
    ctx.fillStyle = '#eaf2ff'
    circle(ctx, 0.5, 0.5, 0.34)
    ctx.fillStyle = '#2088ff'
    poly(ctx, [[0.42, 0.34], [0.42, 0.66], [0.68, 0.5]], '#2088ff')
    ctx.strokeStyle = '#eaf2ff'
    ctx.lineWidth = 0.07
    ctx.beginPath()
    ctx.arc(0.5, 0.5, 0.44, -0.5, Math.PI * 1.35)
    ctx.stroke()
  },

  // Hexagon, for Node.
  nodejs(ctx) {
    const pts = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      pts.push([0.5 + Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38])
    }
    poly(ctx, pts, '#eaf7e6')
    glyph(ctx, 'N', 0.34, '#3a6b2e')
  },

  express(ctx) { glyph(ctx, 'ex', 0.46, '#0b1526') },
  dotnet(ctx) { glyph(ctx, '.NET', 0.28, '#ffffff') },

  // Spring's leaf.
  spring(ctx) {
    ctx.beginPath()
    ctx.moveTo(0.22, 0.78)
    ctx.quadraticCurveTo(0.3, 0.24, 0.8, 0.2)
    ctx.quadraticCurveTo(0.82, 0.7, 0.22, 0.78)
    ctx.fillStyle = '#eafbe4'
    ctx.fill()
    ctx.strokeStyle = '#2f6b1f'
    ctx.lineWidth = 0.04
    ctx.beginPath()
    ctx.moveTo(0.26, 0.76)
    ctx.quadraticCurveTo(0.55, 0.55, 0.78, 0.24)
    ctx.stroke()
  },

  rest(ctx) { glyph(ctx, '{ }', 0.4, '#eaf6fa') },

  socketio(ctx) {
    ctx.strokeStyle = '#0b1526'
    ctx.lineWidth = 0.08
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.24, 0.7)
    ctx.lineTo(0.5, 0.28)
    ctx.lineTo(0.76, 0.7)
    ctx.stroke()
    circle(ctx, 0.5, 0.5, 0.42)
    ctx.strokeStyle = '#0b1526'
    ctx.lineWidth = 0.05
    ctx.stroke()
  },

  cicd(ctx) {
    ctx.strokeStyle = '#0b1526'
    ctx.lineWidth = 0.07
    ctx.beginPath()
    ctx.arc(0.5, 0.5, 0.3, 0.4, Math.PI * 1.6)
    ctx.stroke()
    poly(ctx, [[0.66, 0.2], [0.86, 0.3], [0.66, 0.42]], '#0b1526')
  },

  // Elephant head, much simplified.
  postgres(ctx) {
    ctx.fillStyle = '#e6ecff'
    ctx.beginPath()
    ctx.ellipse(0.5, 0.46, 0.32, 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    poly(ctx, [[0.36, 0.66], [0.46, 0.66], [0.44, 0.9], [0.36, 0.9]], '#e6ecff')
    poly(ctx, [[0.56, 0.66], [0.66, 0.66], [0.66, 0.9], [0.58, 0.9]], '#e6ecff')
    poly(ctx, [[0.24, 0.3], [0.4, 0.2], [0.3, 0.5]], '#e6ecff')
    poly(ctx, [[0.76, 0.3], [0.6, 0.2], [0.7, 0.5]], '#e6ecff')
    circle(ctx, 0.42, 0.42, 0.035, '#1b2a45')
    circle(ctx, 0.58, 0.42, 0.035, '#1b2a45')
  },

  // ClickHouse's stacked bars.
  clickhouse(ctx) {
    ctx.fillStyle = '#1b2a45'
    for (let i = 0; i < 4; i++) ctx.fillRect(0.18 + i * 0.15, 0.18, 0.1, 0.64)
    ctx.fillRect(0.18, 0.44, 0.64, 0.12)
  },

  sqlserver(ctx) {
    ctx.fillStyle = '#ffe8e8'
    ctx.beginPath()
    ctx.ellipse(0.5, 0.28, 0.3, 0.11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(0.2, 0.28, 0.6, 0.42)
    ctx.beginPath()
    ctx.ellipse(0.5, 0.7, 0.3, 0.11, 0, 0, Math.PI * 2)
    ctx.fill()
  },

  // Dolphin, reduced to its arc and fin.
  mysql(ctx) {
    ctx.strokeStyle = '#e6f4f7'
    ctx.lineWidth = 0.11
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.16, 0.7)
    ctx.quadraticCurveTo(0.42, 0.2, 0.84, 0.42)
    ctx.stroke()
    poly(ctx, [[0.5, 0.32], [0.62, 0.12], [0.64, 0.36]], '#e6f4f7')
  },

  // Mongo's leaf.
  mongodb(ctx) {
    ctx.fillStyle = '#e6f7e9'
    ctx.beginPath()
    ctx.moveTo(0.5, 0.1)
    ctx.quadraticCurveTo(0.84, 0.44, 0.5, 0.82)
    ctx.quadraticCurveTo(0.16, 0.44, 0.5, 0.1)
    ctx.fill()
    ctx.strokeStyle = '#2b6b32'
    ctx.lineWidth = 0.05
    ctx.beginPath()
    ctx.moveTo(0.5, 0.14)
    ctx.lineTo(0.5, 0.92)
    ctx.stroke()
  },

  // A padlock, for the identity group.
  keycloak(ctx) {
    ctx.fillStyle = '#eef3fb'
    ctx.fillRect(0.28, 0.46, 0.44, 0.36)
    ctx.strokeStyle = '#eef3fb'
    ctx.lineWidth = 0.09
    ctx.beginPath()
    ctx.arc(0.5, 0.44, 0.16, Math.PI, 0)
    ctx.stroke()
    circle(ctx, 0.5, 0.62, 0.055, '#1b2a45')
  },
  sso(ctx) { MARKS.keycloak(ctx) },
  oauth(ctx) {
    ctx.strokeStyle = '#eef3fb'
    ctx.lineWidth = 0.09
    circle(ctx, 0.5, 0.5, 0.3)
    ctx.stroke()
    ctx.fillStyle = '#eef3fb'
    ctx.fillRect(0.44, 0.54, 0.36, 0.1)
    ctx.fillRect(0.72, 0.54, 0.08, 0.2)
  },
  identity(ctx) {
    circle(ctx, 0.5, 0.36, 0.16, '#fdeaf3')
    ctx.fillStyle = '#fdeaf3'
    ctx.beginPath()
    ctx.moveTo(0.22, 0.86)
    ctx.quadraticCurveTo(0.5, 0.54, 0.78, 0.86)
    ctx.fill()
  },

  // React's three orbits.
  react(ctx) {
    ctx.strokeStyle = '#0b1526'
    ctx.lineWidth = 0.05
    for (let i = 0; i < 3; i++) {
      ctx.save()
      ctx.translate(0.5, 0.5)
      ctx.rotate((Math.PI / 3) * i)
      ctx.beginPath()
      ctx.ellipse(0, 0, 0.4, 0.16, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    circle(ctx, 0.5, 0.5, 0.08, '#0b1526')
  },

  nextjs(ctx) {
    circle(ctx, 0.5, 0.5, 0.36, '#0b1526')
    glyph(ctx, 'N', 0.36, '#e8eefc')
  },

  // Flutter's folded chevrons.
  flutter(ctx) {
    poly(ctx, [[0.62, 0.1], [0.86, 0.1], [0.38, 0.58], [0.26, 0.46]], '#eaf8ff')
    poly(ctx, [[0.62, 0.44], [0.86, 0.44], [0.56, 0.74], [0.44, 0.62]], '#cfeeff')
    poly(ctx, [[0.56, 0.74], [0.86, 0.9], [0.62, 0.9], [0.44, 0.76]], '#eaf8ff')
  },

  // Kotlin's two triangles.
  kotlin(ctx) {
    poly(ctx, [[0.16, 0.16], [0.84, 0.16], [0.5, 0.5]], '#f2e6ff')
    poly(ctx, [[0.16, 0.16], [0.5, 0.5], [0.16, 0.84]], '#e0c8ff')
    poly(ctx, [[0.5, 0.5], [0.84, 0.84], [0.16, 0.84]], '#f2e6ff')
  },

  // Java's cup and steam.
  java(ctx) {
    ctx.fillStyle = '#ffeadb'
    ctx.fillRect(0.28, 0.5, 0.38, 0.28)
    ctx.strokeStyle = '#ffeadb'
    ctx.lineWidth = 0.06
    ctx.beginPath()
    ctx.arc(0.68, 0.62, 0.1, -1.2, 1.2)
    ctx.stroke()
    ctx.lineWidth = 0.05
    ctx.lineCap = 'round'
    for (const x of [0.36, 0.47, 0.58]) {
      ctx.beginPath()
      ctx.moveTo(x, 0.42)
      ctx.quadraticCurveTo(x + 0.06, 0.32, x, 0.2)
      ctx.stroke()
    }
  },

  csharp(ctx) {
    glyph(ctx, 'C#', 0.44, '#ffffff')
  },
  cplusplus(ctx) {
    glyph(ctx, 'C++', 0.36, '#ffffff')
  },

  // Python's two interlocking bodies.
  python(ctx) {
    ctx.fillStyle = '#ffd95e'
    ctx.beginPath()
    ctx.roundRect(0.5, 0.3, 0.3, 0.5, 0.14)
    ctx.fill()
    ctx.fillStyle = '#e8f2ff'
    ctx.beginPath()
    ctx.roundRect(0.2, 0.2, 0.3, 0.5, 0.14)
    ctx.fill()
    circle(ctx, 0.3, 0.3, 0.035, '#1b2a45')
    circle(ctx, 0.7, 0.7, 0.035, '#1b2a45')
  },

  sql(ctx) {
    ctx.fillStyle = '#e6f0fa'
    ctx.beginPath()
    ctx.ellipse(0.5, 0.26, 0.3, 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(0.2, 0.26, 0.6, 0.46)
    ctx.beginPath()
    ctx.ellipse(0.5, 0.72, 0.3, 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#4b8bbe'
    ctx.lineWidth = 0.04
    for (const y of [0.42, 0.57]) {
      ctx.beginPath()
      ctx.ellipse(0.5, y, 0.3, 0.1, 0, 0.1, Math.PI - 0.1)
      ctx.stroke()
    }
  },

  javascript(ctx) { glyph(ctx, 'JS', 0.46, '#0b1526') },

  // Abstract concepts get diagrams rather than logos.
  microservices(ctx) {
    const n = [[0.5, 0.18], [0.18, 0.5], [0.82, 0.5], [0.34, 0.84], [0.66, 0.84]]
    ctx.strokeStyle = 'rgba(238,244,255,0.6)'
    ctx.lineWidth = 0.035
    for (let i = 1; i < n.length; i++) {
      ctx.beginPath()
      ctx.moveTo(n[0][0], n[0][1])
      ctx.lineTo(n[i][0], n[i][1])
      ctx.stroke()
    }
    n.forEach(([x, y], i) => circle(ctx, x, y, i ? 0.09 : 0.12, '#eef4ff'))
  },
  distributed(ctx) { MARKS.microservices(ctx) },
  events(ctx) {
    ctx.strokeStyle = '#1b2a45'
    ctx.lineWidth = 0.07
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.12, 0.5)
    ctx.lineTo(0.34, 0.5)
    ctx.lineTo(0.44, 0.24)
    ctx.lineTo(0.58, 0.76)
    ctx.lineTo(0.68, 0.5)
    ctx.lineTo(0.88, 0.5)
    ctx.stroke()
  },
  systemdesign(ctx) {
    ctx.strokeStyle = '#eafaf8'
    ctx.lineWidth = 0.05
    ctx.strokeRect(0.14, 0.16, 0.3, 0.24)
    ctx.strokeRect(0.56, 0.16, 0.3, 0.24)
    ctx.strokeRect(0.35, 0.6, 0.3, 0.24)
    ctx.beginPath()
    ctx.moveTo(0.29, 0.4)
    ctx.lineTo(0.45, 0.6)
    ctx.moveTo(0.71, 0.4)
    ctx.lineTo(0.55, 0.6)
    ctx.stroke()
  },
  test(ctx) {
    ctx.strokeStyle = '#1b2a45'
    ctx.lineWidth = 0.1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(0.22, 0.52)
    ctx.lineTo(0.42, 0.72)
    ctx.lineTo(0.8, 0.28)
    ctx.stroke()
  },
  pact(ctx) {
    ctx.strokeStyle = '#1b2a45'
    ctx.lineWidth = 0.06
    circle(ctx, 0.38, 0.5, 0.22)
    ctx.stroke()
    circle(ctx, 0.62, 0.5, 0.22)
    ctx.stroke()
  },
  agile(ctx) { MARKS.cicd(ctx) },
  scrum(ctx) { MARKS.cicd(ctx) },
  postmortem(ctx) {
    ctx.fillStyle = '#ffe6e0'
    poly(ctx, [[0.5, 0.14], [0.9, 0.82], [0.1, 0.82]], '#ffe6e0')
    ctx.fillStyle = '#7a1d10'
    ctx.fillRect(0.46, 0.38, 0.08, 0.24)
    ctx.fillRect(0.46, 0.66, 0.08, 0.08)
  },
  review(ctx) {
    ctx.strokeStyle = '#1b2a45'
    ctx.lineWidth = 0.07
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.4, 0.3)
    ctx.lineTo(0.24, 0.5)
    ctx.lineTo(0.4, 0.7)
    ctx.moveTo(0.6, 0.3)
    ctx.lineTo(0.76, 0.5)
    ctx.lineTo(0.6, 0.7)
    ctx.stroke()
  },
  mentoring(ctx) {
    circle(ctx, 0.36, 0.34, 0.13, '#fff0dc')
    circle(ctx, 0.66, 0.4, 0.1, '#fff0dc')
    ctx.fillStyle = '#fff0dc'
    ctx.beginPath()
    ctx.moveTo(0.14, 0.84)
    ctx.quadraticCurveTo(0.36, 0.52, 0.58, 0.84)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0.5, 0.86)
    ctx.quadraticCurveTo(0.66, 0.6, 0.86, 0.86)
    ctx.fill()
  },

  generic(ctx) {
    ctx.strokeStyle = 'rgba(238,244,255,0.75)'
    ctx.lineWidth = 0.06
    ctx.strokeRect(0.2, 0.2, 0.6, 0.6)
    circle(ctx, 0.5, 0.5, 0.12, 'rgba(238,244,255,0.75)')
  },
}

/** Draw a mark into a box, with its own coordinate space. */
export function drawMark(ctx, key, x, y, size) {
  const mark = MARKS[key] || MARKS.generic
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size, size)
  ctx.lineJoin = 'round'
  mark(ctx)
  ctx.restore()
}

// --- Country flags ---------------------------------------------------------
// Drawn into a w x h rectangle at (x, y). Used for the spoken languages.

export const FLAGS = {
  eg(ctx, w, h) {
    const band = h / 3
    ctx.fillStyle = '#ce1126'; ctx.fillRect(0, 0, w, band)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, band, w, band)
    ctx.fillStyle = '#111111'; ctx.fillRect(0, band * 2, w, band)
    // The Eagle of Saladin, reduced to a gold silhouette.
    const cx = w / 2
    const cy = h / 2
    const u = h * 0.16
    ctx.fillStyle = '#c09300'
    ctx.beginPath()
    ctx.moveTo(cx, cy - u * 1.5)
    ctx.lineTo(cx + u * 0.45, cy - u * 0.5)
    ctx.lineTo(cx + u * 1.9, cy - u * 0.9)
    ctx.lineTo(cx + u * 0.8, cy + u * 0.35)
    ctx.lineTo(cx + u * 0.5, cy + u * 1.6)
    ctx.lineTo(cx - u * 0.5, cy + u * 1.6)
    ctx.lineTo(cx - u * 0.8, cy + u * 0.35)
    ctx.lineTo(cx - u * 1.9, cy - u * 0.9)
    ctx.lineTo(cx - u * 0.45, cy - u * 0.5)
    ctx.closePath()
    ctx.fill()
  },

  fr(ctx, w, h) {
    ctx.fillStyle = '#002395'; ctx.fillRect(0, 0, w / 3, h)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 3, 0, w / 3, h)
    ctx.fillStyle = '#ed2939'; ctx.fillRect((w * 2) / 3, 0, w / 3, h)
  },

  gb(ctx, w, h) {
    ctx.fillStyle = '#012169'
    ctx.fillRect(0, 0, w, h)
    // White diagonals, then red ones inset on top.
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = h * 0.3
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke()
    ctx.strokeStyle = '#c8102e'
    ctx.lineWidth = h * 0.1
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke()
    ctx.restore()
    // Upright cross.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, h * 0.34, w, h * 0.32)
    ctx.fillRect(w * 0.42, 0, w * 0.16, h)
    ctx.fillStyle = '#c8102e'
    ctx.fillRect(0, h * 0.4, w, h * 0.2)
    ctx.fillRect(w * 0.45, 0, w * 0.1, h)
  },
}

export function drawFlag(ctx, code, x, y, w, h) {
  const flag = FLAGS[code]
  if (!flag) return
  ctx.save()
  ctx.translate(x, y)
  flag(ctx, w, h)
  ctx.strokeStyle = 'rgba(11,21,38,0.45)'
  ctx.lineWidth = Math.max(2, h * 0.03)
  ctx.strokeRect(0, 0, w, h)
  ctx.restore()
}

// --- Organisation marks ----------------------------------------------------
// Original emblems standing in for each employer's real logo. Swap any of these
// for the genuine artwork by replacing the draw function.

export const ORG_MARKS = {
  // Cairo University: a sun over an open book, ringed.
  cairo(ctx) {
    ctx.strokeStyle = '#efe6ff'
    ctx.lineWidth = 0.055
    circle(ctx, 0.5, 0.5, 0.42)
    ctx.stroke()
    ctx.fillStyle = '#efe6ff'
    ctx.beginPath()
    ctx.arc(0.5, 0.46, 0.15, Math.PI, 0)
    ctx.fill()
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (Math.PI / 6) * i
      ctx.strokeStyle = '#efe6ff'
      ctx.lineWidth = 0.035
      ctx.beginPath()
      ctx.moveTo(0.5 + Math.cos(a) * 0.19, 0.46 + Math.sin(a) * 0.19)
      ctx.lineTo(0.5 + Math.cos(a) * 0.28, 0.46 + Math.sin(a) * 0.28)
      ctx.stroke()
    }
    poly(ctx, [[0.22, 0.56], [0.5, 0.62], [0.5, 0.78], [0.22, 0.72]], '#efe6ff')
    poly(ctx, [[0.78, 0.56], [0.5, 0.62], [0.5, 0.78], [0.78, 0.72]], '#d9c8ff')
  },

  // Gameball: a ball with a play triangle cut into it.
  gameball(ctx) {
    circle(ctx, 0.5, 0.5, 0.38, '#fff3dd')
    poly(ctx, [[0.42, 0.33], [0.42, 0.67], [0.7, 0.5]], '#7a5a12')
    ctx.strokeStyle = '#7a5a12'
    ctx.lineWidth = 0.04
    ctx.beginPath()
    ctx.arc(0.5, 0.5, 0.3, 2.4, 4.2)
    ctx.stroke()
  },

  // Prepit: a monogram tile.
  prepit(ctx) {
    ctx.fillStyle = '#ffe3dd'
    ctx.beginPath()
    ctx.roundRect(0.12, 0.12, 0.76, 0.76, 0.2)
    ctx.fill()
    glyph(ctx, 'P', 0.52, '#b43a26')
  },
}

Object.assign(ORG_MARKS, {
  // Faculty of Engineering: gear and dividers in a ring, the standard
  // engineering-faculty vocabulary.
  engineering(ctx) {
    ctx.strokeStyle = '#dbe9ff'
    ctx.lineWidth = 0.05
    circle(ctx, 0.5, 0.5, 0.43)
    ctx.stroke()

    // Gear.
    const teeth = 10
    ctx.fillStyle = '#dbe9ff'
    for (let i = 0; i < teeth; i++) {
      const a = (Math.PI * 2 * i) / teeth
      ctx.save()
      ctx.translate(0.5, 0.5)
      ctx.rotate(a)
      ctx.fillRect(-0.045, -0.36, 0.09, 0.12)
      ctx.restore()
    }
    ctx.lineWidth = 0.075
    circle(ctx, 0.5, 0.5, 0.26)
    ctx.stroke()

    // Dividers over the hub.
    ctx.strokeStyle = '#dbe9ff'
    ctx.lineWidth = 0.055
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.5, 0.3)
    ctx.lineTo(0.38, 0.66)
    ctx.moveTo(0.5, 0.3)
    ctx.lineTo(0.62, 0.66)
    ctx.stroke()
    circle(ctx, 0.5, 0.3, 0.05, '#dbe9ff')
  },

  // A cat silhouette in a disc — the shape people read GitHub by.
  github(ctx) {
    circle(ctx, 0.5, 0.5, 0.42, '#e9eefb')
    ctx.fillStyle = '#0b1526'
    poly(ctx, [[0.28, 0.38], [0.3, 0.2], [0.44, 0.3]], '#0b1526')
    poly(ctx, [[0.72, 0.38], [0.7, 0.2], [0.56, 0.3]], '#0b1526')
    ctx.beginPath()
    ctx.ellipse(0.5, 0.5, 0.24, 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e9eefb'
    circle(ctx, 0.42, 0.47, 0.045)
    circle(ctx, 0.58, 0.47, 0.045)
    ctx.strokeStyle = '#0b1526'
    ctx.lineWidth = 0.055
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0.7, 0.66)
    ctx.quadraticCurveTo(0.86, 0.72, 0.8, 0.86)
    ctx.stroke()
  },

  linkedin(ctx) {
    ctx.fillStyle = '#e9f2fb'
    ctx.beginPath()
    ctx.roundRect(0.12, 0.12, 0.76, 0.76, 0.14)
    ctx.fill()
    ctx.fillStyle = '#0a66c2'
    ctx.fillRect(0.24, 0.42, 0.11, 0.34)
    circle(ctx, 0.295, 0.3, 0.075, '#0a66c2')
    ctx.fillRect(0.44, 0.42, 0.1, 0.34)
    ctx.beginPath()
    ctx.moveTo(0.54, 0.76)
    ctx.lineTo(0.54, 0.56)
    ctx.quadraticCurveTo(0.56, 0.44, 0.68, 0.46)
    ctx.quadraticCurveTo(0.77, 0.48, 0.77, 0.6)
    ctx.lineTo(0.77, 0.76)
    ctx.lineTo(0.66, 0.76)
    ctx.lineTo(0.66, 0.6)
    ctx.quadraticCurveTo(0.66, 0.54, 0.6, 0.55)
    ctx.quadraticCurveTo(0.65, 0.55, 0.65, 0.62)
    ctx.lineTo(0.65, 0.76)
    ctx.closePath()
    ctx.fill()
  },

  email(ctx) {
    ctx.fillStyle = '#ffe6e0'
    ctx.beginPath()
    ctx.roundRect(0.14, 0.26, 0.72, 0.48, 0.07)
    ctx.fill()
    ctx.strokeStyle = '#b43a26'
    ctx.lineWidth = 0.06
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(0.16, 0.29)
    ctx.lineTo(0.5, 0.55)
    ctx.lineTo(0.84, 0.29)
    ctx.stroke()
  },
})

// ---------------------------------------------------------------------------
// Real artwork
//
// Everything above is drawn from geometry because this project has no asset
// pipeline. To use an actual logo file instead, put it here as a data URI
// (`base64 -w0 logo.png`, prefixed with `data:image/png;base64,`) under the key
// it should replace. It then overrides the drawn mark everywhere at once —
// crate faces, container sides and roofs, flags.
//
// Images are preloaded before the world is built, because every texture in this
// project is drawn once into a canvas and never revisited; an image that
// arrives late would simply be missed.
// ---------------------------------------------------------------------------

export const IMAGE_MARKS = {
  // cairo: 'data:image/png;base64,...',
  // engineering: 'data:image/png;base64,...',
}

const loadedImages = new Map()

export function preloadMarks() {
  const entries = Object.entries(IMAGE_MARKS)
  if (!entries.length) return Promise.resolve()
  return Promise.all(
    entries.map(([key, src]) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          loadedImages.set(key, img)
          resolve()
        }
        // A broken data URI should cost the drawn fallback, not the whole world.
        img.onerror = () => resolve()
        img.src = src
      })
    )
  )
}

export function drawOrgMark(ctx, key, x, y, size) {
  const img = loadedImages.get(key)
  if (img) {
    // Fit inside the box, preserving the artwork's aspect.
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h)
    return
  }
  const mark = ORG_MARKS[key]
  if (!mark) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size, size)
  ctx.lineJoin = 'round'
  mark(ctx)
  ctx.restore()
}
