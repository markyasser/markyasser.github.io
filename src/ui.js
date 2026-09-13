import { PROFILE, EXPERIENCE, EDUCATION, SKILL_GROUPS, STATS, CONTACT_LINKS } from './data.js'

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))


// Inline SVG marks — no icon font, no network request, and they stay crisp.
const ICONS = {
  github:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.06-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.49 2.49 0 1 0 5 8.48a2.49 2.49 0 0 0-.02-4.98ZM3 9.75h4v11.5H3V9.75Zm6.5 0h3.83v1.57h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.14v5.85h-4v-5.19c0-1.24-.02-2.83-1.72-2.83-1.73 0-2 1.35-2 2.74v5.28h-4V9.75Z"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 6.5 9 6.5 9-6.5"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"/></svg>',
}

export class UI {
  constructor({ onStart, onToggleSound, onReset, onCamera }) {
    this.onStart = onStart
    this.root = document.getElementById('app')
    this._toastTimers = new Set()

    this.root.insertAdjacentHTML('beforeend', this._markup())

    this.loading = document.getElementById('loading')
    this.loadFill = document.getElementById('load-fill')
    this.loadStatus = document.getElementById('load-status')
    this.startBtn = document.getElementById('start-btn')
    this.panel = document.getElementById('panel')
    this.panelHead = document.getElementById('panel-head')
    this.panelBody = document.getElementById('panel-body')
    this.prompt = document.getElementById('prompt')
    this.promptText = document.getElementById('prompt-text')
    this.gauge = document.getElementById('gauge-value')
    this.shardEl = document.getElementById('shard-value')
    this.toastStack = document.getElementById('toast-stack')
    this.resume = document.getElementById('resume')
    this.touch = document.getElementById('touch')

    const coarseHint = window.matchMedia('(pointer: coarse)').matches
    document.getElementById('load-hint').innerHTML = coarseHint
      ? `Use the on-screen pads to drive. Pinch to zoom out.<br>
         Pull up to a building and tap <b>Open</b> to read it.
         Prefer plain text? Tap <b>CV</b> in the top bar.`
      : `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to drive &nbsp;·&nbsp;
         <kbd>Space</kbd> handbrake &nbsp;·&nbsp; <kbd>E</kbd> to read &nbsp;·&nbsp; <kbd>R</kbd> to reset<br>
         Scroll to zoom out. Everything you can see can be knocked over.<br>
         Prefer plain text? Hit <b>CV</b> in the top bar.`

    this.startBtn.addEventListener('click', () => this.onStart())
    document.getElementById('panel-close').addEventListener('click', () => this.closePanel())
    document.getElementById('btn-resume').addEventListener('click', () => this.toggleResume(true))
    document.getElementById('resume-close').addEventListener('click', () => this.toggleResume(false))
    document.getElementById('btn-help').addEventListener('click', () => this.openHelp())
    document.getElementById('btn-reset').addEventListener('click', () => onReset())
    document.getElementById('btn-camera').addEventListener('click', () => onCamera())

    this.soundBtn = document.getElementById('btn-sound')
    this.soundBtn.addEventListener('click', () => {
      const on = onToggleSound()
      this.soundBtn.classList.toggle('off', !on)
      this.soundBtn.textContent = on ? '🔊' : '🔈'
    })

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.resume.classList.contains('open')) this.toggleResume(false)
        else this.closePanel()
      }
    })

    this.prompt.addEventListener('click', () => this._promptAction && this._promptAction())

    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse) {
      this.touch.classList.add('on')
      // There is no E key to press on a phone.
      this.prompt.querySelector('kbd').textContent = 'TAP'
    }
    this.isTouch = coarse
  }

  _markup() {
    const r = PROFILE
    return `
<div id="loading">
  <div class="load-inner">
    <div class="load-kicker">Interactive Portfolio</div>
    <h1 class="load-name">${esc(r.short)}</h1>
    <div class="load-role">${esc(r.title)}</div>
    <div class="load-bar"><div class="load-fill" id="load-fill"></div></div>
    <div class="load-status" id="load-status">Building the world…</div>
    <button class="start-btn" id="start-btn">Start driving</button>
    <div class="load-hint" id="load-hint"></div>
  </div>
</div>

<div id="hud">
  <div class="brand">
    <strong>${esc(r.short)}</strong>
    <span>${esc(r.title)}</span>
  </div>

  <div class="tools">
    <button class="tool wide" id="btn-resume" title="Read the plain-text CV">CV</button>
    <button class="tool" id="btn-camera" title="Change camera (C)">🎥</button>
    <button class="tool" id="btn-reset" title="Reset car (R)">↻</button>
    <button class="tool off" id="btn-sound" title="Toggle sound">🔈</button>
    <button class="tool" id="btn-help" title="Help">?</button>
  </div>

  <div class="gauge"><b id="gauge-value">0</b><span>km/h</span></div>
  <div class="shard-count"><i>◆</i><span id="shard-value">0 / 10</span></div>

  <div id="minimap-wrap"><canvas id="minimap" width="296" height="296"></canvas></div>

  <button class="prompt" id="prompt"><kbd>E</kbd><span id="prompt-text"></span></button>
  <div id="toast-stack"></div>
</div>

<div id="touch">
  <button class="pad" id="btn-left">◀</button>
  <button class="pad" id="btn-right">▶</button>
  <button class="pad" id="btn-forward">▲</button>
  <button class="pad" id="btn-back">▼</button>
  <button class="pad" id="btn-brake">HOLD</button>
</div>

<aside id="panel" aria-live="polite">
  <div class="panel-head" id="panel-head"></div>
  <button class="panel-close" id="panel-close" aria-label="Close">✕</button>
  <div class="panel-body" id="panel-body"></div>
</aside>

<div id="resume">
  <button class="resume-close" id="resume-close">Back to the game</button>
  ${this._resumeMarkup()}
</div>`
  }

  _resumeMarkup() {
    const jobs = EXPERIENCE.map(
      (j) => `
      <div class="r-job">
        <div class="r-top"><b>${esc(j.company)}</b><span class="r-when">${esc(j.period)}</span></div>
        <div class="r-sub">${esc(j.role)} — ${esc(j.place)}</div>
        <ul>${j.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      </div>`
    ).join('')

    const skills = SKILL_GROUPS.map(
      (g) => `<div><b>${esc(g.label)}:</b> ${esc(g.items.join(', '))}</div>`
    ).join('')

    return `
    <article class="resume-doc">
      <h1>${esc(PROFILE.name)}</h1>
      <div class="r-role">${esc(PROFILE.title)}</div>
      <div class="r-contact">
        ${esc(PROFILE.location)} · <a href="tel:${esc(PROFILE.phone.replace(/\s/g, ''))}">${esc(PROFILE.phone)}</a> ·
        <a href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a><br>
        <a href="${esc(PROFILE.github)}" target="_blank" rel="noopener">github.com/markyasser</a> ·
        <a href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener">linkedin.com/in/mark-yasser-2525711b6</a>
      </div>

      <h2>Summary</h2>
      <p style="font-size:13.5px;line-height:1.7;color:#2c3a4f;margin:0">${esc(PROFILE.summary)}</p>

      <h2>Experience</h2>
      ${jobs}

      <h2>Technical Skills</h2>
      <div class="r-skills">${skills}</div>

      <h2>Education</h2>
      <div class="r-job">
        <div class="r-top"><b>${esc(EDUCATION.school)}</b><span class="r-when">${esc(EDUCATION.period)}</span></div>
        <div class="r-sub">${esc(EDUCATION.degree)} — ${esc(EDUCATION.grade)}</div>
      </div>
    </article>`
  }

  // ------------------------------------------------------------ loading
  setProgress(value, status) {
    this.loadFill.style.width = `${Math.round(value * 100)}%`
    if (status) this.loadStatus.textContent = status
  }

  readyToStart() {
    this.loadStatus.textContent = 'Ready'
    this.startBtn.classList.add('ready')
  }

  hideLoading() {
    this.loading.classList.add('hidden')
  }

  // --------------------------------------------------------------- hud
  setSpeed(kmh) {
    this.gauge.textContent = Math.round(kmh)
  }

  setShards(found, total) {
    this.shardEl.textContent = `${found} / ${total}`
  }

  showPrompt(text, action) {
    this.promptText.textContent = text
    this._promptAction = action
    this.prompt.classList.add('show')
  }

  hidePrompt() {
    this.prompt.classList.remove('show')
    this._promptAction = null
  }

  toast(message, ms = 4200) {
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = message
    this.toastStack.appendChild(el)
    const t = setTimeout(() => {
      el.classList.add('leaving')
      setTimeout(() => el.remove(), 360)
      this._toastTimers.delete(t)
    }, ms)
    this._toastTimers.add(t)
    // Keep the stack short so it never covers the view.
    while (this.toastStack.children.length > 3) this.toastStack.firstChild.remove()
  }

  // ------------------------------------------------------------- panel
  get isPanelOpen() {
    return this.panel.classList.contains('open')
  }

  closePanel() {
    this.panel.classList.remove('open')
  }

  _open({ kicker, title, sub, body }) {
    // Only one reading surface at a time; the resume and the drawer would
    // otherwise cross-fade over each other.
    this.resume.classList.remove('open')
    this.panelHead.innerHTML = `
      <div class="panel-kicker">${esc(kicker)}</div>
      <div class="panel-title">${esc(title)}</div>
      ${sub ? `<div class="panel-sub">${sub}</div>` : ''}`
    this.panelBody.innerHTML = body
    this.panel.classList.add('open')
    this.panelBody.scrollTop = 0
  }

  openPOI(poi) {
    switch (poi.kind) {
      case 'about': return this.openAbout()
      case 'job': return this.openJob(poi.data)
      case 'skills': return this.openSkills()
      case 'education': return this.openEducation()
      case 'contact':
      case 'contactHub': return this.openContact(poi.data)
      case 'stunt': return this.openStunt()
      default: return null
    }
  }

  openAbout() {
    this._open({
      kicker: 'Start here',
      title: PROFILE.name,
      sub: `${esc(PROFILE.title)} · ${esc(PROFILE.location)}`,
      body: `
        <p>${esc(PROFILE.summary)}</p>
        <h4>By the numbers</h4>
        <div class="stat-grid">
          ${STATS.map((s) => `<div class="stat-card"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}
        </div>
        <h4>Where to drive</h4>
        <ul>
          <li><b>North</b> — Experience: Prepit, Cairo University, Gameball.</li>
          <li><b>East</b> — the Skills Yard. Crash through the crates, they are meant to be hit.</li>
          <li><b>West</b> — Education at Cairo University.</li>
          <li><b>South</b> — Contact portals: GitHub, LinkedIn, email.</li>
          <li><b>North-east</b> — the Stunt Park, purely for fun.</li>
        </ul>
        <p style="color:var(--muted);font-size:13px">Ten glowing shards ◆ are hidden around the map. Each one is a fact about my work.</p>`,
    })
  }

  openJob(job) {
    this._open({
      kicker: job.period,
      title: job.company,
      sub: `${esc(job.role)} · ${esc(job.place)}`,
      body: `
        <ul>${job.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        <h4>Stack</h4>
        <div class="tags">${job.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`,
    })
  }

  openSkills() {
    this._open({
      kicker: 'Skills Yard',
      title: 'Technical Skills',
      sub: 'Every crate out there carries one of these.',
      body: SKILL_GROUPS.map(
        (g) => `
        <div class="skill-block">
          <h5>${esc(g.label)}</h5>
          <div class="tags">${g.items.map((i) => `<span class="tag">${esc(i)}</span>`).join('')}</div>
        </div>`
      ).join(''),
    })
  }

  openEducation() {
    this._open({
      kicker: EDUCATION.period,
      title: EDUCATION.school,
      sub: `${esc(EDUCATION.degree)} · ${esc(EDUCATION.place)}`,
      body: `
        <div class="meta-row"><span class="meta-chip">${esc(EDUCATION.grade)}</span></div>
        <p style="margin-top:16px">Five years of Computer Engineering at Cairo University, graduating with honours — and later coming back to the same faculty as a teaching assistant for OOP and software engineering in C++.</p>
        <h4>Related</h4>
        <ul><li>Teaching Assistant, Faculty of Engineering — Feb to May 2025, 40+ students across lab sessions.</li></ul>`,
    })
  }

  openContact(link) {
    this._open({
      kicker: 'Get in touch',
      title: link ? link.label : 'Contact',
      sub: `${esc(PROFILE.location)} · open to backend and platform roles`,
      body: `
        <div class="link-list">
          ${CONTACT_LINKS.map(
            (l) => `<a class="link-btn" href="${esc(l.href)}" target="_blank" rel="noopener">
              <span class="ic">${ICONS[l.id] || ICONS.email}</span>
              <span><b>${esc(l.label)}</b><small>${esc(l.sub)}</small></span>
            </a>`
          ).join('')}
          <a class="link-btn" href="tel:${esc(PROFILE.phone.replace(/\s/g, ''))}" style="background:var(--teal)">
            <span class="ic">${ICONS.phone}</span>
            <span><b>Phone</b><small>${esc(PROFILE.phone)}</small></span>
          </a>
        </div>
        <p style="margin-top:20px;color:var(--muted);font-size:13px">Links open in a new tab.</p>`,
    })
  }

  openStunt() {
    this._open({
      kicker: 'Off the clock',
      title: 'Stunt Park',
      sub: 'No résumé content here. Just ramps.',
      body: `
        <p>Hit the big red kicker at speed, aim for the barrels, and see if you can bowl a strike with the pins by the fence.</p>
        <p style="color:var(--muted)">Landed upside down? The car rights itself after a moment —
        or press <b>R</b> to reset immediately.</p>`,
    })
  }

  openHelp() {
    this._open({
      kicker: 'How to play',
      title: 'Controls',
      sub: 'It is a car. It does what you expect.',
      body: `
        <h4>Driving</h4>
        <ul>
          <li><b>W / ↑</b> accelerate · <b>S / ↓</b> brake and reverse</li>
          <li><b>A / ←</b> and <b>D / →</b> steer</li>
          <li><b>Space</b> handbrake · <b>R</b> reset the car</li>
          <li><b>C</b> cycles the camera: follow, overhead, and a chase view that sits behind the car</li>
          <li><b>Scroll</b> (or pinch, or <b>+</b> / <b>&minus;</b>) to zoom the camera out over the map</li>
          <li><b>E</b> or <b>Enter</b> opens whatever you are parked next to</li>
          <li>A gamepad works too — left stick and triggers</li>
          <li>On a phone, use the on-screen pads</li>
        </ul>
        <h4>Everything is solid</h4>
        <p>Trees, rocks, lamps, barrels and every skill crate can be shoved,
        knocked over and smashed. Hit something hard enough and it breaks apart.
        Nothing you wreck matters — it is all scenery.</p>
        <h4>Not here to play?</h4>
        <p>The <b>CV</b> button in the top bar shows the whole résumé as plain, selectable, printable text.</p>`,
    })
  }

  toggleResume(open) {
    this.resume.classList.toggle('open', open)
    if (open) this.closePanel()
  }
}
