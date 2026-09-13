import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C } from './palette.js'

// Geometry/material caches — every prop type is instantiated many times, so
// sharing the underlying buffers keeps draw setup and memory in check.
const geoCache = new Map()
const matCache = new Map()

export const geo = (key, build) => {
  if (!geoCache.has(key)) geoCache.set(key, build())
  return geoCache.get(key)
}

export const std = (color, opts = {}) => {
  const key = `${color}|${JSON.stringify(opts)}`
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02, ...opts }))
  }
  return matCache.get(key)
}

export function meshOf(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = cast
  m.receiveShadow = receive
  return m
}

// --- Scenery -------------------------------------------------------------

// --- Signage -------------------------------------------------------------

/** Floating caption plane that always faces the camera. */
export function floatingLabel(texture, height = 1.1) {
  const aspect = texture.userData.aspect || 3
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat)
  sprite.userData.billboarded = true
  sprite.renderOrder = 5
  return sprite
}

// --- Physics props -------------------------------------------------------

/** A dynamic crate carrying a skill name on every face. */
export function crate({ texture, size = 1.5 }) {
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.12,
    roughness: 0.8,
    metalness: 0,
  })
  const m = meshOf(new RoundedBoxGeometry(size, size, size, 2, 0.07), mat)
  return m
}

export function cone() {
  const g = new THREE.Group()
  const body = meshOf(geo('coneBody', () => new THREE.ConeGeometry(0.36, 1.0, 12)), std(0xf0703c))
  body.position.y = 0.5
  g.add(body)
  const stripe = meshOf(geo('coneStripe', () => new THREE.CylinderGeometry(0.26, 0.29, 0.16, 12)), std(C.cream))
  stripe.position.y = 0.52
  g.add(stripe)
  const base = meshOf(geo('coneBase', () => new THREE.BoxGeometry(0.76, 0.08, 0.76)), std(0x2b3140))
  base.position.y = 0.04
  g.add(base)
  return g
}

export function barrel(color = C.amber) {
  const g = new THREE.Group()
  const body = meshOf(geo('barrelBody', () => new THREE.CylinderGeometry(0.48, 0.48, 1.2, 14)), std(color))
  body.position.y = 0.6
  g.add(body)
  const ringGeo = geo('barrelRing', () => new THREE.CylinderGeometry(0.51, 0.51, 0.1, 14))
  for (const y of [0.25, 0.95]) {
    const r = meshOf(ringGeo, std(0x2b3140))
    r.position.y = y
    g.add(r)
  }
  return g
}

export function pin() {
  const g = new THREE.Group()
  const body = meshOf(geo('pinBody', () => new THREE.CylinderGeometry(0.2, 0.3, 1.3, 12)), std(C.white))
  body.position.y = 0.65
  g.add(body)
  const neck = meshOf(geo('pinNeck', () => new THREE.SphereGeometry(0.22, 12, 10)), std(C.white))
  neck.position.y = 1.38
  g.add(neck)
  const band = meshOf(geo('pinBand', () => new THREE.CylinderGeometry(0.23, 0.23, 0.14, 12)), std(C.coral))
  band.position.y = 1.05
  g.add(band)
  return g
}

/**
 * A kicker ramp. The driving surface is a single rotated slab so the visual and
 * the physics body are the exact same shape — no invisible lips to catch on.
 * Returns `{ group, slab }` where `slab` describes the physics box to create.
 */
