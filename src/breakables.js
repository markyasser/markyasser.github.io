import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { C } from './palette.js'
import { STATIC_GROUP } from './props.js'

// ---------------------------------------------------------------------------
// Everything in the world that can be hit, shoved and smashed.
//
// Scenery is drawn with instanced meshes rather than one object per tree: the
// car only ever disturbs a handful at a time, so instances whose body is asleep
// cost nothing to keep on screen. Breaking an object hides its instances and
// hands a few chunks to a fixed-size debris pool, which keeps the body count
// bounded no matter how long someone spends demolishing things.
// ---------------------------------------------------------------------------

const DEBRIS_POOL = 110
const DEBRIS_LIFE = 5.5
const PARKED = new THREE.Vector3(0, -500, 0)

const scratchMatrix = new THREE.Matrix4()
const scratchBody = new THREE.Matrix4()
const scratchPos = new THREE.Vector3()
const scratchQuat = new THREE.Quaternion()
const scratchScale = new THREE.Vector3()
const ONE = new THREE.Vector3(1, 1, 1)

function partMatrix(position, quaternion, scale) {
  return new THREE.Matrix4().compose(
    position,
    quaternion || new THREE.Quaternion(),
    typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale || ONE
  )
}

/** One instanced mesh plus a cursor, so parts can be claimed as they are built. */
class PartPool {
  constructor(scene, geometry, material, capacity, { cast = true, receive = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
    this.mesh.castShadow = cast
    this.mesh.receiveShadow = receive
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
    this.capacity = capacity
    this.used = 0
    this.colors = null
  }

  claim() {
    if (this.used >= this.capacity) return -1
    const index = this.used++
    this.mesh.count = this.used
    return index
  }

  setColor(index, color) {
    if (!this.colors) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3)
      this.colors = true
      for (let i = 0; i < this.capacity; i++) this.mesh.setColorAt(i, new THREE.Color(0xffffff))
    }
    this.mesh.setColorAt(index, color)
    this.mesh.instanceColor.needsUpdate = true
  }

  write(index, matrix) {
    this.mesh.setMatrixAt(index, matrix)
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

export class Breakables {
  constructor({ scene, world, material, onBreak }) {
    this.scene = scene
    this.world = world
    this.material = material
    this.onBreak = onBreak || (() => {})

    this.items = []
    this.byBody = new Map()
    // Breaks are queued rather than applied immediately: impacts are reported
    // from cannon's `collide` event, which fires part-way through a step, and
    // removing a body at that point corrupts the solver's working arrays.
    this.pending = []
    this.pools = new Map()
    this.dirtyPools = new Set()

    this._buildDebrisPool()
  }

  // ------------------------------------------------------------- part pools
  pool(name, build, capacity, opts) {
    if (!this.pools.has(name)) {
      const { geometry, material } = build()
      this.pools.set(name, new PartPool(this.scene, geometry, material, capacity, opts))
    }
    return this.pools.get(name)
  }

  /**
   * Register a hittable object.
   *
   * `parts` are {pool, matrix, color} entries drawn relative to the body.
   * `breakAt` is the impact speed in m/s that destroys it; omit for things that
   * should only ever be shoved around.
   */
  add({ parts, shape, mass, position, rotY = 0, breakAt = Infinity, chunkColor, chunks = 5, chunkSize = 0.3 }) {
    const body = new CANNON.Body({
      mass,
      material: this.material,
      shape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      quaternion: new CANNON.Quaternion().setFromEuler(0, rotY, 0),
      allowSleep: true,
      sleepSpeedLimit: 0.28,
      sleepTimeLimit: 0.5,
      angularDamping: 0.32,
      linearDamping: 0.02,
    })
    this.world.addBody(body)
    body.updateAABB()

    const claimed = parts.map((part) => {
      const index = part.pool.claim()
      if (index >= 0 && part.color) part.pool.setColor(index, part.color)
      return { pool: part.pool, index, matrix: part.matrix }
    })

    const item = { body, parts: claimed, breakAt, chunkColor, chunks, chunkSize, broken: false, dead: false }
    this.items.push(item)
    this.byBody.set(body, item)
    this._writeItem(item)
    for (const p of claimed) this.dirtyPools.add(p.pool)
    return item
  }

  /** Register something built elsewhere (a crate, a barrel) as breakable. */
  adopt(body, mesh, { breakAt, chunkColor, chunks = 6, chunkSize = 0.32 }) {
    const item = { body, mesh, parts: [], breakAt, chunkColor, chunks, chunkSize, broken: false, dead: false }
    this.items.push(item)
    this.byBody.set(body, item)
    return item
  }

  // ---------------------------------------------------------------- impacts
  /**
   * Called when the car hits something. Returns a description of what happened
   * so the caller can drive sound and camera shake from one place.
   */
  impact(body, speed) {
    const item = this.byBody.get(body)
    if (!item || item.broken) return null
    if (speed < item.breakAt) return { broke: false, item }
    // Flagged now so repeat contacts in the same step don't queue it twice; the
    // work happens in update(), once the step has finished.
    item.broken = true
    this.pending.push({ item, speed })
    return { broke: true, item }
  }

  break(item, speed = 6) {
    if (item.dead) return
    item.broken = true

    const p = item.body.position
    const origin = new THREE.Vector3(p.x, p.y, p.z)
    this._burst(origin, item.chunks, item.chunkSize, item.chunkColor, speed)

    // Hide the instanced parts, then retire the body.
    for (const part of item.parts) {
      if (part.index < 0) continue
      scratchMatrix.compose(PARKED, new THREE.Quaternion(), new THREE.Vector3(0, 0, 0))
      part.pool.write(part.index, scratchMatrix)
      this.dirtyPools.add(part.pool)
    }
    if (item.mesh) item.mesh.visible = false

    this.world.removeBody(item.body)
    this.byBody.delete(item.body)
    item.dead = true
    this.onBreak(origin, speed, item)
  }

  // ----------------------------------------------------------------- debris
  _buildDebrisPool() {
    const geometry = new THREE.TetrahedronGeometry(0.62, 0)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, vertexColors: false })
    this.debrisMesh = new THREE.InstancedMesh(geometry, material, DEBRIS_POOL)
    this.debrisMesh.castShadow = true
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.debrisMesh.frustumCulled = false
    this.debrisMesh.count = DEBRIS_POOL
    this.scene.add(this.debrisMesh)

    const white = new THREE.Color(0xffffff)
    for (let i = 0; i < DEBRIS_POOL; i++) this.debrisMesh.setColorAt(i, white)

    this.debris = []
    for (let i = 0; i < DEBRIS_POOL; i++) {
      const body = new CANNON.Body({
        mass: 0.7,
        material: this.material,
        shape: new CANNON.Box(new CANNON.Vec3(0.16, 0.16, 0.16)),
        position: new CANNON.Vec3(0, -500, 0),
        allowSleep: true,
        sleepSpeedLimit: 0.4,
        sleepTimeLimit: 0.4,
        angularDamping: 0.25,
        // Debris is scenery, not an obstacle: it should never block the car or
        // shove other props around.
        collisionFilterGroup: 4,
        collisionFilterMask: STATIC_GROUP,
      })
      body.sleep()
      this.world.addBody(body)
      this.debris.push({ body, life: 0, scale: 0.3, index: i })
      this._writeDebris(this.debris[i])
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true
    this.debrisCursor = 0
  }

  /** Public burst, for impacts against things that don't themselves break. */
  puff(origin, { count = 5, size = 0.5, color = 0xd8d2c4, speed = 4 } = {}) {
    this._burst(origin, count, size, color, speed)
  }

  _burst(origin, count, size, color, speed) {
    const tint = new THREE.Color(color ?? C.sand)
    for (let i = 0; i < count; i++) {
      const piece = this.debris[this.debrisCursor]
      this.debrisCursor = (this.debrisCursor + 1) % DEBRIS_POOL

      const angle = Math.random() * Math.PI * 2
      const spread = 0.6 + Math.random() * 1.1
      piece.body.wakeUp()
      piece.body.position.set(
        origin.x + Math.cos(angle) * spread * 0.5,
        origin.y + 0.4 + Math.random() * 1.2,
        origin.z + Math.sin(angle) * spread * 0.5
      )
      const kick = Math.min(9, 2.5 + speed * 0.45)
      piece.body.velocity.set(
        Math.cos(angle) * spread * kick * 0.5,
        2.4 + Math.random() * kick * 0.5,
        Math.sin(angle) * spread * kick * 0.5
      )
      piece.body.angularVelocity.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      )
      piece.body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      piece.life = DEBRIS_LIFE
      piece.scale = size * (0.65 + Math.random() * 0.7)
      this.debrisMesh.setColorAt(piece.index, tint)
    }
    this.debrisMesh.instanceColor.needsUpdate = true
  }

  _writeDebris(piece) {
    const b = piece.body
    scratchPos.set(b.position.x, b.position.y, b.position.z)
    scratchQuat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
    // Shrink away over the last second rather than blinking out.
    const fade = piece.life < 1 ? Math.max(0, piece.life) : 1
    const s = piece.life > 0 ? piece.scale * fade : 0
    scratchScale.set(s, s, s)
    scratchMatrix.compose(scratchPos, scratchQuat, scratchScale)
    this.debrisMesh.setMatrixAt(piece.index, scratchMatrix)
  }

  // ------------------------------------------------------------------- tick
  _writeItem(item) {
    const b = item.body
    scratchPos.set(b.position.x, b.position.y, b.position.z)
    scratchQuat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
    scratchBody.compose(scratchPos, scratchQuat, ONE)
    for (const part of item.parts) {
      if (part.index < 0) continue
      scratchMatrix.multiplyMatrices(scratchBody, part.matrix)
      part.pool.write(part.index, scratchMatrix)
    }
  }

  update(dt) {
    if (this.pending.length) {
      for (const { item, speed } of this.pending) this.break(item, speed)
      this.pending.length = 0
    }

    // Only objects the car has actually disturbed need rewriting.
    for (const item of this.items) {
      if (item.dead || !item.parts.length) continue
      if (item.body.sleepState === CANNON.Body.SLEEPING) continue
      this._writeItem(item)
      for (const part of item.parts) this.dirtyPools.add(part.pool)
    }
    for (const pool of this.dirtyPools) pool.flush()
    this.dirtyPools.clear()

    let debrisDirty = false
    for (const piece of this.debris) {
      if (piece.life <= 0) continue
      piece.life -= dt
      if (piece.life <= 0) {
        piece.body.position.set(0, -500, 0)
        piece.body.velocity.setZero()
        piece.body.angularVelocity.setZero()
        piece.body.sleep()
      }
      this._writeDebris(piece)
      debrisDirty = true
    }
    if (debrisDirty) this.debrisMesh.instanceMatrix.needsUpdate = true
  }
}
