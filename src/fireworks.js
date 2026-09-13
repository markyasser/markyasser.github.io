import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Fireworks for scoring a goal.
//
// Not physics: a fixed pool of instanced sparks on plain ballistic motion, so a
// celebration costs nothing but a matrix write per spark. Colour rides on the
// instance colour attribute, and the bloom pass does the glowing.
// ---------------------------------------------------------------------------

const SPARKS = 520
const GRAVITY = 7.5
const DRAG = 0.72

const PALETTE = [0xff7a6b, 0xffd27a, 0x7fe6ff, 0x9d8bff, 0x6df2b8, 0xff9ad5]

const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const scale = new THREE.Vector3()
const tint = new THREE.Color()

export class Fireworks {
  constructor(scene) {
    // Big enough to read from across the pitch: at a tenth of this they were
    // single pixels and the whole celebration went unnoticed.
    const geometry = new THREE.SphereGeometry(0.3, 7, 6)
    // fog:false keeps the shells bright at distance, and toneMapped:false lets
    // them sit above the bloom threshold so they actually glow.
    const material = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false })
    this.mesh = new THREE.InstancedMesh(geometry, material, SPARKS)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = SPARKS
    scene.add(this.mesh)

    for (let i = 0; i < SPARKS; i++) this.mesh.setColorAt(i, tint.setHex(0xffffff))

    this.sparks = []
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.push({ life: 0, maxLife: 1, velocity: new THREE.Vector3(), position: new THREE.Vector3() })
      this._write(i, 0)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.cursor = 0
    this.pending = []
    this.active = false
  }

  /** A single shell: `count` sparks thrown outward from one point. */
  burst(origin, color = PALETTE[(Math.random() * PALETTE.length) | 0], count = 95) {
    tint.setHex(color)
    for (let i = 0; i < count; i++) {
      const spark = this.sparks[this.cursor]
      const index = this.cursor
      this.cursor = (this.cursor + 1) % SPARKS

      // Directions on a sphere, so the shell opens evenly rather than in a disc.
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 8 + Math.random() * 9
      spark.velocity.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.85 + 2.5,
        Math.sin(phi) * Math.sin(theta) * speed
      )
      spark.position.copy(origin)
      spark.maxLife = 1.4 + Math.random() * 1.1
      spark.life = spark.maxLife
      this.mesh.setColorAt(index, tint)
    }
    this.mesh.instanceColor.needsUpdate = true
    this.active = true
  }

  /** A staggered volley above a point — what a goal gets. */
  celebrate(origin) {
    const at = origin.clone()
    this.pending.push(
      { delay: 0.0, x: 0, z: 0, h: 9 },
      { delay: 0.3, x: -8, z: -3, h: 7 },
      { delay: 0.58, x: 8, z: 2, h: 11 },
      { delay: 0.9, x: -3, z: 6, h: 8 },
      { delay: 1.2, x: 5, z: -6, h: 10 },
      { delay: 1.5, x: 0, z: 0, h: 13 }
    )
    this.origin = at
  }

  _write(index, size) {
    const spark = this.sparks[index]
    position.copy(spark.position)
    scale.setScalar(size)
    matrix.compose(position, quaternion, scale)
    this.mesh.setMatrixAt(index, matrix)
  }

  update(dt) {
    if (this.pending.length && this.origin) {
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const shell = this.pending[i]
        shell.delay -= dt
        if (shell.delay > 0) continue
        this.burst(
          position.set(this.origin.x + shell.x, this.origin.y + shell.h, this.origin.z + shell.z).clone()
        )
        this.pending.splice(i, 1)
      }
    }
    if (!this.active) return

    let alive = 0
    for (let i = 0; i < SPARKS; i++) {
      const spark = this.sparks[i]
      if (spark.life <= 0) {
        this._write(i, 0)
        continue
      }
      spark.life -= dt
      alive++

      spark.velocity.y -= GRAVITY * dt
      spark.velocity.multiplyScalar(1 - DRAG * dt)
      spark.position.addScaledVector(spark.velocity, dt)

      // Shrink away rather than blink out.
      const t = Math.max(0, spark.life / spark.maxLife)
      this._write(i, 0.3 + t * t * 1.35)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.active = alive > 0 || this.pending.length > 0
  }
}