export function ramp({ width = 6, run = 9, rise = 2.4, color = C.amber, thickness = 0.38 }) {
  const group = new THREE.Group()
  const angle = Math.atan2(rise, run)
  const hyp = Math.hypot(run, rise)
  // The driving surface runs from (-run/2, 0) up to (+run/2, rise). Offsetting
  // the slab centre along the slope's downward normal puts its TOP face exactly
  // on that line, which is what the physics body is built from.
  const cx = (thickness / 2) * Math.sin(angle)
  const cy = rise / 2 - (thickness / 2) * Math.cos(angle)

  const slab = meshOf(new THREE.BoxGeometry(hyp, thickness, width), std(color, { roughness: 0.85 }))
  slab.rotation.z = angle
  slab.position.set(cx, cy, 0)
  group.add(slab)

  // Decorative cheeks close off the wedge's open sides.
  const cheek = new THREE.Shape()
  cheek.moveTo(-run / 2, 0)
  cheek.lineTo(run / 2, 0)
  cheek.lineTo(run / 2, rise)
  cheek.lineTo(-run / 2, 0)
  const cheekGeo = new THREE.ExtrudeGeometry(cheek, { depth: 0.18, bevelEnabled: false })
  const cheekMat = std(color, { roughness: 0.95 })
  for (const z of [-width / 2, width / 2 - 0.18]) {
    const m = meshOf(cheekGeo, cheekMat)
    m.position.set(0, 0, z)
    group.add(m)
  }

  // Chevrons painted up the slope.
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.7) / 5
    const stripe = meshOf(new THREE.PlaneGeometry(0.5, width * 0.78), std(C.cream, { roughness: 0.9 }), { cast: false })
    stripe.rotation.set(-Math.PI / 2, 0, 0)
    stripe.position.set(-run / 2 + run * t, rise * t + thickness * 0.06, 0)
    stripe.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), angle)
    // Nudge the stripe just clear of the slab so it never z-fights.
    stripe.position.y += 0.04 * Math.cos(angle)
    group.add(stripe)
  }

  group.userData.slab = { hyp, thickness, width, angle, cx, cy }
  return group
}

// --- Shared physics body helpers ----------------------------------------

/** Collision filter group for immovable world geometry. */
export const STATIC_GROUP = 2

export function boxBody({ world, size, position, mass = 0, material, quaternion }) {
  const body = new CANNON.Body({
    mass,
    material,
    shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    // The orientation has to go in here, not be assigned afterwards: cannon
    // caches the world AABB the first time it is needed and never recomputes it
    // for a body that never moves. A rotation applied later leaves that cached
    // AABB axis-aligned to the *unrotated* shape, and raycasts — which is how
    // the car's wheels find the ground — then miss the body entirely.
    quaternion: quaternion || undefined,
    // Static world geometry goes in its own filter group so the chase camera
    // can raycast against buildings and ramps without catching loose props.
    collisionFilterGroup: mass === 0 ? STATIC_GROUP : 1,
    allowSleep: mass > 0,
    sleepSpeedLimit: 0.35,
    sleepTimeLimit: 0.6,
  })
  world.addBody(body)
  if (mass === 0) body.updateAABB()
  return body
}

export function cylinderBody({ world, radius, height, position, mass = 0, material, segments = 10 }) {
  const body = new CANNON.Body({
    mass,
    material,
    shape: new CANNON.Cylinder(radius, radius, height, segments),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    collisionFilterGroup: mass === 0 ? STATIC_GROUP : 1,
    allowSleep: mass > 0,
    sleepSpeedLimit: 0.35,
    sleepTimeLimit: 0.6,
  })
  world.addBody(body)
  if (mass === 0) body.updateAABB()
  return body
}

/**
 * A labelled shipping container. This is what carries the CV now: the long
 * sides read from the road, the roof reads from the overhead camera, and the
 * whole thing is a dynamic body, so it shunts and topples like anything else.
 *
 * BoxGeometry material order is [+x, -x, +y, -y, +z, -z]; length runs along X.
 */
