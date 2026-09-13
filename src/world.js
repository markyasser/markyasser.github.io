import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C, CSS, hex } from './palette.js'
import * as P from './props.js'
import { Breakables } from './breakables.js'
import {
  crateTexture, statTexture, labelTexture, groundTexture, skyTexture,
  containerSideTexture, containerTopTexture, containerEndTexture, bannerTexture,
  languageFlagTexture, logoFlagTexture,
} from './textures.js'
import { brandColor } from './logos.js'
import { PROFILE, EXPERIENCE, EDUCATION, SKILL_GROUPS, STATS, CONTACT_LINKS, LANGUAGES, SHARD_FACTS } from './data.js'

export const WORLD_SIZE = 224
export const BOUNDS = 94
const ROAD_W = 11

// Floating labels fade between these distances from the camera.
const LABEL_FADE_NEAR = 6
const LABEL_FADE_FAR = 13


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
  // Props that do something when the car hits them, keyed by their body.
  const specials = new Map()
  const nitros = []
  const root = new THREE.Group()
  scene.add(root)

  const breakables = new Breakables({ scene: root, world, material: materials.prop, onBreak })
  let football = null

  const addPOI = (poi) => {
    pois.push({ radius: 11, ...poi })
    return poi
  }

  // ---------------------------------------------------------------- sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(hex(C.skyTop), hex(C.skyHorizon), hex(C.skyMid)), side: THREE.BackSide, fog: false })
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
    { x: 0, z: 0, r: 16, color: '#546a80' },
    { x: ZONES.experience.x, z: -86, r: 17, color: '#50667c' },
    { x: ZONES.skills.x, z: ZONES.skills.z, r: 25, color: '#4d6379' },
    { x: ZONES.education.x, z: ZONES.education.z, r: 20, color: '#68789e' },
    { x: ZONES.contact.x, z: ZONES.contact.z, r: 20, color: '#64749a' },
    { x: ZONES.stunt.x, z: ZONES.stunt.z, r: 24, color: '#495e74' },
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
  const avenueJobs = EXPERIENCE.filter((job) => !job.campus)
  avenueJobs.forEach((job, i) => {
    const side = i % 2 === 0 ? -1 : 1
    buildCompany(job, { x: side * 12, z: streetZ[i], facing: side === -1 ? 1 : -1 })
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

  // ------------------------------------------------------------ diversions
  buildFootball()
  buildNitro()

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

  function addLabel(text, position, { height = 1.5, color = CSS.cream, bg = 'rgba(34,48,74,0.9)' } = {}) {
    const sprite = P.floatingLabel(labelTexture(renderer, { text, color, bg }), height)
    sprite.position.copy(position)
    root.add(sprite)
    billboarded.push(sprite)
    return sprite
  }

  // --- Shared builders ---------------------------------------------------

  /**
   * A labelled shipping container: a dynamic body like everything else, so the
   * player can shunt the CV around the map if they want to. Containers carry
   * the titles now — there are no buildings and no gateway arches left, and
   * nothing in the world is immovable except the boundary.
   */
  function addContainer({
    x, z, rotY = 0, length = 9, height = 3, width = 3,
    mass = 180, title, meta = '', items = [], marks = false, org = '', color, accent,
  }) {
    const hexColor = hex(color)
    const group = P.container({
      side: containerSideTexture(renderer, { title, meta, org, color: hexColor }),
      top: containerTopTexture(renderer, { title, items, marks, org, color: hexColor }),
      end: containerEndTexture(renderer, { color: hexColor }),
      length, height, width, accent,
    })
    group.position.set(x, height / 2, z)
    group.rotation.y = rotY
    root.add(group)

    const body = P.boxBody({
      world,
      size: { x: length, y: height, z: width },
      position: { x, y: height / 2, z },
      mass,
      material: materials.prop,
      quaternion: new CANNON.Quaternion().setFromEuler(0, rotY, 0),
    })
    body.angularDamping = 0.45
    body.linearDamping = 0.04
    dynamics.push({ mesh: group, body })
    obstacles.push({ x, z, r: Math.max(length, width) * 0.8 })
    return { mesh: group, body }
  }

  /** A banner on a pole. Marks a zone, and folds flat when you clip it. */
  function addFlag({ x, z, rotY = 0, title, color, texture, height = 5.2, bannerW, bannerH }) {
    const group = P.bannerFlag({
      texture: texture || bannerTexture(renderer, { title, color: hex(color) }),
      poleHeight: height,
      bannerW,
      bannerH,
    })
    group.position.set(x, height / 2, z)
    group.rotation.y = rotY
    root.add(group)

    const body = P.boxBody({
      world,
      size: { x: Math.max(1.7, (bannerW || 2.6) * 0.7), y: height, z: 0.6 },
      position: { x, y: height / 2, z },
      mass: 16,
      material: materials.prop,
      quaternion: new CANNON.Quaternion().setFromEuler(0, rotY, 0),
    })
    body.angularDamping = 0.4
    dynamics.push({ mesh: group, body })
    animated.push(group)
    return { mesh: group, body }
  }

  // --- Hub ---------------------------------------------------------------
  function buildHub() {
    // The name sits on the biggest container in the world, flanking the plaza
    // rather than crossing it: at 15m long and centred it walled off the
    // northbound avenue completely, and the experience zone behind it.
    const name = addContainer({
      x: -14, z: -12, length: 15, height: 3.6, width: 3.4, mass: 260,
      title: PROFILE.short,
      meta: PROFILE.title,
      color: C.navyLight,
      accent: C.coral,
    })

    addPOI({
      id: 'about',
      kind: 'about',
      position: new THREE.Vector3(-4, 1, -6),
      follow: name.body,
      followOffset: new THREE.Vector3(10, 0, 6),
      radius: 13,
      title: 'About Mark',
    })

    // Four banners at the plaza edge, one per direction.
    const dirs = [
      { label: 'EXPERIENCE', angle: Math.PI, color: C.coral },
      { label: 'SKILLS', angle: Math.PI / 2, color: C.teal },
      { label: 'EDUCATION', angle: -Math.PI / 2, color: C.violet },
      { label: 'CONTACT', angle: 0, color: C.amber },
    ]
    for (const d of dirs) {
      const dirX = Math.sin(d.angle)
      const dirZ = Math.cos(d.angle)
      addFlag({
        x: dirX * 15 + dirZ * 10.5,
        z: dirZ * 15 - dirX * 10.5,
        rotY: d.angle + Math.PI / 2,
        title: d.label,
        color: d.color,
      })
    }
  }

  // --- Experience --------------------------------------------------------
  function buildCompany(job, { x, z, facing }) {
    // Long axis along the road, so the lettered side faces oncoming traffic.
    const rotY = Math.PI / 2
    const main = addContainer({
      x, z, rotY, length: 11, height: 3.2, width: 3.2, mass: 150,
      title: job.company,
      meta: job.period,
      org: job.logo,
      items: job.tags.slice(0, 4),
      marks: true,
      color: job.accent,
      accent: C.navy,
    })

    // A second, smaller can behind it carrying the stack.
    addContainer({
      x: x - facing * 5.5, z: z + 1.5, rotY: Math.PI / 2, length: 7, height: 2.4, width: 2.6, mass: 80,
      title: 'Stack',
      items: job.tags,
      marks: true,
      color: C.navyLight,
      accent: job.accent,
    })

    addFlag({
      x: x + facing * 5, z: z - 8, rotY: facing === 1 ? 0 : Math.PI,
      title: job.company,
      texture: logoFlagTexture(renderer, { org: job.logo, title: job.company, color: hex(job.accent) }),
      height: 6.4, bannerW: 3.8, bannerH: 2.4,
    })

    addPOI({
      id: job.id,
      kind: 'job',
      data: job,
      position: new THREE.Vector3(x + facing * 8, 1, z),
      follow: main.body,
      followOffset: new THREE.Vector3(facing * 8, 0, 0),
      radius: 11,
      title: job.company,
    })

    addLabel(job.company.toUpperCase(), new THREE.Vector3(x, 8, z), {
      height: 1.1,
      bg: `rgba(${hexToRgb(job.accent)},0.95)`,
    })
  }

  function buildStatsPlaza() {
    // Each headline number is its own cube. They are meant to be knocked about.
    const slots = [
      [-11, -78], [11, -78], [-11, -89], [11, -89],
    ]
    const accents = [CSS.coral, CSS.teal, CSS.amber, '#8f83f7']
    STATS.forEach((stat, i) => {
      const [x, z] = slots[i]
      const size = 3.4
      const tex = statTexture(renderer, { ...stat, accent: accents[i % accents.length] })
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.14, roughness: 0.8,
      })
      const mesh = P.meshOf(new RoundedBoxGeometry(size, size, size, 3, 0.12), mat)
      mesh.position.set(x, size / 2, z)
      root.add(mesh)

      const body = P.boxBody({
        world, size: { x: size, y: size, z: size }, position: { x, y: size / 2, z },
        mass: 45, material: materials.prop,
      })
      body.angularDamping = 0.4
      dynamics.push({ mesh, body })
      obstacles.push({ x, z, r: 6 })
    })

    addFlag({ x: 0, z: -70, title: 'IMPACT', color: C.coral })
  }

  // --- Skills ------------------------------------------------------------
  function buildSkillYard() {
    const { x: cx, z: cz } = ZONES.skills
    addFlag({ x: cx - 28, z: -6, rotY: Math.PI / 2, title: 'SKILLS YARD', color: C.teal })
    addFlag({ x: cx - 28, z: 6, rotY: Math.PI / 2, title: 'SKILLS YARD', color: C.teal })

    const cols = 3
    const spacing = 16.5
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
    // The group's own container: name on the sides, full list across the roof
    // so it still reads once the crates in front of it are gone.
    addContainer({
      x: gx, z: gz + 7.5, length: 9, height: 2.5, width: 2.6, mass: 90,
      title: group.label,
      items: group.items,
      marks: true,
      color: group.color,
      accent: C.navy,
    })

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
        const mesh = P.crate({ texture: crateTexture(renderer, { label: item, color: brandColor(item) }), size })
        const pos = { x: gx + ox, y: 0.1 + size / 2 + r * (size + 0.04), z: gz }
        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.rotation.y = (c * 0.09 - 0.1) * (r + 1)
        root.add(mesh)
        const body = P.boxBody({
          world,
          size: { x: size, y: size, z: size },
          position: pos,
          mass: 1.8,
          material: materials.prop,
          quaternion: new CANNON.Quaternion().setFromEuler(0, mesh.rotation.y, 0),
        })
        body.angularDamping = 0.18
        dynamics.push({ mesh, body })
        // Hitting a crate destroys it and releases its face as a card that
        // flies up and spins away — the logo gets its moment on the way out,
        // which a crate sliding off face-down never gave it.
        breakables.adopt(body, mesh, {
          breakAt: 4, chunkColor: group.color, chunks: 6, chunkSize: 0.7,
          cardTexture: mesh.material.map,
        })
      })
    })
  }

  // --- Education ---------------------------------------------------------
  function buildCampus() {
    const { x: cx, z: cz } = ZONES.education

    // Cairo University gets the one building left in the world. It is still a
    // dynamic body — nothing here is immovable except the boundary — but heavy
    // and heavily damped, so it takes a real hit to shift and never topples
    // from a nudge.
    const hall = P.domedHall({ width: 10, depth: 8 })
    const half = hall.userData.half
    hall.position.set(cx, 0, cz)
    hall.rotation.y = Math.PI / 2
    root.add(hall)

    // cannon treats a body's origin as its centre of mass, so putting the
    // origin near the ground and offsetting the collision box upward gives the
    // hall the weight distribution of masonry. Without this a clipped corner
    // pivots the whole building about its base edge and lays it on its side,
    // however much mass or angular damping it is given.
    const comY = 0.5
    const hallBody = new CANNON.Body({
      mass: 620,
      material: materials.prop,
      position: new CANNON.Vec3(cx, comY, cz),
      quaternion: new CANNON.Quaternion().setFromEuler(0, Math.PI / 2, 0),
      angularDamping: 0.9,
      linearDamping: 0.15,
      allowSleep: true,
      sleepSpeedLimit: 0.3,
      sleepTimeLimit: 0.5,
    })
    hallBody.addShape(
      new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)),
      new CANNON.Vec3(0, half.y - comY, 0)
    )
    world.addBody(hallBody)
    hallBody.updateAABB()
    // The mesh is modelled sitting on the ground; the body's origin is just above it.
    dynamics.push({ mesh: hall, body: hallBody, yOffset: -comY })
    obstacles.push({ x: cx, z: cz, r: 12 })

    addContainer({
      x: cx + 1, z: cz - 10, rotY: 0, length: 9, height: 2.4, width: 2.6, mass: 80,
      title: EDUCATION.grade,
      color: C.navyLight,
      accent: C.violet,
    })

    // A clock tower beside the hall, sharing its low-centre-of-mass trick.
    // Kept under the hall's own height: a tower that out-scales the building
    // it belongs to reads as a separate landmark.
    const tower = P.clockTower({ height: 8.5, width: 2.1 })
    const th = tower.userData.half
    tower.position.set(cx - 8, 0, cz + 7)
    root.add(tower)
    const towerComY = 0.5
    const towerBody = new CANNON.Body({
      mass: 200,
      material: materials.prop,
      position: new CANNON.Vec3(cx - 8, towerComY, cz + 7),
      angularDamping: 0.9,
      linearDamping: 0.15,
      allowSleep: true,
      sleepSpeedLimit: 0.3,
      sleepTimeLimit: 0.5,
    })
    towerBody.addShape(
      new CANNON.Box(new CANNON.Vec3(th.x, th.y, th.z)),
      new CANNON.Vec3(0, th.y - towerComY, 0)
    )
    world.addBody(towerBody)
    towerBody.updateAABB()
    dynamics.push({ mesh: tower, body: towerBody, yOffset: -towerComY })
    obstacles.push({ x: cx - 8, z: cz + 7, r: 5 })

    // The graduation cap sits on the ground beside the honours container now,
    // where it can be knocked about. It is never registered as breakable — a
    // cap that shatters would just be litter.
    const cap = new THREE.Group()
    cap.add(P.meshOf(new THREE.CylinderGeometry(1.2, 1.4, 1.1, 16), P.std(C.navy)))
    const board = P.meshOf(new THREE.BoxGeometry(4.4, 0.3, 4.4), P.std(C.navy))
    board.position.y = 0.7
    board.rotation.y = Math.PI / 4
    cap.add(board)
    const button = P.meshOf(new THREE.SphereGeometry(0.22, 10, 8), P.std(C.amber))
    button.position.y = 0.92
    cap.add(button)
    const capPos = { x: cx + 8, y: 0.85, z: cz - 11 }
    cap.position.set(capPos.x, capPos.y, capPos.z)
    root.add(cap)
    const capBody = P.boxBody({
      world, size: { x: 4.2, y: 1.5, z: 4.2 }, position: capPos, mass: 38, material: materials.prop,
    })
    capBody.angularDamping = 0.5
    dynamics.push({ mesh: cap, body: capBody })

    // The two crests, as flags either side of the approach.
    addFlag({
      x: cx + 13, z: cz + 9,
      title: 'Cairo University',
      texture: logoFlagTexture(renderer, { org: 'cairo', title: 'Cairo University', color: hex(C.violet) }),
      height: 7.4, bannerW: 4.6, bannerH: 2.9,
    })
    addFlag({
      x: cx + 13, z: cz - 9,
      title: 'Faculty of Engineering',
      texture: logoFlagTexture(renderer, { org: 'engineering', title: 'Faculty of Engineering', color: hex(C.blue) }),
      height: 7.4, bannerW: 4.6, bannerH: 2.9,
    })

    // The teaching-assistant role belongs here, not on the experience avenue:
    // it is the same faculty as the degree.
    const ta = EXPERIENCE.find((job) => job.campus)
    if (ta) {
      const taMain = addContainer({
        x: cx + 3, z: cz + 11, rotY: 0, length: 12, height: 3, width: 3, mass: 150,
        title: ta.role,
        meta: ta.period,
        org: ta.logo,
        items: ta.tags,
        marks: true,
        color: ta.accent,
        accent: C.navy,
      })
      addPOI({
        id: ta.id,
        kind: 'job',
        data: ta,
        position: new THREE.Vector3(cx + 3, 1, cz + 17),
        follow: taMain.body,
        followOffset: new THREE.Vector3(0, 0, 6),
        radius: 10,
        title: ta.role,
      })
      addLabel('TEACHING ASSISTANT', new THREE.Vector3(cx + 3, 8, cz + 11), {
        height: 0.85,
        bg: `rgba(${hexToRgb(ta.accent)},0.95)`,
      })
    }

    buildLanguages(cx, cz + 22)

    addPOI({
      id: 'education',
      kind: 'education',
      position: new THREE.Vector3(cx + 13, 1, cz),
      follow: hallBody,
      followOffset: new THREE.Vector3(13, 0, 0),
      radius: 13,
      title: EDUCATION.school,
    })
    addLabel('CAIRO UNIVERSITY', new THREE.Vector3(cx, 12, cz), { height: 1.1, bg: 'rgba(143,131,247,0.95)' })
  }

  /** Spoken languages, as country flags on poles beside the university. */
  function buildLanguages(cx, cz) {
    LANGUAGES.forEach((lang, i) => {
      addFlag({
        x: cx + (i - (LANGUAGES.length - 1) / 2) * 7,
        z: cz,
        title: lang.language,
        texture: languageFlagTexture(renderer, lang),
      })
    })
    addLabel('LANGUAGES', new THREE.Vector3(cx, 8, cz), { height: 0.85, bg: 'rgba(63,201,191,0.95)' })
  }

  // --- Contact -----------------------------------------------------------
  function buildContactPlaza() {
    const { x: cx, z: cz } = ZONES.contact

    CONTACT_LINKS.forEach((link, i) => {
      const x = cx + (i - 1) * 17
      const color = link.color === C.navy ? C.blue : link.color
      const main = addContainer({
        x, z: cz - 4, rotY: 0, length: 10, height: 3, width: 3, mass: 130,
        title: link.label,
        meta: link.sub,
        org: link.id === 'email' ? 'email' : link.id,
        color,
        accent: C.navy,
      })
      addFlag({ x: x + 6.5, z: cz - 10, title: link.label, color })

      addPOI({
        id: link.id,
        kind: 'contact',
        data: link,
        position: new THREE.Vector3(x, 1, cz - 10),
        follow: main.body,
        followOffset: new THREE.Vector3(0, 0, -6),
        radius: 9,
        title: link.label,
      })
    })

    // A phone box and a post box, both of which answer when hit.
    const phone = P.phoneBox({})
    phone.position.set(cx - 26, 0, cz - 12)
    root.add(phone)
    const ph = phone.userData.half
    const phoneBody = P.boxBody({
      world, size: { x: ph.x * 2, y: ph.y * 2, z: ph.z * 2 },
      position: { x: cx - 26, y: ph.y, z: cz - 12 }, mass: 70, material: materials.prop,
    })
    phoneBody.angularDamping = 0.55
    dynamics.push({ mesh: phone, body: phoneBody, yOffset: -ph.y })
    specials.set(phoneBody, { kind: 'phone' })
    addLabel('PHONE', new THREE.Vector3(cx - 26, 7, cz - 12), { height: 0.8, bg: 'rgba(210,59,46,0.95)' })
    obstacles.push({ x: cx - 26, z: cz - 12, r: 5 })

    const post = P.mailbox({})
    post.position.set(cx + 26, 0, cz - 12)
    root.add(post)
    const mh = post.userData.half
    const postBody = P.boxBody({
      world, size: { x: mh.x * 2, y: mh.y * 2, z: mh.z * 2 },
      position: { x: cx + 26, y: 1.7, z: cz - 12 }, mass: 45, material: materials.prop,
    })
    postBody.angularDamping = 0.55
    dynamics.push({ mesh: post, body: postBody, yOffset: -1.7 })
    specials.set(postBody, { kind: 'mail' })
    addLabel('POST', new THREE.Vector3(cx + 26, 6, cz - 12), { height: 0.8, bg: 'rgba(239,115,96,0.95)' })
    obstacles.push({ x: cx + 26, z: cz - 12, r: 5 })

    addPOI({
      id: 'contact',
      kind: 'contactHub',
      position: new THREE.Vector3(cx, 1, cz - 16),
      radius: 10,
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
    placeRamp(cx - 9, cz + 9, DIAG, { width: 11, run: 18, rise: 2.5, color: C.coral })
    // Landing ramp on the far side of the gap.
    placeRamp(cx + 13, cz - 13, DIAG - Math.PI, { width: 11, run: 15, rise: 2.3, color: C.coral })
    // Two free-play ramps with clear, open approaches across the plaza.
    placeRamp(cx, cz + 18, Math.PI / 2, { width: 9, run: 14, rise: 1.9, color: C.amber })
    placeRamp(cx - 2, cz - 18, -Math.PI / 2, { width: 9, run: 14, rise: 1.9, color: C.teal })

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

    addFlag({ x: cx - 24, z: cz + 20, rotY: -Math.PI / 4, title: 'STUNT PARK', color: C.violet })
    addFlag({ x: cx - 20, z: cz + 24, rotY: -Math.PI / 4, title: 'STUNT PARK', color: C.violet })
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

  // --- Football ----------------------------------------------------------
  /**
   * A pitch in the empty western quarter. The ball is light, bouncy and low
   * friction, so it actually goes somewhere when the car clips it.
   */
  function buildFootball() {
    const cx = -72
    const cz = -44
    const goalZ = cz - 14
    const goalW = 11

    const goal = P.goalPosts({ width: goalW, height: 3.6, depth: 3 })
    goal.position.set(cx, 0, goalZ)
    root.add(goal)
    // The frame is solid; the mouth between the posts is not.
    for (const sx of [-1, 1]) {
      P.boxBody({
        world,
        size: { x: 0.5, y: 3.6, z: 0.5 },
        position: { x: cx + (sx * goalW) / 2, y: 1.8, z: goalZ },
        mass: 0,
        material: materials.ground,
      })
    }

    const ballStart = { x: cx, y: 0.6, z: cz + 6 }
    const ballMesh = P.football(0.55)
    ballMesh.position.set(ballStart.x, ballStart.y, ballStart.z)
    root.add(ballMesh)
    const ballBody = new CANNON.Body({
      mass: 2.2,
      material: materials.ball,
      shape: new CANNON.Sphere(0.55),
      position: new CANNON.Vec3(ballStart.x, ballStart.y, ballStart.z),
      linearDamping: 0.22,
      angularDamping: 0.22,
      allowSleep: true,
      sleepSpeedLimit: 0.4,
      sleepTimeLimit: 1,
    })
    world.addBody(ballBody)
    dynamics.push({ mesh: ballMesh, body: ballBody })

    addFlag({ x: cx - goalW / 2 - 3, z: goalZ + 2, title: 'GOAL', color: C.teal })
    addLabel('KICK-ABOUT', new THREE.Vector3(cx, 7, cz + 2), { height: 0.9, bg: 'rgba(63,201,191,0.95)' })
    obstacles.push({ x: cx, z: cz, r: 22 })

    football = {
      body: ballBody,
      mesh: ballMesh,
      start: ballStart,
      goal: { x: cx, z: goalZ, halfW: goalW / 2 - 0.6, depth: 3.2, height: 3.6 },
      scored: 0,
    }
  }

  // --- Nitro -------------------------------------------------------------
  /** Canisters, weighted along the run into the stunt park. */
  function buildNitro() {
    const spots = [
      [26, -26], [38, -38], [50, -50],
      [62, -64], [40, -14],
      [-20, 30], [30, 40],
    ]
    spots.forEach(([x, z]) => {
      const mesh = P.nitroCanister()
      mesh.position.set(x, 1.4, z)
      root.add(mesh)

      const halo = P.meshOf(
        new THREE.RingGeometry(1.2, 1.7, 24),
        new THREE.MeshBasicMaterial({ color: 0x64e0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
        { cast: false, receive: false }
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.set(x, 0.1, z)
      root.add(halo)

      nitros.push({ mesh, halo, position: new THREE.Vector3(x, 1.4, z), collected: false, respawn: 0 })
    })
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
      material: P.std(0xfff3cf, { emissive: 0xffd79a, emissiveIntensity: 2.0, roughness: 0.3 }),
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
    // Shards sit along the routes into the two zones with the most to read,
    // rather than hidden in empty corners. A player who follows the next glow
    // ends up driving the experience avenue and the skills yard end to end,
    // which is the point — they were scattered into the quiet quarters before,
    // and rewarded wandering away from the CV instead of into it.
    const spots = [
      // The experience avenue, one between each pair of containers. Kept close
      // to the centre line: the pickup radius is small once the height
      // difference between car and gem is taken out of it.
      [-2, -18], [2, -36], [-2, -56], [2, -72],
      // The stats gallery at the far end.
      [0, -84],
      // The aisles of the skills yard.
      [54, -9], [70, 6], [54, 21],
      // One each on the way to education and contact.
      [-46, 4], [7, 52],
    ]
    const shardGeo = new THREE.OctahedronGeometry(0.9, 0)
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xfff0b8,
      emissive: 0xf5b942,
      emissiveIntensity: 1.9,
      roughness: 0.2,
      metalness: 0.4,
    })
    spots.forEach(([x, z], i) => {
      const mesh = new THREE.Mesh(shardGeo, shardMat)
      mesh.position.set(x, 1.9, z)
      mesh.castShadow = true
      root.add(mesh)

      const halo = P.meshOf(
        new THREE.RingGeometry(1.7, 2.3, 28),
        new THREE.MeshBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
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
    for (const flag of animated) {
      const cloth = flag.userData.cloth
      if (!cloth) continue
      cloth.rotation.y = Math.sin(elapsed * 2.4 + flag.position.x) * 0.22
      cloth.scale.x = 1 + Math.sin(elapsed * 3.1 + flag.position.z) * 0.05
    }
    for (const poi of pois) {
      if (!poi.follow) continue
      poi.position.set(poi.follow.position.x, poi.follow.position.y, poi.follow.position.z)
      if (poi.followOffset) poi.position.add(poi.followOffset)
    }

    for (const n of nitros) {
      if (n.collected) continue
      n.mesh.rotation.y = elapsed * 2.2
      n.mesh.rotation.z = 0.4 + Math.sin(elapsed * 1.6) * 0.15
      n.mesh.position.y = 1.4 + Math.sin(elapsed * 2.4 + n.position.x) * 0.22
      n.halo.scale.setScalar(1 + Math.sin(elapsed * 3 + n.position.z) * 0.14)
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

  return {
    root, pois, shards, dynamics, breakables, ground, specials, nitros,
    update, syncDynamics,
    get football() {
      return football
    },
    resetBall() {
      if (!football) return
      const b = football.body
      b.position.set(football.start.x, football.start.y, football.start.z)
      b.velocity.setZero()
      b.angularVelocity.setZero()
      b.wakeUp()
    },
  }
}

function hexToRgb(n) {
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
