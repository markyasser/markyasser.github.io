import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C, CSS, hex } from './palette.js'
import * as P from './props.js'
import {
  signTexture, heroTexture, crateTexture, statTexture,
  labelTexture, groundTexture, skyTexture,
} from './textures.js'
import { PROFILE, EXPERIENCE, EDUCATION, SKILL_GROUPS, STATS, CONTACT_LINKS, SHARD_FACTS } from './data.js'

export const WORLD_SIZE = 256
export const BOUNDS = 112
const ROAD_W = 11

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
  experience: { x: 0, z: -74, label: 'EXPERIENCE' },
  skills: { x: 72, z: 0, label: 'SKILLS' },
  education: { x: -78, z: 0, label: 'EDUCATION' },
  contact: { x: 0, z: 82, label: 'CONTACT' },
  stunt: { x: 58, z: -58, label: 'STUNT PARK' },
}

export function buildWorld({ scene, world, renderer, materials }) {
  const rng = mulberry32(20250913)
  const pois = []
  const shards = []
  const dynamics = []
  const billboarded = []
  const animated = []
  // Footprints that scenery must not spawn inside.
  const obstacles = []
  // Window placements, batched into one instanced mesh after the buildings exist.
  const windowSlots = []
  const root = new THREE.Group()
  scene.add(root)

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
    { points: [[0, -104], [0, 66]], width: ROAD_W },
    { points: [[-60, 0], [96, 0]], width: ROAD_W },
    { points: circlePoints(0, 0, 58, 48), width: 8 },
    { points: [[ZONES.stunt.x - 26, ZONES.stunt.z + 26], [ZONES.stunt.x + 16, ZONES.stunt.z - 16]], width: 9 },
    { points: [[-40, 44], [-70, 64]], width: 7, centerLine: false },
  ]
  const pads = [
    { x: 0, z: 0, r: 17, color: '#e6d7b2' },
    { x: ZONES.experience.x, z: -97, r: 19, color: '#ead9b8' },
    { x: ZONES.skills.x, z: ZONES.skills.z, r: 27, color: '#e2d3ae' },
    { x: ZONES.education.x, z: ZONES.education.z, r: 22, color: '#ead9b8' },
    { x: ZONES.contact.x, z: ZONES.contact.z, r: 22, color: '#e2d3ae' },
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
  const streetZ = [-28, -50, -72]
  EXPERIENCE.forEach((job, i) => {
    const side = i % 2 === 0 ? -1 : 1
    buildCompany(job, { x: side * 22, z: streetZ[i], facing: side === -1 ? 1 : -1 })
  })
  buildStatsPlaza()
  buildWindows()

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
    P.boxBody({ world, size, position, mass: 0, material: materials.ground, quaternion: q })
    return mesh
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
      width: 20,
      height: 10,
      postHeight: 3.4,
    })
    hero.position.set(0, 0, -12)
    root.add(hero)
    staticBox(hero, { x: 20, y: 10, z: 1 }, { x: 0, y: 8.4, z: -12 })

    // Plaza kerb, broken into four arcs so the roads pass through cleanly.
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(17, 0.32, 8, 28, THREE.MathUtils.degToRad(50)),
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
      const x = dirX * 16 + dirZ * 11
      const z = dirZ * 16 - dirX * 11
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
    buildArch({ x: 0, z: 30, width: 16, height: 9, color: C.navy, label: 'PORTFOLIO', accent: C.coral })
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
    for (const lx of [-width / 2, width / 2]) {
      const leg = P.meshOf(legGeo, P.std(color))
      leg.position.set(lx, height / 2, 0)
      g.add(leg)
      P.boxBody({
        world,
        size: { x: 1.6, y: height, z: 1.6 },
        position: { x: x + lx * cos, y: height / 2, z: z - lx * sin },
        mass: 0,
        material: materials.ground,
        quaternion: new CANNON.Quaternion().setFromEuler(0, rotY, 0),
      })
      obstacles.push({ x: x + lx * cos, z: z - lx * sin, r: 5 })
    }

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
    return g
  }

  /** One instanced mesh for every office window in the world. */
  function buildWindows() {
    if (!windowSlots.length) return
    const geometry = new THREE.BoxGeometry(1.5, 1.15, 0.18)
    const material = P.std(0x8fd2e8, {
      emissive: 0x2b6d86, emissiveIntensity: 0.45, roughness: 0.25, metalness: 0.3,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, windowSlots.length)
    mesh.castShadow = false
    mesh.receiveShadow = true
    const m = new THREE.Matrix4()
    const world = new THREE.Vector3()
    windowSlots.forEach((slot, i) => {
      slot.group.updateMatrixWorld(true)
      world.copy(slot.local).applyMatrix4(slot.group.matrixWorld)
      m.makeRotationFromEuler(slot.group.rotation)
      m.setPosition(world)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    root.add(mesh)
  }

  // --- Experience --------------------------------------------------------
  function buildCompany(job, { x, z, facing }) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    // facing: +1 means the front faces +X, -1 means it faces -X.
    g.rotation.y = facing === 1 ? Math.PI / 2 : -Math.PI / 2
    root.add(g)

    const w = 15
    const d = 11
    const h = job.floors * 3.1

    const tower = P.meshOf(new RoundedBoxGeometry(w, h, d, 3, 0.22), P.std(C.cream, { roughness: 0.85 }))
    tower.position.y = h / 2
    g.add(tower)

    const roof = P.meshOf(new RoundedBoxGeometry(w + 0.9, 0.7, d + 0.9, 3, 0.18), P.std(job.accent))
    roof.position.y = h + 0.3
    g.add(roof)

    const plinth = P.meshOf(new RoundedBoxGeometry(w + 2.2, 0.55, d + 2.2, 3, 0.15), P.std(C.sand, { roughness: 0.95 }))
    plinth.position.y = 0.27
    g.add(plinth)

    // Windows: collected here, then emitted as a single instanced mesh once
    // every building is known.
    for (let f = 0; f < job.floors; f++) {
      for (let c = 0; c < 4; c++) {
        if (f === 0 && (c === 1 || c === 2)) continue // leave room for the door
        for (const zz of [d / 2 + 0.02, -d / 2 - 0.02]) {
          windowSlots.push({
            group: g,
            local: new THREE.Vector3(-w / 2 + 2.6 + c * 3.2, 2.1 + f * 3.1, zz),
          })
        }
      }
    }

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
      width: 12,
      height: 4.9,
      postHeight: 0.6,
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

    staticBox(tower, { x: w + 2.2, y: h, z: d + 2.2 }, { x, y: h / 2, z }, g.rotation.y)
    obstacles.push({ x, z, r: 18 })

    addPOI({
      id: job.id,
      kind: 'job',
      data: job,
      position: new THREE.Vector3(x + facing * 12, 1, z),
      radius: 12,
      title: job.company,
    })

    addMarker(x + facing * 12, z, job.accent)
    // High above the roof, so it reads from across the map without looming over
    // the spot where the player actually parks.
    addLabel(job.company.toUpperCase(), new THREE.Vector3(x, h + 9.5, z), {
      height: 1.1,
      bg: `rgba(${hexToRgb(job.accent)},0.95)`,
    })
  }

  function buildStatsPlaza() {
    buildArch({ x: 0, z: -84, width: 18, height: 8, color: C.coral, label: 'IMPACT', accent: C.cream })

    // Two markers a side, lining the final stretch of the experience avenue.
    const slots = [
      [-12, -92], [12, -92], [-12, -102], [12, -102],
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
      x: cx - 30, z: 0, rotY: Math.PI / 2,
      width: 16, height: 8.5, color: C.teal, label: 'SKILLS YARD', accent: C.cream,
    })

    const cols = 3
    const spacing = 17
    SKILL_GROUPS.forEach((group, i) => {
      const gx = cx + ((i % cols) - 1) * spacing
      const gz = cz + (Math.floor(i / cols) - 1) * spacing
      buildSkillStack(group, gx, gz)
    })

    addPOI({
      id: 'skills',
      kind: 'skills',
      position: new THREE.Vector3(cx, 1, cz),
      radius: 26,
      title: 'Technical Skills',
    })
  }

  function buildSkillStack(group, gx, gz) {
    // Small plinth + group label, then a pyramid of crates to knock over.
    obstacles.push({ x: gx, z: gz, r: 9 })
    const plinth = P.meshOf(new THREE.CylinderGeometry(5.4, 5.8, 0.4, 24), P.std(C.sand, { roughness: 0.95 }))
    plinth.position.set(gx, 0.2, gz)
    plinth.receiveShadow = true
    root.add(plinth)

    const ring = P.meshOf(new THREE.TorusGeometry(5.4, 0.16, 6, 32), P.std(group.color))
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
          world, size: { x: size, y: size, z: size }, position: pos, mass: 2.6, material: materials.prop,
        })
        body.quaternion.setFromEuler(0, mesh.rotation.y, 0)
        body.angularDamping = 0.25
        dynamics.push({ mesh, body })
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

    staticBox(hall, { x: 26, y: 9, z: 18 }, { x: cx, y: 4.5, z: cz }, g.rotation.y)
    obstacles.push({ x: cx, z: cz, r: 26 })

    addPOI({
      id: 'education',
      kind: 'education',
      position: new THREE.Vector3(cx + 16, 1, cz),
      radius: 14,
      title: EDUCATION.school,
    })
    addMarker(cx + 16, cz, C.violet)
    addLabel('EDUCATION', new THREE.Vector3(cx, 20, cz), { height: 1.1, bg: 'rgba(122,108,240,0.95)' })
  }

  // --- Contact -----------------------------------------------------------
  function buildContactPlaza() {
    const { x: cx, z: cz } = ZONES.contact
    buildArch({ x: 0, z: cz - 30, width: 18, height: 9, color: C.amber, label: 'GET IN TOUCH', accent: C.navy })

    CONTACT_LINKS.forEach((link, i) => {
      const x = cx + (i - 1) * 19
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
      x: cx - 27, z: cz + 27, rotY: -Math.PI / 4,
      width: 14, height: 7.5, color: C.violet, label: 'STUNT PARK', accent: C.amber,
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
  }

  // --- Scenery -----------------------------------------------------------
  function scatterScenery() {
    const decor = new THREE.Group()
    const keepOut = [
      ...Object.values(ZONES).map((z) => ({ x: z.x, z: z.z, r: 30 })),
      ...obstacles,
    ]
    const onRoad = (x, z) => {
      if (Math.abs(x) < 9 && Math.abs(z) < 108) return true
      if (Math.abs(z) < 9 && Math.abs(x) < 108) return true
      const r = Math.hypot(x, z)
      if (Math.abs(r - 58) < 7) return true
      // The diagonal spur out to the stunt park.
      if (Math.abs(x + z) < 9 && x > 20 && x < 90) return true
      return false
    }

    let placed = 0
    let guard = 0
    while (placed < 190 && guard < 6000) {
      guard++
      const x = (rng() - 0.5) * 2 * (BOUNDS - 6)
      const z = (rng() - 0.5) * 2 * (BOUNDS - 6)
      if (onRoad(x, z)) continue
      if (keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue

      const roll = rng()
      let obj
      if (roll < 0.5) obj = P.tree(rng)
      else if (roll < 0.78) obj = P.bush(rng)
      else obj = P.rock(rng)
      obj.position.set(x, 0, z)
      obj.rotation.y = rng() * Math.PI * 2
      decor.add(obj)
      placed++
    }

    // Street lamps down the two main avenues.
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue
      const l1 = P.lamp()
      l1.position.set(-ROAD_W / 2 - 1.4, 0, i * 17)
      decor.add(l1)
      const l2 = P.lamp()
      l2.position.set(i * 17, 0, -ROAD_W / 2 - 1.4)
      l2.rotation.y = Math.PI / 2
      decor.add(l2)
    }

    root.add(P.mergeStatic(decor))

    // A small lake in the quiet quarter.
    const lake = P.meshOf(
      new THREE.CircleGeometry(17, 40),
      new THREE.MeshStandardMaterial({ color: 0x63b8d8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }),
      { cast: false }
    )
    lake.rotation.x = -Math.PI / 2
    lake.position.set(-74, 0.06, 70)
    root.add(lake)
    const shore = P.meshOf(new THREE.RingGeometry(17, 19.5, 40), P.std(C.sand, { roughness: 1 }), { cast: false })
    shore.rotation.x = -Math.PI / 2
    shore.position.set(-74, 0.04, 70)
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
      [34, 34], [-36, -30], [58, 30], [-58, -40], [22, -96],
      [96, -22], [-96, 28], [-30, 90], [40, 86], [-74, 70],
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

  return { root, pois, shards, dynamics, update, syncDynamics, ground }
}

function hexToRgb(n) {
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