export function container({ side, top, end, length, height, width, accent }) {
  const sideMat = new THREE.MeshStandardMaterial({
    map: side, emissive: 0xffffff, emissiveMap: side, emissiveIntensity: 0.12, roughness: 0.7, metalness: 0.12,
  })
  const topMat = new THREE.MeshStandardMaterial({
    map: top, emissive: 0xffffff, emissiveMap: top, emissiveIntensity: 0.12, roughness: 0.7, metalness: 0.12,
  })
  const endMat = new THREE.MeshStandardMaterial({ map: end, roughness: 0.75, metalness: 0.12 })
  const floorMat = std(0x1a2536, { roughness: 0.9 })

  const group = new THREE.Group()
  group.add(meshOf(
    new THREE.BoxGeometry(length, height, width),
    [endMat, endMat, topMat, floorMat, sideMat, sideMat]
  ))

  // Corner castings, so it reads as a container rather than a printed box.
  const post = new RoundedBoxGeometry(0.34, height + 0.06, 0.34, 2, 0.06)
  const postMat = std(accent ?? 0x2b3a52, { roughness: 0.6, metalness: 0.2 })
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = meshOf(post, postMat)
      p.position.set((sx * (length - 0.34)) / 2, 0, (sz * (width - 0.34)) / 2)
      group.add(p)
    }
  }
  return group
}

/**
 * A banner on a pole. Knockable like everything else — its body is a slab
 * covering the pole, so a clip at speed lays the whole thing flat.
 */
export function bannerFlag({ texture, poleHeight = 5.2, bannerW = 2.6, bannerH = 1.6 }) {
  bannerW = bannerW || 2.6
  bannerH = bannerH || 1.6
  const group = new THREE.Group()
  group.add(meshOf(
    new THREE.CylinderGeometry(0.11, 0.13, poleHeight, 8),
    std(0xc3cfe4, { roughness: 0.35, metalness: 0.55 })
  ))

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.18,
    roughness: 0.85,
    side: THREE.DoubleSide,
  })
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, bannerH), mat)
  cloth.castShadow = true
  cloth.position.set(bannerW / 2 + 0.1, poleHeight / 2 - bannerH / 2 - 0.25, 0)
  group.add(cloth)

  const cap = meshOf(new THREE.SphereGeometry(0.16, 10, 8), std(0xe2ebfa, { metalness: 0.5, roughness: 0.3 }))
  cap.position.y = poleHeight / 2
  group.add(cap)

  group.userData.cloth = cloth
  return group
}

/**
 * A small domed hall, for Cairo University. The dome on a drum over a
 * colonnaded portico is what the campus is known by, and it reads at a glance
 * where a lettered box does not.
 *
 * Kept deliberately small — a couple of container-heights — so it sits in the
 * world as a landmark rather than a wall the camera has to see around.
 * Returns the group plus the half-extents the physics body should use.
 */
