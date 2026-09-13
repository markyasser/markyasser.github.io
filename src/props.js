import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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

export function tree(rng = Math.random) {
  const g = new THREE.Group()
  const h = 2.2 + rng() * 1.8
  const trunk = meshOf(
    geo('trunk', () => new THREE.CylinderGeometry(0.17, 0.24, 1, 7)),
    std(0x8a6a4a)
  )
  trunk.scale.y = h * 0.45
  trunk.position.y = (h * 0.45) / 2
  g.add(trunk)

  const leafGeo = geo('leaf', () => new THREE.IcosahedronGeometry(1, 0))
  const shades = [0x5f9e52, 0x6fae5e, 0x54904a]
  for (let i = 0; i < 3; i++) {
    const blob = meshOf(leafGeo, std(shades[i % shades.length], { flatShading: true }))
    const s = (1.15 - i * 0.22) * (0.85 + rng() * 0.3)
    blob.scale.setScalar(s)
    blob.position.set((rng() - 0.5) * 0.5, h * 0.45 + 0.5 + i * 0.62, (rng() - 0.5) * 0.5)
    blob.rotation.y = rng() * Math.PI
    g.add(blob)
  }
  return g
}

export function bush(rng = Math.random) {
  const g = new THREE.Group()
  const leafGeo = geo('leaf', () => new THREE.IcosahedronGeometry(1, 0))
  for (let i = 0; i < 3; i++) {
    const b = meshOf(leafGeo, std(i % 2 ? 0x6fae5e : 0x5f9e52, { flatShading: true }))
    const s = 0.4 + rng() * 0.45
    b.scale.setScalar(s)
    b.position.set((rng() - 0.5) * 1.1, s * 0.7, (rng() - 0.5) * 1.1)
    g.add(b)
  }
  return g
}

export function rock(rng = Math.random) {
  const r = meshOf(
    geo('rock', () => new THREE.DodecahedronGeometry(1, 0)),
    std(0x9aa3ad, { flatShading: true })
  )
  const s = 0.5 + rng() * 0.9
  r.scale.set(s, s * (0.6 + rng() * 0.4), s * (0.8 + rng() * 0.4))
  r.position.y = s * 0.35
  r.rotation.set(rng(), rng() * Math.PI, rng())
  return r
}

export function lamp() {
  const g = new THREE.Group()
  const pole = meshOf(
    geo('lampPole', () => new THREE.CylinderGeometry(0.09, 0.13, 4.4, 8)),
    std(C.navy, { roughness: 0.5 })
  )
  pole.position.y = 2.2
  g.add(pole)

  const arm = meshOf(geo('lampArm', () => new THREE.BoxGeometry(0.9, 0.12, 0.12)), std(C.navy))
  arm.position.set(0.42, 4.3, 0)
  g.add(arm)

  const head = meshOf(
    geo('lampHead', () => new THREE.SphereGeometry(0.26, 12, 10)),
    std(0xfff3cf, { emissive: 0xffe9a8, emissiveIntensity: 0.9, roughness: 0.3 })
  )
  head.position.set(0.84, 4.22, 0)
  head.castShadow = false
  g.add(head)
  return g
}

export function flag(color = C.coral) {
  const g = new THREE.Group()
  const pole = meshOf(
    geo('flagPole', () => new THREE.CylinderGeometry(0.06, 0.06, 5, 6)),
    std(0xd8dee8, { metalness: 0.5, roughness: 0.3 })
  )
  pole.position.y = 2.5
  g.add(pole)
  const cloth = meshOf(geo('flagCloth', () => new THREE.PlaneGeometry(1.4, 0.85)), std(color, { side: THREE.DoubleSide }))
  cloth.position.set(0.7, 4.3, 0)
  g.add(cloth)
  g.userData.cloth = cloth
  return g
}

// --- Signage -------------------------------------------------------------

/**
 * A framed billboard on two posts. `texture` is drawn on the front face and a
 * flat back panel closes it off so the sign reads from behind too.
 */
export function billboard({ texture, width = 8, height = 4, postHeight = 2.4, frame = C.navy }) {
  const g = new THREE.Group()

  const panelGeo = new RoundedBoxGeometry(width, height, 0.26, 3, 0.1)
  // Signage is backlit. At this hour skylight alone leaves the panels too dim to
  // read, and a lit sign is what a real forecourt board would be at 5am anyway.
  const faceMat = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.5,
    roughness: 0.78,
    metalness: 0,
  })
  const sideMat = std(frame, { roughness: 0.6 })
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const panel = new THREE.Mesh(panelGeo, [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat])
  panel.castShadow = true
  panel.receiveShadow = true
  panel.position.y = postHeight + height / 2
  g.add(panel)

  const border = meshOf(new RoundedBoxGeometry(width + 0.34, height + 0.34, 0.16, 3, 0.07), sideMat)
  border.position.set(0, postHeight + height / 2, -0.08)
  g.add(border)

  const postGeo = geo('signPost', () => new THREE.CylinderGeometry(0.16, 0.19, 1, 8))
  for (const x of [-width * 0.3, width * 0.3]) {
    const p = meshOf(postGeo, sideMat)
    p.scale.y = postHeight + 0.3
    p.position.set(x, (postHeight + 0.3) / 2, -0.1)
    g.add(p)
  }
  return g
}

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
    emissiveIntensity: 0.28,
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
 * Collapse a group of never-moving meshes into one mesh per material. Trees,
 * bushes, rocks and lamps are several hundred tiny objects; merged, they cost a
 * handful of draw calls instead, which is the difference between smooth and
 * stuttering on a mid-range phone.
 *
 * Returns a new group; the caller should discard the original.
 */
export function mergeStatic(group) {
  group.updateMatrixWorld(true)

  const byMaterial = new Map()
  group.traverse((node) => {
    if (!node.isMesh || node.isInstancedMesh) return
    const key = node.material
    const geometry = node.geometry.clone()
    geometry.applyMatrix4(node.matrixWorld)
    // Merging requires identical attribute sets; UV-less geometry would break
    // the merge, so normalise by dropping anything the batch doesn't share.
    for (const name of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name)
    }
    if (!geometry.attributes.uv) {
      const count = geometry.attributes.position.count
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
    }
    const list = byMaterial.get(key) || []
    list.push(geometry)
    byMaterial.set(key, list)
  })

  const merged = new THREE.Group()
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries.map((g) => g.toNonIndexed()), false)
    geometries.forEach((g) => g.dispose())
    if (!geometry) continue
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    merged.add(mesh)
  }
  return merged
}

/**
 * A texture laid flat on the ground, lifted just clear of it. Backlit like the
 * standing signage so it stays readable before sunrise.
 */
export function groundPanel(texture, width, depth, { rotY = 0 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.62,
      transparent: true,
      depthWrite: false,
      roughness: 0.9,
    })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = -rotY
  mesh.position.y = 0.06
  mesh.receiveShadow = false
  mesh.castShadow = false
  mesh.renderOrder = 2
  return mesh
}
