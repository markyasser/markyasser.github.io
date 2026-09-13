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