export function domedHall({
  width = 10, depth = 8, color = 0xc9bda4, dome = 0x7d9a8f, trim = 0xe6dcc8,
}) {
  const group = new THREE.Group()
  const stone = std(color, { roughness: 0.9 })
  const trimMat = std(trim, { roughness: 0.85 })
  const domeMat = std(dome, { roughness: 0.55, metalness: 0.25 })

  const hallH = 2.6
  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }

  // Stepped plinth.
  add(meshOf(new THREE.BoxGeometry(width, 0.35, depth), trimMat), 0, 0.175, 0)
  add(meshOf(new THREE.BoxGeometry(width - 0.9, 0.3, depth - 0.9), stone), 0, 0.5, 0)

  // Main block, with lower wings either side.
  add(meshOf(new RoundedBoxGeometry(width * 0.54, hallH, depth * 0.8, 3, 0.1), stone), 0, 0.65 + hallH / 2, 0)
  for (const sx of [-1, 1]) {
    add(
      meshOf(new RoundedBoxGeometry(width * 0.24, hallH * 0.7, depth * 0.58, 3, 0.1), stone),
      sx * width * 0.38, 0.65 + (hallH * 0.7) / 2, 0
    )
  }

  // Cornice.
  add(meshOf(new THREE.BoxGeometry(width * 0.58, 0.24, depth * 0.84), trimMat), 0, 0.65 + hallH + 0.12, 0)

  // Drum and dome.
  const drumY = 0.65 + hallH + 0.24
  add(meshOf(new THREE.CylinderGeometry(depth * 0.27, depth * 0.29, 0.9, 20), trimMat), 0, drumY + 0.45, 0)
  const domeGeo = new THREE.SphereGeometry(depth * 0.28, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  add(meshOf(domeGeo, domeMat), 0, drumY + 0.9, 0)
  add(meshOf(new THREE.SphereGeometry(0.18, 10, 8), trimMat), 0, drumY + 0.9 + depth * 0.28 + 0.12, 0)

  // Portico: columns under a pediment, facing +Z.
  const colGeo = new THREE.CylinderGeometry(0.19, 0.21, hallH * 0.86, 12)
  const frontZ = depth * 0.42
  for (let i = 0; i < 4; i++) {
    add(meshOf(colGeo, trimMat), (i - 1.5) * (width * 0.135), 0.65 + (hallH * 0.86) / 2, frontZ)
  }
  add(meshOf(new THREE.BoxGeometry(width * 0.5, 0.22, 0.7), trimMat), 0, 0.65 + hallH * 0.86 + 0.11, frontZ)

  const ped = new THREE.Shape()
  ped.moveTo(-width * 0.25, 0)
  ped.lineTo(width * 0.25, 0)
  ped.lineTo(0, 0.85)
  ped.lineTo(-width * 0.25, 0)
  const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 0.55, bevelEnabled: false })
  pedGeo.translate(0, 0, -0.275)
  add(meshOf(pedGeo, trimMat), 0, 0.65 + hallH * 0.86 + 0.22, frontZ)

  // Lit windows, so it has some life before sunrise.
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffca7d, emissive: 0xffb85e, emissiveIntensity: 1.4, roughness: 0.3,
  })
  const winGeo = new THREE.BoxGeometry(0.42, 0.8, 0.12)
  for (const sz of [depth * 0.4 + 0.02, -depth * 0.4 - 0.02]) {
    for (let i = 0; i < 4; i++) {
      const w = meshOf(winGeo, winMat, { cast: false })
      add(w, (i - 1.5) * (width * 0.115), 0.65 + hallH * 0.52, sz)
    }
  }

  group.userData.half = { x: width / 2, y: (drumY + 1.2) / 2, z: depth / 2 }
  group.userData.centreY = (drumY + 1.2) / 2
  return group
}

/**
 * A clock tower, for beside the university. Like the hall it is a landmark
 * rather than an obstacle, so it is kept narrow and its body is given a low
 * centre of mass by the caller.
 */
