import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C, CSS, hex } from './palette.js'
import * as P from './props.js'
import { Breakables } from './breakables.js'
import {
  signTexture, heroTexture, crateTexture, statTexture,
  labelTexture, groundTexture, skyTexture,
} from './textures.js'
import { PROFILE, EXPERIENCE, EDUCATION, SKILL_GROUPS, STATS, CONTACT_LINKS, SHARD_FACTS } from './data.js'

export const WORLD_SIZE = 224
export const BOUNDS = 94
const ROAD_W = 11

// Floating labels fade between these distances from the camera.
const LABEL_FADE_NEAR = 6
const LABEL_FADE_FAR = 13

// How far a structure fades when it blocks the view.
const OCCLUDED_OPACITY = 0.18

let windowGeometry = null
function WINDOW_GEO() {
  if (!windowGeometry) windowGeometry = new THREE.BoxGeometry(1.5, 1.15, 0.18)
  return windowGeometry
}

// A fresh material per building: the occlusion fade clones and dims it, and a
// shared one would dim every building at once.
function windowMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x8fd2e8,
    emissive: 0x2b6d86,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.3,
  })
}

// Deterministic RNG so the scenery is identical on every load — the layout is
// part of the design, not something that should shuffle between visits.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Zone anchors. Everything else is positioned relative to these.
export const ZONES = {
  hub: { x: 0, z: 0, label: 'START' },
  experience: { x: 0, z: -64, label: 'EXPERIENCE' },
  skills: { x: 62, z: 0, label: 'SKILLS' },
  education: { x: -68, z: 0, label: 'EDUCATION' },
  contact: { x: 0, z: 70, label: 'CONTACT' },
  stunt: { x: 52, z: -52, label: 'STUNT PARK' },
}

