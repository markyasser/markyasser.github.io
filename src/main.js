import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import * as CANNON from 'cannon-es'
import { C } from './palette.js'
import { Car } from './car.js'
import { buildWorld, ZONES } from './world.js'
import { STATIC_GROUP } from './props.js'
import { preloadMarks } from './logos.js'
import { Controls } from './controls.js'
import { UI } from './ui.js'
import { Minimap } from './minimap.js'
import { Audio } from './audio.js'
import { SHARD_FACTS } from './data.js'

const FIXED_STEP = 1 / 60
const SPAWN = new THREE.Vector3(0, 1.6, 34)
const SPAWN_HEADING = Math.PI

// Chase / wide / overhead. Offsets are in the car's local frame.
/**
 * Camera modes.
 *
 * The default is deliberately NOT a chase camera. A chase camera sits behind the
 * car and swings around as it turns, which makes the world spin around a
 * stationary vehicle — the third-person-shooter feel. Holding the camera at a
 * fixed angle on the world instead keeps the map still and lets the car drive
 * around inside it, which is what makes a scene like this read as a place
 * rather than a corridor.
 *
 * `fixed: true` means the offset is a world-space vector that never rotates
 * with the car. `lead` shifts the framing along the car's velocity so you see
 * where you are going without the view ever turning.
 */
const CAMERA_MODES = [
  { name: 'follow', fixed: true, offset: new THREE.Vector3(0, 17, 20), lead: 0.55, damp: 4.2 },
  { name: 'overhead', fixed: true, offset: new THREE.Vector3(0, 34, 7), lead: 0.45, damp: 5 },
  { name: 'chase', offset: new THREE.Vector3(0, 7.6, -14), lookAhead: 8, damp: 3.6 },
]

// How far ahead of the car the fixed camera is allowed to look, in metres.
const MAX_LEAD = 7

/**
 * Vertical FOV that keeps a sensible horizontal view on any shape of screen.
 * A tall phone in portrait would otherwise show a narrow slice of the world.
 */
function fovFor(aspect) {
  if (aspect >= 1) return 56
  return THREE.MathUtils.clamp((56 / aspect) * 0.6, 56, 88)
}

class App {
  constructor() {
    this.canvas = document.getElementById('scene')
    this.clock = new THREE.Clock()
    this.accumulator = 0
    this.elapsed = 0
    this.running = false
    this.cameraMode = 0
    // Exposed so the camera framing can be tuned live from the console.
    this.cameraModes = CAMERA_MODES
    this.frameTimes = []
    this.qualityScale = 1

    // Scratch objects reused every frame by the camera logic.
    this._pivot = new THREE.Vector3()
    this._camDir = new THREE.Vector3()
    this._desired = new THREE.Vector3()
    this._target = new THREE.Vector3()
    this._lead = new THREE.Vector3()
    this._ray = new CANNON.Ray()
    this._rayFrom = new CANNON.Vec3()
    this._rayTo = new CANNON.Vec3()
    this._rayHit = new CANNON.RaycastResult()

    this._setupRenderer()
    this._setupScene()
    this._setupPhysics()

    this.ui = new UI({
      onStart: () => this.start(),
      onToggleSound: () => this.audio.toggle(),
      onReset: () => this.resetCar(),
      onCamera: () => this.cycleCamera(),
    })
    this.audio = new Audio()
    this.controls = new Controls()
    this.controls.on('interact', () => this.interact())
    this.controls.on('reset', () => this.resetCar())
    this.controls.on('camera', () => this.cycleCamera())
    this.controls.bindTouch(document)

    this._build()
  }