export function clockTower({ height = 13, width = 3, color = 0xc9bda4, trim = 0xe6dcc8, face = 0xf4efe2 }) {
  const group = new THREE.Group()
  const stone = std(color, { roughness: 0.9 })
  const trimMat = std(trim, { roughness: 0.85 })

  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }

  add(meshOf(new THREE.BoxGeometry(width * 1.5, 0.4, width * 1.5), trimMat), 0, 0.2, 0)
  const shaftH = height * 0.66
  add(meshOf(new RoundedBoxGeometry(width, shaftH, width, 3, 0.08), stone), 0, 0.4 + shaftH / 2, 0)

  // Clock stage, slightly proud of the shaft.
  const stageY = 0.4 + shaftH + height * 0.09
  add(meshOf(new THREE.BoxGeometry(width * 1.22, 0.22, width * 1.22), trimMat), 0, 0.4 + shaftH + 0.11, 0)
  add(meshOf(new RoundedBoxGeometry(width * 1.12, height * 0.18, width * 1.12, 3, 0.06), stone), 0, stageY, 0)

  // A face on all four sides, so it reads from any approach.
  const faceGeo = new THREE.CircleGeometry(width * 0.4, 24)
  const faceMat = new THREE.MeshStandardMaterial({
    color: face, emissive: 0xfff0cf, emissiveIntensity: 0.9, roughness: 0.5,
  })
  const handMat = std(0x1b2a45, { roughness: 0.6 })
  const sides = [
    [0, 0, width * 0.57, 0],
    [0, 0, -width * 0.57, Math.PI],
    [width * 0.57, 0, 0, Math.PI / 2],
    [-width * 0.57, 0, 0, -Math.PI / 2],
  ]
  for (const [fx, , fz, ry] of sides) {
    const dial = new THREE.Group()
    dial.add(meshOf(faceGeo, faceMat, { cast: false }))
    const hour = meshOf(new THREE.BoxGeometry(0.09, width * 0.2, 0.05), handMat, { cast: false })
    hour.position.set(0, width * 0.1, 0.04)
    dial.add(hour)
    const minute = meshOf(new THREE.BoxGeometry(0.07, width * 0.3, 0.05), handMat, { cast: false })
    minute.position.set(0, width * 0.05, 0.04)
    minute.rotation.z = -1.9
    dial.add(minute)
    dial.position.set(fx, stageY, fz)
    dial.rotation.y = ry
    group.add(dial)
  }

  // Cornice and spire.
  const topY = stageY + height * 0.09
  add(meshOf(new THREE.BoxGeometry(width * 1.3, 0.24, width * 1.3), trimMat), 0, topY + 0.12, 0)
  add(meshOf(new THREE.ConeGeometry(width * 0.78, height * 0.2, 4), trimMat), 0, topY + 0.24 + height * 0.1, 0)
  add(meshOf(new THREE.SphereGeometry(0.16, 10, 8), std(0xf2ac63)), 0, topY + 0.24 + height * 0.2 + 0.1, 0)

  group.userData.half = { x: width * 0.75, y: (topY + height * 0.3) / 2, z: width * 0.75 }
  return group
}

/** A football, and the posts to put it between. */
export function football(radius = 0.55) {
  const group = new THREE.Group()
  const ball = meshOf(new THREE.IcosahedronGeometry(radius, 1), std(0xf2f6ff, { roughness: 0.55 }))
  group.add(ball)
  // Dark pentagon-ish patches, enough to read as a football while it spins.
  const patch = new THREE.IcosahedronGeometry(radius * 0.42, 0)
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6
    const tilt = i % 2 ? 0.7 : -0.7
    const p = meshOf(patch, std(0x1b2a45, { roughness: 0.7 }), { cast: false })
    p.position.set(
      Math.cos(a) * radius * 0.88,
      Math.sin(tilt) * radius * 0.8,
      Math.sin(a) * radius * 0.88
    )
    p.scale.set(1, 0.4, 1)
    p.lookAt(0, 0, 0)
    group.add(p)
  }
  return group
}

export function goalPosts({ width = 10, height = 3.4, depth = 2.6 }) {
  const group = new THREE.Group()
  const frame = std(0xeef4ff, { roughness: 0.4, metalness: 0.3 })
  const bar = new THREE.CylinderGeometry(0.17, 0.17, 1, 10)

  const post = (x) => {
    const m = meshOf(bar, frame)
    m.scale.y = height
    m.position.set(x, height / 2, 0)
    group.add(m)
  }
  post(-width / 2)
  post(width / 2)

  const cross = meshOf(bar, frame)
  cross.scale.y = width
  cross.rotation.z = Math.PI / 2
  cross.position.y = height
  group.add(cross)

  // Net: a grid of thin lines on the back and sides, cheap and readable.
  const netMat = new THREE.MeshBasicMaterial({
    color: 0xdce8ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
  })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), netMat)
  back.position.set(0, height / 2, -depth)
  group.add(back)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), netMat)
    side.rotation.y = Math.PI / 2
    side.position.set((sx * width) / 2, height / 2, -depth / 2)
    group.add(side)
  }
  return group
}