export function buildWorld({ scene, world, renderer, materials, onBreak }) {
  const rng = mulberry32(20250913)
  const pois = []
  const shards = []
  const dynamics = []
  const billboarded = []
  const animated = []
  // Footprints that scenery must not spawn inside.
  const obstacles = []
  // Solid structures that should fade when they come between camera and car.
  const occluders = new Map()
  const occluderEntries = []
  const root = new THREE.Group()
  scene.add(root)

  const breakables = new Breakables({ scene: root, world, material: materials.prop, onBreak })

  const addPOI = (poi) => {
    pois.push({ radius: 11, ...poi })
    return poi
  }

  // ---------------------------------------------------------------- sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(hex(C.skyTop), hex(C.skyBottom)), side: THREE.BackSide, fog: false })
  )
  scene.add(sky)

  // Stylised cloud banks — cheap, and they give the sky some depth.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, fog: false })
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0)
  for (let i = 0; i < 26; i++) {
    const cluster = new THREE.Group()
    const puffs = 3 + Math.floor(rng() * 3)
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat)
      const s = 6 + rng() * 9
      puff.scale.set(s * 1.6, s * 0.65, s)
      puff.position.set((rng() - 0.5) * 26, (rng() - 0.5) * 5, (rng() - 0.5) * 14)
      cluster.add(puff)
    }
    const angle = rng() * Math.PI * 2
    const dist = 170 + rng() * 190
    cluster.position.set(Math.cos(angle) * dist, 62 + rng() * 46, Math.sin(angle) * dist)
    scene.add(cluster)
  }

  // ------------------------------------------------------------- ground
  const roads = [
    { points: [[0, -90], [0, 58]], width: ROAD_W },
    { points: [[-52, 0], [86, 0]], width: ROAD_W },
    { points: circlePoints(0, 0, 50, 48), width: 8 },
    { points: [[ZONES.stunt.x - 24, ZONES.stunt.z + 24], [ZONES.stunt.x + 16, ZONES.stunt.z - 16]], width: 9 },
    { points: [[-36, 40], [-60, 56]], width: 7, centerLine: false },
  ]
  const pads = [
    { x: 0, z: 0, r: 16, color: '#e6d7b2' },
    { x: ZONES.experience.x, z: -86, r: 17, color: '#ead9b8' },
    { x: ZONES.skills.x, z: ZONES.skills.z, r: 25, color: '#e2d3ae' },
    { x: ZONES.education.x, z: ZONES.education.z, r: 20, color: '#ead9b8' },
    { x: ZONES.contact.x, z: ZONES.contact.z, r: 20, color: '#e2d3ae' },
    { x: ZONES.stunt.x, z: ZONES.stunt.z, r: 24, color: '#dccfae' },
  ]

  const groundMap = groundTexture(renderer, { size: 2048, worldSize: WORLD_SIZE, roads, pads })
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ map: groundMap, roughness: 0.96, metalness: 0 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  root.add(ground)

  // A larger plain apron so the horizon doesn't show the texture's edge.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: C.grassDark, roughness: 1 })
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.y = -0.05
  root.add(apron)

  world.addBody(
    new CANNON.Body({
      mass: 0,
      material: materials.ground,
      shape: new CANNON.Plane(),
      quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0),
      collisionFilterGroup: P.STATIC_GROUP,
    })
  )

  // ---------------------------------------------------------- boundaries
  buildBoundary(root, world, materials)

  // ----------------------------------------------------------------- hub
  buildHub()

  // ---------------------------------------------------------- experience
  const streetZ = [-26, -46, -66]
  EXPERIENCE.forEach((job, i) => {
    const side = i % 2 === 0 ? -1 : 1
    buildCompany(job, { x: side * 19, z: streetZ[i], facing: side === -1 ? 1 : -1 })
  })
  buildStatsPlaza()

  // -------------------------------------------------------------- skills
  buildSkillYard()

  // ----------------------------------------------------------- education
  buildCampus()

  // ------------------------------------------------------------- contact
  buildContactPlaza()

  // ---------------------------------------------------------- stunt park
  buildStuntPark()

  // ------------------------------------------------------------- scenery
  scatterScenery()
  buildShards()

  // =========================================================== builders ==

  /** Local transform for an instanced part, relative to its body's centre. */
  function mat4(x, y, z, scaleY, scale) {
    const s = scale instanceof THREE.Vector3
      ? scale
      : new THREE.Vector3(scale ?? 1, scaleY ?? 1, scale ?? 1)
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), s)
  }

  function circlePoints(cx, cz, r, seg) {
    const pts = []
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
    return pts
  }

  function staticBox(mesh, size, position, rotationY = 0) {
    const q = new CANNON.Quaternion().setFromEuler(0, rotationY, 0)
    return P.boxBody({ world, size, position, mass: 0, material: materials.ground, quaternion: q })
  }

  /**
   * Mark a structure as something to fade out when it stands between the camera
   * and the car. With a fixed-angle camera the player cannot swing the view
   * around an obstacle, so anything solid has to get out of the way itself.
   *
   * Materials are cloned per structure: they are shared by default, and fading
   * a shared material would dim every building in the world at once. A
   * structure with several bodies (an arch has two legs and a beam) shares one
   * entry, so whichever the camera ray strikes fades the whole thing.
   */
  function registerOccluder(bodies, group) {
    const entry = { meshes: [], bodies: new Set(), fade: 1, applied: 1 }
    group.traverse((node) => {
      if (!node.isMesh) return
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => m.clone())
        : node.material.clone()
      entry.meshes.push(node)
    })
    if (!entry.meshes.length) return
    for (const body of [].concat(bodies)) {
      entry.bodies.add(body)
      occluders.set(body, entry)
    }
    occluderEntries.push(entry)
  }

  /**
   * `hitBody` is whatever the camera ray struck this frame, or null. Everything
   * it did not strike eases back to fully opaque.
   */
  function updateOcclusion(hitBody, dt) {
    for (const entry of occluderEntries) {
      const target = entry.bodies.has(hitBody) ? OCCLUDED_OPACITY : 1
      entry.fade = THREE.MathUtils.damp(entry.fade, target, 9, dt)
      if (Math.abs(entry.fade - target) < 0.01) entry.fade = target
      if (Math.abs(entry.fade - entry.applied) < 0.004) continue
      entry.applied = entry.fade

      for (const mesh of entry.meshes) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) {
          m.opacity = entry.fade
          // Staying in the opaque pass while solid avoids sorting artefacts.
          m.transparent = entry.fade < 0.995
          m.depthWrite = entry.fade > 0.6
        }
      }
    }
  }

  /** A painted disc on the ground marking where a landmark opens. */
  function addMarker(x, z, color, radius = 5) {
    const disc = P.meshOf(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }),
      { cast: false, receive: false }
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.set(x, 0.07, z)
    root.add(disc)

    const ring = P.meshOf(
      new THREE.RingGeometry(radius - 0.45, radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
      { cast: false, receive: false }
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, 0.09, z)
    root.add(ring)
  }

  function addLabel(text, position, { height = 1.5, color = CSS.cream, bg = 'rgba(34,48,74,0.9)' } = {}) {
    const sprite = P.floatingLabel(labelTexture(renderer, { text, color, bg }), height)
    sprite.position.copy(position)
    root.add(sprite)
    billboarded.push(sprite)
    return sprite
  }

  // --- Hub ---------------------------------------------------------------
  function buildHub() {
    const hero = P.billboard({
      texture: heroTexture(renderer, { name: PROFILE.short, title: PROFILE.title, tagline: PROFILE.tagline }),
      width: 17,
      height: 8.5,
      postHeight: 3,
    })
    hero.position.set(0, 0, -11)
    root.add(hero)
    registerOccluder(staticBox(hero, { x: 17, y: 8.5, z: 1 }, { x: 0, y: 7.25, z: -11 }), hero)

    // Plaza kerb, broken into four arcs so the roads pass through cleanly.
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(16, 0.32, 8, 28, THREE.MathUtils.degToRad(50)),
        P.std(C.cream, { roughness: 0.8 })
      )
      arc.rotation.x = Math.PI / 2
      arc.rotation.z = -THREE.MathUtils.degToRad(i * 90 + 20)
      arc.position.y = 0.18
      arc.receiveShadow = true
      root.add(arc)
    }

    // Direction posts pointing at each zone.
    const dirs = [
      { label: 'EXPERIENCE', angle: Math.PI, color: C.coral },
      { label: 'SKILLS', angle: Math.PI / 2, color: C.teal },
      { label: 'EDUCATION', angle: -Math.PI / 2, color: C.violet },
      { label: 'CONTACT', angle: 0, color: C.amber },
    ]
    for (const d of dirs) {
      // angle 0 => +Z (south/contact), PI => -Z (north/experience).
      // Each post is pushed sideways so it never blocks the road it points down.
      const dirX = Math.sin(d.angle)
      const dirZ = Math.cos(d.angle)
      const x = dirX * 15 + dirZ * 10.5
      const z = dirZ * 15 - dirX * 10.5
      const post = new THREE.Group()
      const pole = P.meshOf(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8), P.std(C.navy))
      pole.position.y = 2.6
      post.add(pole)

      const arrowTex = labelTexture(renderer, { text: `${d.label}  ▸`, bg: `rgba(${hexToRgb(d.color)},0.95)`, size: 110 })
      const arrow = P.floatingLabel(arrowTex, 0.85)
      arrow.position.set(x, 5.0, z)
      root.add(arrow)
      billboarded.push(arrow)

      post.position.set(x, 0, z)
      root.add(post)
      P.cylinderBody({ world, radius: 0.3, height: 5.2, position: { x, y: 2.6, z }, mass: 0, material: materials.ground })
    }

    addMarker(0, -4, C.coral, 6)
    addPOI({
      id: 'about',
      kind: 'about',
      position: new THREE.Vector3(0, 1, -4),
      radius: 13,
      title: 'About Mark',
    })

    // Welcome arch over the spawn road.
    buildArch({ x: 0, z: 27, width: 15, height: 8, color: C.navy, label: 'PORTFOLIO', accent: C.coral })
  }

  /**
   * A gateway arch. Placement is passed in rather than applied by the caller,
   * because the leg colliders have to be built in final world space — creating
   * them before the group is positioned strands them at the origin.
   */
  function buildArch({ x = 0, z = 0, rotY = 0, width, height, color, label, accent }) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = rotY
    root.add(g)

    const legGeo = new RoundedBoxGeometry(1.5, height, 1.5, 3, 0.2)
    const cos = Math.cos(rotY)
    const sin = Math.sin(rotY)
    const legBodies = []
    for (const lx of [-width / 2, width / 2]) {
      const leg = P.meshOf(legGeo, P.std(color))
      leg.position.set(lx, height / 2, 0)
      g.add(leg)
      legBodies.push(P.boxBody({
        world,
        size: { x: 1.6, y: height, z: 1.6 },
        position: { x: x + lx * cos, y: height / 2, z: z - lx * sin },
        mass: 0,
        material: materials.ground,
        quaternion: new CANNON.Quaternion().setFromEuler(0, rotY, 0),
      }))
      obstacles.push({ x: x + lx * cos, z: z - lx * sin, r: 5 })
    }

    // The beam across the road blocks the view long before a leg does, so it
    // needs a body of its own for the camera ray to find. It sits well above
    // the road, so it only ever matters to a car that is already airborne.
    const beamBody = P.boxBody({
      world,
      size: { x: width + 2.4, y: 2.4, z: 1.8 },
      position: { x, y: height + 0.6, z },
      mass: 0,
      material: materials.ground,
      quaternion: new CANNON.Quaternion().setFromEuler(0, rotY, 0),
    })

    const beam = P.meshOf(new RoundedBoxGeometry(width + 2.4, 1.9, 1.6, 3, 0.2), P.std(color))
    beam.position.y = height + 0.6
    g.add(beam)
    const stripe = P.meshOf(new THREE.BoxGeometry(width + 2.4, 0.3, 1.7), P.std(accent))
    stripe.position.y = height - 0.44
    g.add(stripe)

    if (label) {
      const tex = labelTexture(renderer, { text: label, bg: null, color: CSS.cream, size: 150 })
      const plate = P.floatingLabel(tex, 1.5)
      plate.position.set(0, height + 0.6, 0.85)
      g.add(plate)
      const back = plate.clone()
      back.position.z = -0.85
      back.rotation.y = Math.PI
      g.add(back)
    }

    // Registered last: the registry snapshots the group's meshes, so every part
    // of the arch has to exist before this runs.
    registerOccluder([...legBodies, beamBody], g)
    return g
  }

  // --- Experience --------------------------------------------------------
  function buildCompany(job, { x, z, facing }) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    // facing: +1 means the front faces +X, -1 means it faces -X.
    g.rotation.y = facing === 1 ? Math.PI / 2 : -Math.PI / 2
    root.add(g)

    const w = 12.5
    const d = 9.5
    const h = job.floors * 2.7

    const tower = P.meshOf(new RoundedBoxGeometry(w, h, d, 3, 0.22), P.std(C.cream, { roughness: 0.85 }))
    tower.position.y = h / 2
    g.add(tower)

    const roof = P.meshOf(new RoundedBoxGeometry(w + 0.9, 0.7, d + 0.9, 3, 0.18), P.std(job.accent))
    roof.position.y = h + 0.3
    g.add(roof)

    const plinth = P.meshOf(new RoundedBoxGeometry(w + 2.2, 0.55, d + 2.2, 3, 0.15), P.std(C.sand, { roughness: 0.95 }))
    plinth.position.y = 0.27
    g.add(plinth)

    // Windows as one instanced mesh per building. Instancing keeps the draw
    // calls down; keeping it inside the building's own group means the
    // occlusion fade takes the windows with it instead of leaving them hanging
    // in mid-air when the wall goes transparent.
    const winSlots = []
    for (let f = 0; f < job.floors; f++) {
      for (let c = 0; c < 4; c++) {
        if (f === 0 && (c === 1 || c === 2)) continue // leave room for the door
        for (const zz of [d / 2 + 0.02, -d / 2 - 0.02]) {
          winSlots.push(new THREE.Vector3(-w / 2 + 2.2 + c * 2.7, 1.9 + f * 2.7, zz))
        }
      }
    }
    const windows = new THREE.InstancedMesh(WINDOW_GEO(), windowMaterial(), winSlots.length)
    windows.castShadow = false
    windows.receiveShadow = true
    const wm = new THREE.Matrix4()
    winSlots.forEach((local, i) => {
      wm.makeTranslation(local.x, local.y, local.z)
      windows.setMatrixAt(i, wm)
    })
    windows.instanceMatrix.needsUpdate = true
    g.add(windows)

    // Entrance.
    const door = P.meshOf(new RoundedBoxGeometry(3.4, 3.0, 0.3, 3, 0.1), P.std(C.navy))
    door.position.set(0, 1.5, d / 2 + 0.05)
    g.add(door)
    const canopy = P.meshOf(new RoundedBoxGeometry(5.2, 0.35, 2.2, 3, 0.12), P.std(job.accent))
    canopy.position.set(0, 3.3, d / 2 + 1.0)
    g.add(canopy)

    // Company sign on the roof, plus a road-facing billboard.
    const roofSign = P.billboard({
      texture: signTexture(renderer, {
        title: job.company,
        subtitle: job.role,
        meta: job.period,
        accent: hex(job.accent),
        width: 1024,
        height: 420,
      }),
      width: 10.5,
      height: 4.3,
      postHeight: 0.5,
      frame: job.accent,
    })
    roofSign.position.set(0, h + 0.6, 0)
    g.add(roofSign)

    const flagpole = P.flag(job.accent)
    flagpole.position.set(w / 2 + 2.4, 0, d / 2 + 1.2)
    g.add(flagpole)
    animated.push(flagpole)

    const lampA = P.lamp()
    lampA.position.set(-w / 2 - 2.4, 0, d / 2 + 3)
    lampA.rotation.y = Math.PI
    g.add(lampA)

    registerOccluder(
      staticBox(tower, { x: w + 2, y: h, z: d + 2 }, { x, y: h / 2, z }, g.rotation.y),
      g
    )
    obstacles.push({ x, z, r: 16 })

    addPOI({
      id: job.id,
      kind: 'job',
      data: job,
      position: new THREE.Vector3(x + facing * 10.5, 1, z),
      radius: 11,
      title: job.company,
    })

    addMarker(x + facing * 10.5, z, job.accent)
    // High above the roof, so it reads from across the map without looming over
    // the spot where the player actually parks.
    addLabel(job.company.toUpperCase(), new THREE.Vector3(x, h + 8, z), {
      height: 1.1,
      bg: `rgba(${hexToRgb(job.accent)},0.95)`,
    })
  }

  function buildStatsPlaza() {
    buildArch({ x: 0, z: -74, width: 16, height: 7.5, color: C.coral, label: 'IMPACT', accent: C.cream })

    // Two markers a side, lining the final stretch of the experience avenue.
    const slots = [
      [-11, -80], [11, -80], [-11, -90], [11, -90],
    ]
    STATS.forEach((s, i) => {
      const [x, z] = slots[i]
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2
      root.add(g)
      obstacles.push({ x, z, r: 7 })

      const post = P.meshOf(new RoundedBoxGeometry(0.8, 3.2, 0.8, 3, 0.15), P.std(C.navy))
      post.position.y = 1.6
      g.add(post)

      const accent = [CSS.coral, CSS.teal, CSS.amber, '#7a6cf0'][i % 4]
      const panel = P.meshOf(
        new RoundedBoxGeometry(5, 5, 0.4, 3, 0.16),
        [P.std(C.navy), P.std(C.navy), P.std(C.navy), P.std(C.navy),
          new THREE.MeshStandardMaterial({ map: statTexture(renderer, { ...s, accent }), roughness: 0.8 }),
          P.std(C.navy)]
      )
      panel.position.y = 5.4
      g.add(panel)

      P.boxBody({ world, size: { x: 1.2, y: 3.2, z: 1.2 }, position: { x, y: 1.6, z }, mass: 0, material: materials.ground })
    })
  }

  // --- Skills ------------------------------------------------------------
  function buildSkillYard() {
    const { x: cx, z: cz } = ZONES.skills
    buildArch({
      x: cx - 27, z: 0, rotY: Math.PI / 2,
      width: 15, height: 8, color: C.teal, label: 'SKILLS YARD', accent: C.cream,
    })

    const cols = 3
    const spacing = 15.5
    SKILL_GROUPS.forEach((group, i) => {
      const gx = cx + ((i % cols) - 1) * spacing
      const gz = cz + (Math.floor(i / cols) - 1) * spacing
      buildSkillStack(group, gx, gz)
    })

    addPOI({
      id: 'skills',
      kind: 'skills',
      position: new THREE.Vector3(cx, 1, cz),
      radius: 24,
      title: 'Technical Skills',
    })
  }

  function buildSkillStack(group, gx, gz) {
    // Small plinth + group label, then a pyramid of crates to knock over.
    obstacles.push({ x: gx, z: gz, r: 9 })
    const plinth = P.meshOf(new THREE.CylinderGeometry(4.9, 5.3, 0.4, 24), P.std(C.sand, { roughness: 0.95 }))
    plinth.position.set(gx, 0.2, gz)
    plinth.receiveShadow = true
    root.add(plinth)

    const ring = P.meshOf(new THREE.TorusGeometry(4.9, 0.16, 6, 32), P.std(group.color))
    ring.rotation.x = Math.PI / 2
    ring.position.set(gx, 0.42, gz)
    root.add(ring)

    addLabel(group.label.toUpperCase(), new THREE.Vector3(gx, 6.6, gz), {
      height: 0.85,
      bg: `rgba(${hexToRgb(group.color)},0.95)`,
    })

    // A loose two-row pyramid. Gaps between crates matter: tightly packed,
    // interlocked stacks wedge against each other and stop the car dead
    // instead of scattering.
    const size = 1.45
    const gap = size * 0.42
    const pitch = size + gap
    const items = group.items
    const bottomCount = Math.min(4, Math.ceil(items.length / 2) + (items.length > 5 ? 1 : 0))
    const rows = [items.slice(0, bottomCount), items.slice(bottomCount)]

    rows.forEach((row, r) => {
      row.forEach((item, c) => {
        const ox = (c - (row.length - 1) / 2) * pitch
        const mesh = P.crate({ texture: crateTexture(renderer, { label: item, color: hex(group.color) }), size })
        const pos = { x: gx + ox, y: 0.45 + size / 2 + r * (size + 0.04), z: gz }
        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.rotation.y = (c * 0.09 - 0.1) * (r + 1)
        root.add(mesh)
        const body = P.boxBody({
          world,
          size: { x: size, y: size, z: size },
          position: pos,
          mass: 2.6,
          material: materials.prop,
          quaternion: new CANNON.Quaternion().setFromEuler(0, mesh.rotation.y, 0),
        })
        body.angularDamping = 0.25
        dynamics.push({ mesh, body })
        breakables.adopt(body, mesh, {
          breakAt: 5.5, chunkColor: group.color, chunks: 7, chunkSize: 0.8,
        })
      })
    })
  }

  // --- Education ---------------------------------------------------------
  function buildCampus() {
    const { x: cx, z: cz } = ZONES.education
    const g = new THREE.Group()
    g.position.set(cx, 0, cz)
    g.rotation.y = Math.PI / 2 // front faces +X, back toward the hub road
    root.add(g)

    // Stepped base.
    for (let i = 0; i < 3; i++) {
      const step = P.meshOf(
        new THREE.BoxGeometry(26 - i * 2.2, 0.45, 18 - i * 2.2),
        P.std(i % 2 ? C.cream : C.sand, { roughness: 0.95 })
      )
      step.position.y = 0.22 + i * 0.45
      g.add(step)
    }

    const hall = P.meshOf(new RoundedBoxGeometry(19, 7.5, 12, 3, 0.25), P.std(C.cream, { roughness: 0.9 }))
    hall.position.y = 1.35 + 3.75
    g.add(hall)

    // Colonnade.
    const colGeo = new THREE.CylinderGeometry(0.62, 0.68, 7.2, 14)
    for (let i = 0; i < 6; i++) {
      const col = P.meshOf(colGeo, P.std(C.white, { roughness: 0.85 }))
      col.position.set(-9 + i * 3.6, 1.35 + 3.6, 6.6)
      g.add(col)
    }
    const entablature = P.meshOf(new THREE.BoxGeometry(20, 1.1, 3.4), P.std(C.cream))
    entablature.position.set(0, 1.35 + 7.75, 6.0)
    g.add(entablature)

    // Classical pediment: a real triangular prism sitting on the entablature.
    const tri = new THREE.Shape()
    tri.moveTo(-10, 0)
    tri.lineTo(10, 0)
    tri.lineTo(0, 3.2)
    tri.lineTo(-10, 0)
    const pedGeo = new THREE.ExtrudeGeometry(tri, { depth: 3.2, bevelEnabled: false })
    pedGeo.translate(0, 0, -1.6)
    const pediment = P.meshOf(pedGeo, P.std(C.violet, { roughness: 0.85 }))
    pediment.position.set(0, 1.35 + 8.3, 6.0)
    g.add(pediment)

    // Oversized graduation cap crowning the hall.
    const cap = new THREE.Group()
    const head = P.meshOf(new THREE.CylinderGeometry(1.5, 1.7, 1.3, 16), P.std(C.navy))
    cap.add(head)
    const board = P.meshOf(new THREE.BoxGeometry(5.6, 0.34, 5.6), P.std(C.navy))
    board.position.y = 0.85
    board.rotation.y = Math.PI / 4
    cap.add(board)
    const button = P.meshOf(new THREE.SphereGeometry(0.26, 10, 8), P.std(C.amber))
    button.position.y = 1.1
    cap.add(button)
    const tassel = P.meshOf(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), P.std(C.amber))
    tassel.position.set(1.9, 0.1, 1.9)
    cap.add(tassel)
    cap.position.set(0, 1.35 + 7.5 + 1.1, -1)
    g.add(cap)

    const sign = P.billboard({
      texture: signTexture(renderer, {
        title: EDUCATION.school,
        subtitle: `${EDUCATION.degree} — ${EDUCATION.grade}`,
        meta: EDUCATION.period,
        accent: '#7a6cf0',
        width: 1024,
        height: 440,
      }),
      width: 13,
      height: 5.6,
      postHeight: 2.6,
      frame: C.violet,
    })
    sign.position.set(0, 0, 14)
    g.add(sign)

    registerOccluder(staticBox(hall, { x: 26, y: 9, z: 18 }, { x: cx, y: 4.5, z: cz }, g.rotation.y), g)
    obstacles.push({ x: cx, z: cz, r: 26 })

    addPOI({
      id: 'education',
      kind: 'education',
      position: new THREE.Vector3(cx + 14, 1, cz),
      radius: 13,
      title: EDUCATION.school,
    })
    addMarker(cx + 14, cz, C.violet)
    addLabel('EDUCATION', new THREE.Vector3(cx, 18, cz), { height: 1.1, bg: 'rgba(122,108,240,0.95)' })
  }

  // --- Contact -----------------------------------------------------------
  function buildContactPlaza() {
    const { x: cx, z: cz } = ZONES.contact
    buildArch({ x: 0, z: cz - 26, width: 16, height: 8.5, color: C.amber, label: 'GET IN TOUCH', accent: C.navy })

    CONTACT_LINKS.forEach((link, i) => {
      const x = cx + (i - 1) * 17
      const z = cz
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = Math.PI
      root.add(g)

      // A ring portal you drive up to.
      const ring = P.meshOf(new THREE.TorusGeometry(4.4, 0.55, 12, 40), P.std(link.color, { roughness: 0.5, metalness: 0.2 }))
      ring.position.y = 5.2
      g.add(ring)

      const pillar = P.meshOf(new RoundedBoxGeometry(2.4, 1.6, 2.4, 3, 0.2), P.std(C.navy))
      pillar.position.y = 0.8
      g.add(pillar)

      const inner = P.meshOf(
        new THREE.CircleGeometry(3.9, 32),
        new THREE.MeshBasicMaterial({ color: link.color, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
      )
      inner.position.y = 5.2
      g.add(inner)

      const tex = labelTexture(renderer, { text: link.label.toUpperCase(), bg: `rgba(${hexToRgb(link.color)},0.95)`, size: 120 })
      const plate = P.floatingLabel(tex, 1.35)
      plate.userData.billboarded = false
      plate.position.set(0, 10.8, 0)
      g.add(plate)

      P.boxBody({ world, size: { x: 2.6, y: 1.6, z: 2.6 }, position: { x, y: 0.8, z }, mass: 0, material: materials.ground })
      obstacles.push({ x, z, r: 10 })

      addMarker(x, z - 4, link.color, 4.5)
      addPOI({
        id: link.id,
        kind: 'contact',
        data: link,
        position: new THREE.Vector3(x, 1, z - 4),
        radius: 9,
        title: link.label,
      })
      animated.push(ring)
    })

    addPOI({
      id: 'contact',
      kind: 'contactHub',
      position: new THREE.Vector3(cx, 1, cz - 16),
      radius: 11,
      title: 'Contact',
    })
  }

  // --- Stunt park --------------------------------------------------------
  function buildStuntPark() {
    const { x: cx, z: cz } = ZONES.stunt

    const placeRamp = (x, z, rotY, opts) => {
      const r = P.ramp(opts)
      // A hair below grade: the slab's leading corner must not stand proud of
      // the ground, or the car slams into it instead of riding up.
      r.position.set(x, -0.07, z)
      r.rotation.y = rotY
      root.add(r)
      const s = r.userData.slab
      const q = new CANNON.Quaternion()
      const qy = new CANNON.Quaternion().setFromEuler(0, rotY, 0)
      const qz = new CANNON.Quaternion().setFromEuler(0, 0, s.angle)
      qy.mult(qz, q)
      // The slab's local centre offset has to be rotated into world space too.
      const off = new THREE.Vector3(s.cx, s.cy, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      P.boxBody({
        world,
        size: { x: s.hyp, y: s.thickness, z: s.width },
        position: { x: x + off.x, y: off.y - 0.07, z: z + off.z },
        mass: 0,
        material: materials.ground,
        quaternion: q,
      })
      obstacles.push({ x, z, r: Math.max(opts.run, opts.width) })
      return r
    }

    // The big kicker is aimed straight down the approach road, so the whole
    // diagonal spur doubles as its run-up.
    const DIAG = Math.PI / 4
    placeRamp(cx - 9, cz + 9, DIAG, { width: 11, run: 17, rise: 2.9, color: C.coral })
    // Landing ramp on the far side of the gap.
    placeRamp(cx + 13, cz - 13, DIAG - Math.PI, { width: 11, run: 15, rise: 2.3, color: C.coral })
    // Two free-play ramps with clear, open approaches across the plaza.
    placeRamp(cx, cz + 18, Math.PI / 2, { width: 9, run: 13, rise: 2.1, color: C.amber })
    placeRamp(cx - 2, cz - 18, -Math.PI / 2, { width: 9, run: 13, rise: 2.1, color: C.teal })

    // Bowling lane: ten pins in a triangle.
    let n = 0
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        const px = cx + 14 + row * 1.5
        const pz = cz + 20 + (col - row / 2) * 1.6
        const mesh = P.pin()
        mesh.position.set(px, 0, pz)
        root.add(mesh)
        const body = P.cylinderBody({
          world, radius: 0.3, height: 1.6, position: { x: px, y: 0.8, z: pz }, mass: 1.6, material: materials.prop,
        })
        dynamics.push({ mesh, body, yOffset: -0.8 })
        breakables.adopt(body, mesh, { breakAt: Infinity })
        n++
      }
    }
    addLabel('STRIKE!', new THREE.Vector3(cx + 17, 4.4, cz + 20), { height: 1, bg: 'rgba(239,111,92,0.95)' })

    // Slalom cones down the approach road.
    for (let i = 0; i < 10; i++) {
      const t = i / 9
      const px = cx - 38 + t * 22
      const pz = cz + 38 - t * 22 + Math.sin(i * 1.15) * 3.4
      addCone(px, pz)
    }

    // Barrel stacks to smash.
    const colors = [C.amber, C.teal, C.coral, C.violet]
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      addBarrel(cx + Math.cos(a) * 20, cz + Math.sin(a) * 20, colors[i % colors.length])
    }

    addPOI({
      id: 'stunt',
      kind: 'stunt',
      position: new THREE.Vector3(cx, 1, cz),
      radius: 18,
      title: 'Stunt Park',
    })

    buildArch({
      x: cx - 25, z: cz + 25, rotY: -Math.PI / 4,
      width: 13, height: 7, color: C.violet, label: 'STUNT PARK', accent: C.amber,
    })
  }

  function addCone(x, z) {
    const mesh = P.cone()
    mesh.position.set(x, 0, z)
    root.add(mesh)
    const body = P.cylinderBody({
      world, radius: 0.36, height: 1.0, position: { x, y: 0.5, z }, mass: 0.9, material: materials.prop, segments: 8,
    })
    dynamics.push({ mesh, body, yOffset: -0.5 })
  }

  function addBarrel(x, z, color) {
    const mesh = P.barrel(color)
    mesh.position.set(x, 0, z)
    root.add(mesh)
    const body = P.cylinderBody({
      world, radius: 0.48, height: 1.2, position: { x, y: 0.6, z }, mass: 5, material: materials.prop, segments: 10,
    })
    dynamics.push({ mesh, body, yOffset: -0.6 })
    breakables.adopt(body, mesh, { breakAt: 6, chunkColor: color, chunks: 6, chunkSize: 0.8 })
  }

  // --- Scenery -----------------------------------------------------------
  function scatterScenery() {
    const keepOut = [
      ...Object.values(ZONES).map((z) => ({ x: z.x, z: z.z, r: 27 })),
      ...obstacles,
    ]
    const onRoad = (x, z) => {
      if (Math.abs(x) < 9 && Math.abs(z) < 92) return true
      if (Math.abs(z) < 9 && Math.abs(x) < 92) return true
      const r = Math.hypot(x, z)
      if (Math.abs(r - 50) < 7) return true
      // The diagonal spur out to the stunt park.
      if (Math.abs(x + z) < 9 && x > 18 && x < 80) return true
      return false
    }

    // Instanced part pools. Six draw calls cover every tree, bush, rock and
    // lamp in the world, however many of them the player knocks over.
    const trunk = breakables.pool('trunk', () => ({
      geometry: new THREE.CylinderGeometry(0.17, 0.26, 1, 7),
      material: P.std(0x8a6a4a),
    }), 140)
    const leaf = breakables.pool('leaf', () => ({
      geometry: new THREE.IcosahedronGeometry(1, 0),
      material: P.std(0xffffff, { flatShading: true }),
    }), 420)
    const stone = breakables.pool('stone', () => ({
      geometry: new THREE.DodecahedronGeometry(1, 0),
      material: P.std(0xffffff, { flatShading: true }),
    }), 90)
    const pole = breakables.pool('pole', () => ({
      geometry: new THREE.CylinderGeometry(0.09, 0.13, 1, 8),
      material: P.std(C.navy, { roughness: 0.5 }),
    }), 40)
    const bulb = breakables.pool('bulb', () => ({
      geometry: new THREE.SphereGeometry(0.26, 10, 8),
      material: P.std(0xfff3cf, { emissive: 0xffe9a8, emissiveIntensity: 0.9, roughness: 0.3 }),
    }), 40)

    const leafShades = [0x5f9e52, 0x6fae5e, 0x54904a]

    const plantTree = (x, z) => {
      const h = 2.4 + rng() * 1.7
      const trunkH = h * 0.55
      const half = h * 0.72
      const parts = [
        {
          pool: trunk,
          matrix: mat4(0, -half + trunkH / 2, 0, trunkH, 1),
          color: new THREE.Color(0xffffff),
        },
      ]
      for (let i = 0; i < 2; i++) {
        const size = (1.15 - i * 0.28) * (0.9 + rng() * 0.3)
        parts.push({
          pool: leaf,
          matrix: mat4((rng() - 0.5) * 0.5, -half + trunkH + 0.35 + i * 0.75, (rng() - 0.5) * 0.5, size, size),
          color: new THREE.Color(leafShades[Math.floor(rng() * leafShades.length)]),
        })
      }
      breakables.add({
        parts,
        shape: new CANNON.Cylinder(0.55, 0.7, h * 1.44, 8),
        mass: 26,
        position: { x, y: half, z },
        rotY: rng() * Math.PI * 2,
        breakAt: 6,
        chunkColor: 0x8a6a4a,
        chunks: 7,
        chunkSize: 0.9,
      })
    }

    const plantBush = (x, z) => {
      const size = 0.55 + rng() * 0.45
      breakables.add({
        parts: [{
          pool: leaf,
          matrix: mat4(0, 0, 0, size, size),
          color: new THREE.Color(leafShades[Math.floor(rng() * leafShades.length)]),
        }],
        shape: new CANNON.Sphere(size * 0.85),
        mass: 3,
        position: { x, y: size * 0.8, z },
        rotY: rng() * Math.PI * 2,
        breakAt: 2.5,
        chunkColor: 0x6fae5e,
        chunks: 6,
        chunkSize: 0.6,
      })
    }

    const plantRock = (x, z) => {
      const size = 0.6 + rng() * 0.8
      breakables.add({
        parts: [{
          pool: stone,
          matrix: mat4(0, 0, 0, size, new THREE.Vector3(size, size * 0.75, size * 0.9)),
          color: new THREE.Color(0x9aa3ad).offsetHSL(0, 0, (rng() - 0.5) * 0.12),
        }],
        shape: new CANNON.Sphere(size * 0.8),
        mass: 48,
        position: { x, y: size * 0.7, z },
        rotY: rng() * Math.PI * 2,
        breakAt: 11,
        chunkColor: 0x9aa3ad,
        chunks: 6,
        chunkSize: 0.85,
      })
    }

    let placed = 0
    let guard = 0
    while (placed < 130 && guard < 6000) {
      guard++
      const x = (rng() - 0.5) * 2 * (BOUNDS - 6)
      const z = (rng() - 0.5) * 2 * (BOUNDS - 6)
      if (onRoad(x, z)) continue
      if (keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue

      const roll = rng()
      if (roll < 0.5) plantTree(x, z)
      else if (roll < 0.8) plantBush(x, z)
      else plantRock(x, z)
      placed++
    }

    // Street lamps down the two main avenues — knockable, like everything else.
    const plantLamp = (x, z, rotY) => {
      breakables.add({
        parts: [
          { pool: pole, matrix: mat4(0, 0, 0, 4.4, 1) },
          { pool: bulb, matrix: mat4(Math.sin(rotY) * 0.84, 2.0, Math.cos(rotY) * 0.84, 1, 1) },
        ],
        shape: new CANNON.Cylinder(0.22, 0.22, 4.4, 6),
        mass: 15,
        position: { x, y: 2.2, z },
        breakAt: 4.5,
        chunkColor: C.navy,
        chunks: 6,
        chunkSize: 0.7,
      })
    }
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue
      plantLamp(-ROAD_W / 2 - 1.8, i * 15, 0)
      plantLamp(i * 15, -ROAD_W / 2 - 1.8, Math.PI / 2)
    }

    // A small lake in the quiet quarter.
    const lake = P.meshOf(
      new THREE.CircleGeometry(17, 40),
      new THREE.MeshStandardMaterial({ color: 0x63b8d8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }),
      { cast: false }
    )
    lake.rotation.x = -Math.PI / 2
    lake.position.set(-64, 0.06, 60)
    root.add(lake)
    const shore = P.meshOf(new THREE.RingGeometry(17, 19.5, 40), P.std(C.sand, { roughness: 1 }), { cast: false })
    shore.rotation.x = -Math.PI / 2
    shore.position.set(-64, 0.04, 60)
    root.add(shore)
  }

  function buildBoundary(parent, world, materials) {
    const hedgeMat = P.std(0x4f8a48, { flatShading: true })
    const geoBox = new THREE.BoxGeometry(4, 3, 2.4)
    const count = Math.ceil((BOUNDS * 2) / 4) * 4 + 8
    const inst = new THREE.InstancedMesh(geoBox, hedgeMat, count)
    inst.castShadow = true
    inst.receiveShadow = true
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    let i = 0
    const step = 4
    for (let t = -BOUNDS; t <= BOUNDS; t += step) {
      const wobble = () => 1 + (rng() - 0.5) * 0.25
      const sides = [
        [t, -BOUNDS, 0],
        [t, BOUNDS, 0],
        [-BOUNDS, t, Math.PI / 2],
        [BOUNDS, t, Math.PI / 2],
      ]
      for (const [x, z, ry] of sides) {
        if (i >= count) break
        q.setFromEuler(new THREE.Euler(0, ry, 0))
        s.set(wobble(), wobble(), wobble())
        m.compose(new THREE.Vector3(x, 1.5 * s.y, z), q, s)
        inst.setMatrixAt(i++, m)
      }
    }
    inst.count = i
    parent.add(inst)

    // Four static walls, slightly inside the hedge line.
    const wall = (x, z, sx, sz) =>
      P.boxBody({ world, size: { x: sx, y: 8, z: sz }, position: { x, y: 4, z }, mass: 0, material: materials.ground })
    wall(0, -BOUNDS, BOUNDS * 2 + 8, 3)
    wall(0, BOUNDS, BOUNDS * 2 + 8, 3)
    wall(-BOUNDS, 0, 3, BOUNDS * 2 + 8)
    wall(BOUNDS, 0, 3, BOUNDS * 2 + 8)
  }

  // --- Collectibles ------------------------------------------------------
  function buildShards() {
    const spots = [
      [30, 30], [-32, -26], [50, 26], [-50, -34], [20, -82],
      [82, -20], [-82, 24], [-26, 78], [36, 74], [-64, 60],
    ]
    const shardGeo = new THREE.OctahedronGeometry(0.9, 0)
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xfff0b8,
      emissive: 0xf5b942,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.4,
    })
    spots.forEach(([x, z], i) => {
      const mesh = new THREE.Mesh(shardGeo, shardMat)
      mesh.position.set(x, 1.9, z)
      mesh.castShadow = true
      root.add(mesh)

      const halo = P.meshOf(
        new THREE.RingGeometry(1.5, 1.9, 24),
        new THREE.MeshBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
        { cast: false, receive: false }
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.set(x, 0.1, z)
      root.add(halo)

      shards.push({ mesh, halo, position: new THREE.Vector3(x, 1.9, z), collected: false, fact: SHARD_FACTS[i % SHARD_FACTS.length] })
    })
  }

  // ---------------------------------------------------------------- tick
  const camPos = new THREE.Vector3()
  function update(dt, elapsed, camera) {
    camera.getWorldPosition(camPos)
    for (const sprite of billboarded) {
      sprite.rotation.y = Math.atan2(camPos.x - sprite.position.x, camPos.z - sprite.position.z)
      // Fade out up close. These are wayfinding signs read from a distance; at
      // arm's length they just fill the screen and hide what you drove up to.
      const d = camPos.distanceTo(sprite.position)
      const opacity = THREE.MathUtils.smoothstep(d, LABEL_FADE_NEAR, LABEL_FADE_FAR)
      sprite.material.opacity = opacity
      sprite.visible = opacity > 0.02
    }
    for (const obj of animated) {
      const cloth = obj.userData.cloth
      if (cloth) {
        cloth.rotation.y = Math.sin(elapsed * 2.4) * 0.25
        cloth.scale.x = 1 + Math.sin(elapsed * 3.1) * 0.06
      } else {
        obj.rotation.z = elapsed * 0.6
      }
    }
    for (const s of shards) {
      if (s.collected) continue
      s.mesh.rotation.y = elapsed * 1.6
      s.mesh.rotation.x = Math.sin(elapsed * 1.2) * 0.3
      s.mesh.position.y = 1.9 + Math.sin(elapsed * 2 + s.position.x) * 0.28
      s.halo.scale.setScalar(1 + Math.sin(elapsed * 2.6 + s.position.z) * 0.12)
    }
  }

  function syncDynamics() {
    for (const d of dynamics) {
      if (!d.mesh.visible) continue
      d.mesh.position.copy(d.body.position)
      d.mesh.quaternion.copy(d.body.quaternion)
      if (d.yOffset) {
        // Group-based props are modelled with their origin at the ground, while
        // the physics body sits at the shape's centre.
        d.mesh.position.add(
          new THREE.Vector3(0, d.yOffset, 0).applyQuaternion(d.mesh.quaternion)
        )
      }
    }
  }

  /** True when this body belongs to a structure that fades rather than blocks. */
  function canFade(body) {
    return occluders.has(body)
  }

  return {
    root, pois, shards, dynamics, breakables, ground,
    update, syncDynamics, updateOcclusion, canFade,
  }
}

function hexToRgb(n) {
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