  // ------------------------------------------------------------- setup
  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  }

  _setupScene() {
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(C.fog, 80, 320)

    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.PerspectiveCamera(fovFor(aspect), aspect, 0.4, 1200)
    this.camera.position.set(0, 12, 46)

    // Blue hour. At 5am the sun is still below the horizon, so there is no warm
    // key light at all — everything on the ground is lit by the sky. This is
    // load-bearing: any warm directional light spread across a blue scene mixes
    // to muddy violet on every surface it touches. All the warmth in this world
    // comes from the horizon band of the sky and from things that are actually
    // emitting light — windows, street lamps, shards.
    this.scene.add(new THREE.HemisphereLight(0x8dbcf0, 0x22374f, 3.1))
    this.scene.add(new THREE.AmbientLight(0x5480bd, 0.85))

    // Cool and soft: present only to give shapes a readable shadow.
    const sun = new THREE.DirectionalLight(0xbcd8f5, 1.35)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 220
    sun.shadow.bias = -0.0012
    sun.shadow.normalBias = 0.035
    const d = 56
    Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d })
    sun.shadow.camera.updateProjectionMatrix()
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun


    this._setupComposer()

    window.addEventListener('resize', () => this._onResize())
  }

  /**
   * Bloom is what turns the lit windows, street lamps and shards into actual
   * light sources rather than pale paint. The threshold is deliberately high so
   * only genuinely emissive surfaces bloom — a low one washes the whole scene.
   */
  _setupComposer() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.45, 0.85)
    this.composer.addPass(this.bloom)
    // OutputPass applies the renderer's tone mapping and output colour space,
    // which RenderPass alone would skip.
    this.composer.addPass(new OutputPass())
    this.composer.setSize(w, h)
    this.bloomEnabled = true
  }

  _setupPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19.6, 0) })
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = true
    this.world.solver.iterations = 12
    this.world.defaultContactMaterial.friction = 0.2

    this.materials = {
      ground: new CANNON.Material('ground'),
      car: new CANNON.Material('car'),
      prop: new CANNON.Material('prop'),
    }
    const add = (a, b, opts) => this.world.addContactMaterial(new CANNON.ContactMaterial(a, b, opts))
    add(this.materials.ground, this.materials.car, { friction: 0.04, restitution: 0.05 })
    add(this.materials.ground, this.materials.prop, { friction: 0.26, restitution: 0.1 })
    add(this.materials.car, this.materials.prop, { friction: 0.1, restitution: 0.25 })
    add(this.materials.prop, this.materials.prop, { friction: 0.22, restitution: 0.15 })
  }

  async _build() {
    const step = async (value, label) => {
      this.ui.setProgress(value, label)
      // Yield so the loading bar actually paints between heavy build steps.
      await new Promise((r) => setTimeout(r, 16))
    }

    await step(0.08, 'Loading the marks…')
    // Every texture is drawn into a canvas exactly once, so any real logo
    // artwork has to be decoded before the world is built.
    await preloadMarks()

    await step(0.15, 'Paving the roads…')
    this.worldRefs = buildWorld({
      scene: this.scene,
      world: this.world,
      renderer: this.renderer,
      materials: this.materials,
      onBreak: () => {
        this.smashed = (this.smashed || 0) + 1
      },
    })

    await step(0.62, 'Unloading the crates…')
    this.car = new Car({
      scene: this.scene,
      world: this.world,
      materials: this.materials,
      paint: C.coral,
      spawn: SPAWN,
    })
    this.car.spawnHeading = SPAWN_HEADING
    this.car.reset(SPAWN, SPAWN_HEADING)

    this.car.chassisBody.addEventListener('collide', (e) => this._onCollide(e))

    await step(0.84, 'Warming the engine…')
    this.minimap = new Minimap(document.getElementById('minimap'), { shards: this.worldRefs.shards })
    this.ui.setShards(0, this.worldRefs.shards.length)

    // Pre-compile shaders against the real camera so the first frame is clean.
    this.camera.position.set(0, 8, 44)
    this.camera.lookAt(0, 2, 0)
    this.renderer.compile(this.scene, this.camera)
    this.renderer.render(this.scene, this.camera)

    await step(1, 'Ready')
    this.ui.readyToStart()
    this._loop()
  }

  // -------------------------------------------------------------- flow
  start() {
    this.ui.hideLoading()
    this.running = true
    this.clock.getDelta()
    this.ui.toast(
      this.ui.isTouch
        ? 'Pull up to a building, then tap Open to read it.'
        : 'Drive up to a building and press E to read it.',
      5200
    )
    setTimeout(() => {
      if (!this.controls.hasDriven) {
        this.ui.toast(
          this.ui.isTouch ? 'Use the pads at the bottom to drive.' : 'Use W A S D or the arrow keys.',
          5000
        )
      }
    }, 7000)
  }

  cycleCamera() {
    this.cameraMode = (this.cameraMode + 1) % CAMERA_MODES.length
    this.ui.toast(`Camera: ${CAMERA_MODES[this.cameraMode].name}`, 1600)
  }

  resetCar() {
    // Reset to the nearest road-side point rather than all the way to spawn,
    // so a flip in a far corner isn't punished with a long drive back.
    const p = this.car.position
    const far = Math.hypot(p.x, p.z) > 26
    if (far && !this.car.isFlipped()) {
      this.car.rightItself()
      return
    }
    if (far) {
      this.car.reset(new THREE.Vector3(p.x, 2.4, p.z), this._headingToward(0, 0))
    } else {
      this.car.reset(SPAWN, SPAWN_HEADING)
    }
  }

  _headingToward(x, z) {
    return Math.atan2(x - this.car.position.x, z - this.car.position.z)
  }

  interact() {
    if (this.ui.isPanelOpen) {
      this.ui.closePanel()
      return
    }
    if (this.activePOI) {
      this.ui.openPOI(this.activePOI)
      this.audio.chime()
    }
  }

  _onCollide(event) {
    const other = event.body
    if (!other) return
    // Closing speed along the contact normal is the honest measure of a hit;
    // raw velocity counts a car sliding past a wall as a collision.
    const impact = Math.abs(event.contact.getImpactVelocityAlongNormal())
    if (impact < 1.8) return

    const result = this.worldRefs.breakables.impact(other, impact)
    if (result && result.broke) {
      this.audio.crack(Math.min(1.6, impact / 9))
      this._shake(Math.min(1, impact / 11))
      return
    }

    this.audio.thud(Math.min(3, impact / 6))
    if (impact > 5) {
      this._shake(Math.min(0.55, impact / 26))
      // Buildings and signs don't break, but a hit should still leave a mark.
      if (other.mass === 0) {
        const c = event.contact
        const base = c.bi === this.car.chassisBody ? c.bi : c.bj
        const arm = c.bi === this.car.chassisBody ? c.ri : c.rj
        this.worldRefs.breakables.puff(
          new THREE.Vector3(base.position.x + arm.x, base.position.y + arm.y, base.position.z + arm.z),
          { count: 4, size: 0.42, speed: impact * 0.5 }
        )
      }
    }
  }

  /** Kick the camera briefly. Decays in _updateCamera. */
  _shake(amount) {
    this.shake = Math.min(1.2, (this.shake || 0) + amount)
  }

  _onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.fov = fovFor(this.camera.aspect)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.qualityScale)
    if (this.composer) this.composer.setSize(w, h)
  }

  // -------------------------------------------------------------- loop
  _loop() {
    requestAnimationFrame(() => this._loop())
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.elapsed += dt

    if (this.running) {
      const input = this.controls.sample(dt)
      // Driving keys shouldn't fight with a panel the player is reading.
      const gated = this.ui.isPanelOpen || this.ui.resume.classList.contains('open')
      const active = gated ? { throttle: 0, steer: 0, handbrake: false } : input
      this.car.drive(active, dt)
      const recovery = this.car.updateRecovery(active, dt)
      if (recovery === 'right') {
        this.car.rightItself()
      } else if (recovery === 'free') {
        // A lift frees a car beached on a prop. If that doesn't take, it is
        // wedged in scenery and only a proper reset will do.
        this._hops = (this._hops || 0) + 1
        if (this._hops >= 2) {
          this._hops = 0
          this.car.reset(SPAWN, SPAWN_HEADING)
          this.ui.toast('Stuck — back to the start.', 2600)
        } else {
          this.car.freeUp()
        }
      } else if (this.car.speed > 3) {
        this._hops = 0
      }

      this.accumulator += dt
      let steps = 0
      while (this.accumulator >= FIXED_STEP && steps < 4) {
        this.world.step(FIXED_STEP)
        this.accumulator -= FIXED_STEP
        steps++
      }
      if (steps === 4) this.accumulator = 0

      this.car.sync()
      this.worldRefs.syncDynamics()
      this.worldRefs.breakables.update(dt)
      this._checkShards()
      this._checkPOI()
      this._guardBounds()

      this.ui.setSpeed(this.car.speed * 3.6)
      this.audio.update(this.car.speed, this.controls.state.throttle)
      this.minimap.draw(this.car)
    }

    this._updateCamera(dt)
    this.worldRefs.update(dt, this.elapsed, this.camera)
    this._followSun()
    this._adaptQuality(dt)

    if (this.bloomEnabled) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  _updateCamera(dt) {
    const mode = CAMERA_MODES[this.cameraMode]
    if (!this.car) return

    const carPos = this.car.position
    const zoom = this.controls.zoom
    const desired = this._desired
    const target = this._target

    if (mode.fixed) {
      // World-space offset: the view direction is constant, so the map never
      // rotates. Only the camera's position tracks the car.
      desired.copy(carPos).addScaledVector(mode.offset, zoom)

      // Shift the whole framing along the direction of travel, so the car sits
      // towards the trailing edge of the view rather than dead centre.
      const v = this.car.chassisBody.velocity
      const lead = this._lead.set(v.x, 0, v.z).multiplyScalar(mode.lead)
      if (lead.lengthSq() > MAX_LEAD * MAX_LEAD) lead.setLength(MAX_LEAD)
      desired.add(lead)

      // Aim above the car so the view leans into what is ahead rather than
      // filling the lower half with ground the player has already crossed.
      target.copy(carPos).add(lead).setY(carPos.y + 2.2)
    } else {
      // Chase: offset is rotated into the car's frame, so it trails the car.
      const forward = this.car.forward().setY(0)
      if (forward.lengthSq() < 1e-4) forward.set(0, 0, 1)
      forward.normalize()

      desired.copy(carPos).addScaledVector(forward, mode.offset.z * zoom)
      // Rise a little at speed, for a sense of momentum.
      desired.y = carPos.y + mode.offset.y * zoom + Math.min(2.4, this.car.speed * 0.07)

      target.copy(carPos).addScaledVector(forward, mode.lookAhead).setY(carPos.y + 1.6)
    }

    const pivot = this._pivot.copy(carPos).setY(carPos.y + 1.5)
    this._avoidClipping(pivot, desired)

    this.camera.position.lerp(desired, 1 - Math.exp(-mode.damp * dt))

    // Keep the camera above ground even on steep ramps.
    if (this.camera.position.y < 1.6) this.camera.position.y = 1.6

    if (!this._lookAt) this._lookAt = target.clone()
    this._lookAt.lerp(target, 1 - Math.exp(-mode.damp * 1.4 * dt))
    this.camera.lookAt(this._lookAt)

    if (this.shake > 0.001) {
      const k = this.shake * 0.55
      this.camera.position.x += (Math.random() - 0.5) * k
      this.camera.position.y += (Math.random() - 0.5) * k
      this.camera.position.z += (Math.random() - 0.5) * k
      this.shake *= Math.exp(-7 * dt)
    } else {
      this.shake = 0
    }
  }

  /**
   * Pull the camera in if terrain stands between it and the car. Only static
   * geometry is tested — the boundary, the stunt ramps — so the loose props
   * that now make up the whole world never yank the view. `desired` is
   * adjusted in place.
   */
  _avoidClipping(pivot, desired) {
    const dir = this._camDir.copy(desired).sub(pivot)
    const dist = dir.length()
    if (dist < 0.05) return
    dir.divideScalar(dist)

    this._rayFrom.set(pivot.x, pivot.y, pivot.z)
    this._rayTo.set(desired.x, desired.y, desired.z)
    this._rayHit.reset()
    this._ray.from = this._rayFrom
    this._ray.to = this._rayTo
    this._ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      result: this._rayHit,
      collisionFilterMask: STATIC_GROUP,
      skipBackfaces: false,
    })
    if (!this._rayHit.hasHit) return
    const hit = this._rayHit.hitPointWorld
    const hitDist = Math.hypot(hit.x - pivot.x, hit.y - pivot.y, hit.z - pivot.z)
    const safe = Math.max(4.6, hitDist - 0.8)
    if (safe >= dist) return
    desired.copy(pivot).addScaledVector(dir, safe)
    // Close in, look down over the car rather than sitting at bumper height.
    desired.y = Math.max(desired.y, pivot.y + 2.4)
  }

  _followSun() {
    if (!this.car) return
    const p = this.car.position
    // Fairly high despite the hour: this is skylight standing in for the sun,
    // and a low angle would rake shadows across the whole map.
    this.sun.position.set(p.x + 46, 62, p.z + 34)
    this.sun.target.position.set(p.x, 0, p.z)
    this.sun.target.updateMatrixWorld()
  }

  _checkShards() {
    const p = this.car.position
    for (const shard of this.worldRefs.shards) {
      if (shard.collected) continue
      if (p.distanceToSquared(shard.position) > 25) continue
      shard.collected = true
      shard.mesh.visible = false
      shard.halo.visible = false
      const found = this.worldRefs.shards.filter((s) => s.collected).length
      this.ui.setShards(found, this.worldRefs.shards.length)
      this.ui.toast(`◆ ${shard.fact}`, 5200)
      this.audio.chime()
      if (found === this.worldRefs.shards.length) {
        setTimeout(() => this.ui.toast('All shards found. That is the whole CV — thanks for driving.', 7000), 800)
      }
    }
  }

  _checkPOI() {
    const p = this.car.position
    let best = null
    let bestD = Infinity
    for (const poi of this.worldRefs.pois) {
      const d = p.distanceTo(poi.position)
      if (d < poi.radius && d < bestD) {
        best = poi
        bestD = d
      }
    }
    this.activePOI = best

    // The prompt is suppressed while anything is open on top of the world.
    const blocked = this.ui.isPanelOpen || this.ui.resume.classList.contains('open')
    const key = best ? `${best.id}|${blocked}` : `none|${blocked}`
    if (key === this._promptKey) return
    this._promptKey = key

    if (best && !blocked) this.ui.showPrompt(`Open ${best.title}`, () => this.interact())
    else this.ui.hidePrompt()
  }

  _guardBounds() {
    const p = this.car.chassisBody.position
    // Below the ground plane means the car has been pushed inside a building.
    if (p.y < -1.6 || Math.abs(p.x) > 200 || Math.abs(p.z) > 200) {
      this.car.reset(SPAWN, SPAWN_HEADING)
      this.ui.toast('Back to the start.', 2200)
    }
  }

  /** Drop the pixel ratio if we are consistently missing frames. */
  _adaptQuality(dt) {
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 90) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    if (avg <= 0.028) return
    if (this.bloomEnabled) {
      this.bloomEnabled = false
      return
    }
    if (this.qualityScale > 0.62) {
      this.qualityScale = Math.max(0.62, this.qualityScale - 0.18)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.qualityScale)
      if (this.qualityScale <= 0.7) this.renderer.shadowMap.enabled = false
    }
  }
}

const app = new App()
// Exposed for debugging in the console.
window.__app = app