/** A phone box. Hit it and it gives you the number. */
export function phoneBox({ color = 0xd23b2e }) {
  const group = new THREE.Group()
  const body = std(color, { roughness: 0.6 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd4e8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.5,
  })
  const w = 1.5
  const h = 4.2

  group.add(meshOf(new THREE.BoxGeometry(w + 0.3, 0.2, w + 0.3), body)).position.y = 0.1
  // Four corner pillars and a roof, with glazing between.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = meshOf(new THREE.BoxGeometry(0.22, h, 0.22), body)
    p.position.set((sx * w) / 2, h / 2 + 0.2, (sz * w) / 2)
    group.add(p)
  }
  for (const [dx, dz, ry] of [[0, w / 2, 0], [0, -w / 2, 0], [w / 2, 0, Math.PI / 2], [-w / 2, 0, Math.PI / 2]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.25, h - 0.9), glass)
    pane.position.set(dx, h / 2 + 0.4, dz)
    pane.rotation.y = ry
    group.add(pane)
  }
  const roof = meshOf(new RoundedBoxGeometry(w + 0.35, 0.45, w + 0.35, 3, 0.1), body)
  roof.position.y = h + 0.35
  group.add(roof)

  const sign = meshOf(new THREE.BoxGeometry(w - 0.1, 0.42, 0.08), std(0xfff0cf, {
    emissive: 0xffd79a, emissiveIntensity: 1.6, roughness: 0.4,
  }), { cast: false })
  sign.position.set(0, h + 0.02, w / 2 + 0.02)
  group.add(sign)
  const signBack = sign.clone()
  signBack.position.z = -w / 2 - 0.02
  group.add(signBack)

  group.userData.half = { x: (w + 0.35) / 2, y: (h + 0.6) / 2, z: (w + 0.35) / 2 }
  return group
}

/** A post box. Hit it and the mail goes everywhere. */
export function mailbox({ color = 0xef7360 }) {
  const group = new THREE.Group()
  const body = std(color, { roughness: 0.6 })
  const dark = std(0x1b2a45, { roughness: 0.7 })

  const post = meshOf(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 10), dark)
  post.position.y = 0.75
  group.add(post)

  const box = meshOf(new RoundedBoxGeometry(1.4, 1.5, 1.1, 4, 0.28), body)
  box.position.y = 2.2
  group.add(box)

  // Slot and a small hood over it.
  const slot = meshOf(new THREE.BoxGeometry(0.9, 0.13, 0.1), dark, { cast: false })
  slot.position.set(0, 2.5, 0.56)
  group.add(slot)
  const hood = meshOf(new THREE.BoxGeometry(1.05, 0.1, 0.22), dark, { cast: false })
  hood.position.set(0, 2.62, 0.6)
  group.add(hood)

  const band = meshOf(new THREE.BoxGeometry(1.42, 0.12, 1.12), std(0xeef4ff, { roughness: 0.6 }), { cast: false })
  band.position.y = 1.62
  group.add(band)

  group.userData.half = { x: 0.75, y: 1.5, z: 0.6 }
  return group
}

/** A nitrous canister: collect it, spend it on the ramps. */
export function nitroCanister() {
  const group = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({
    color: 0x64e0ff, emissive: 0x2bb8e8, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.5,
  })
  const body = meshOf(new THREE.CapsuleGeometry(0.34, 0.9, 6, 12), shell)
  group.add(body)
  const cap = meshOf(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), std(0xeef4ff, { metalness: 0.6, roughness: 0.3 }))
  cap.position.y = 0.82
  group.add(cap)
  for (const y of [-0.25, 0.25]) {
    const ring = meshOf(new THREE.TorusGeometry(0.35, 0.05, 6, 16), std(0x0b3a4d))
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    group.add(ring)
  }
  return group
}
