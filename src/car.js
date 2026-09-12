import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C } from './palette.js'

const UP = new THREE.Vector3(0, 1, 0)

// Chassis dimensions (metres). Forward is +Z, right is +X, up is +Y.
const BODY = { w: 1.86, h: 0.54, l: 4.0 }
const WHEEL = { radius: 0.44, width: 0.36 }
const AXLE_Z = 1.38
const AXLE_X = 0.92

const MAX_STEER = 0.52
const ENGINE_FORCE = 560
const REVERSE_FORCE = 300
const BRAKE_FORCE = 34
const HANDBRAKE_FORCE = 120
const IDLE_BRAKE = 3.2

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...opts })

function buildBody(paint) {
  const group = new THREE.Group()

  const shell = mat(paint, { roughness: 0.32, metalness: 0.22 })
  const dark = mat(0x1b2331, { roughness: 0.5 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd4e8,
    roughness: 0.08,
    metalness: 0.5,
    transparent: true,
    opacity: 0.72,
  })
  const chrome = mat(0xd8dee8, { roughness: 0.25, metalness: 0.8 })

  const add = (geo, material, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.rotation.x = rx
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
    return m
  }

  // Lower body + a slightly narrower "skirt" so the silhouette isn't a slab.
  add(new RoundedBoxGeometry(BODY.w, 0.5, BODY.l, 4, 0.16), shell, 0, 0.06, 0)
  add(new RoundedBoxGeometry(BODY.w - 0.16, 0.26, BODY.l - 0.5, 3, 0.1), dark, 0, -0.2, 0)

  // Cabin, pulled back and tapered.
  add(new RoundedBoxGeometry(BODY.w - 0.26, 0.56, 1.82, 4, 0.18), shell, 0, 0.56, -0.26)
  add(new RoundedBoxGeometry(BODY.w - 0.2, 0.34, 1.5, 3, 0.1), glass, 0, 0.62, -0.24)

  // Windscreen + rear glass as slanted panels.
  const wsGeo = new THREE.BoxGeometry(BODY.w - 0.34, 0.62, 0.08)
  add(wsGeo, glass, 0, 0.56, 0.68, -0.62)
  add(wsGeo, glass, 0, 0.58, -1.16, 0.6)

  // Roof cap keeps the cabin from reading as an open box.
  add(new RoundedBoxGeometry(BODY.w - 0.3, 0.14, 1.7, 3, 0.06), shell, 0, 0.85, -0.3)

  // Bumpers.
  add(new RoundedBoxGeometry(BODY.w + 0.04, 0.28, 0.3, 3, 0.1), dark, 0, -0.06, BODY.l / 2 - 0.1)
  add(new RoundedBoxGeometry(BODY.w + 0.04, 0.28, 0.3, 3, 0.1), dark, 0, -0.06, -BODY.l / 2 + 0.1)

  // Headlights.
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6d8,
    emissive: 0xfff0c0,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  })
  const headGeo = new THREE.BoxGeometry(0.42, 0.16, 0.1)
  add(headGeo, headMat, -0.6, 0.12, BODY.l / 2 - 0.02)
  add(headGeo, headMat, 0.6, 0.12, BODY.l / 2 - 0.02)

  // Tail lights — brightened while braking.
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xd93b2b,
    emissive: 0xb01f12,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  })
  const tailGeo = new THREE.BoxGeometry(0.4, 0.16, 0.1)
  add(tailGeo, tailMat, -0.62, 0.14, -BODY.l / 2 + 0.02)
  add(tailGeo, tailMat, 0.62, 0.14, -BODY.l / 2 + 0.02)

  // Spoiler.
  add(new RoundedBoxGeometry(BODY.w - 0.3, 0.08, 0.34, 3, 0.04), dark, 0, 0.72, -1.9)
  const stalk = new RoundedBoxGeometry(0.1, 0.22, 0.1, 2, 0.03)
  add(stalk, dark, -0.6, 0.62, -1.9)
  add(stalk, dark, 0.6, 0.62, -1.9)

  // Side mirrors + a racing stripe for a bit of character.
  const mirror = new RoundedBoxGeometry(0.16, 0.1, 0.12, 2, 0.04)
  add(mirror, chrome, -(BODY.w / 2 + 0.04), 0.6, 0.5)
  add(mirror, chrome, BODY.w / 2 + 0.04, 0.6, 0.5)
  add(new THREE.BoxGeometry(0.26, 0.02, BODY.l - 0.5), mat(C.cream), 0, 0.32, 0.1)

  return { group, tailMat, headMat }
}

function buildWheel() {
  const group = new THREE.Group()

  const tireGeo = new THREE.CylinderGeometry(WHEEL.radius, WHEEL.radius, WHEEL.width, 20)
  tireGeo.rotateZ(Math.PI / 2)
  const tire = new THREE.Mesh(tireGeo, mat(0x1a1f29, { roughness: 0.85 }))
  tire.castShadow = true
  group.add(tire)

  // Hub disc + spokes, so wheel rotation is visible while driving.
  const rimGeo = new THREE.CylinderGeometry(WHEEL.radius * 0.6, WHEEL.radius * 0.6, WHEEL.width + 0.04, 16)
  rimGeo.rotateZ(Math.PI / 2)
  const rim = new THREE.Mesh(rimGeo, mat(0xe9edf3, { roughness: 0.3, metalness: 0.6 }))
  group.add(rim)

  const spokeGeo = new THREE.BoxGeometry(WHEEL.width + 0.06, 0.08, WHEEL.radius * 1.05)
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, mat(0x8d97a6, { metalness: 0.5, roughness: 0.4 }))
    spoke.rotation.x = (i * Math.PI) / 3
    group.add(spoke)
  }

  return group
}

export class Car {
  constructor({ scene, world, materials, paint = C.coral, spawn = new THREE.Vector3(0, 2, 0) }) {
    this.scene = scene
    this.world = world
    this.spawn = spawn.clone()
    this.spawnHeading = 0

    const { group, tailMat, headMat } = buildBody(paint)
    this.mesh = group
    this.tailMat = tailMat
    this.headMat = headMat
    scene.add(group)

    const chassisShape = new CANNON.Box(new CANNON.Vec3(BODY.w / 2, BODY.h / 2, BODY.l / 2))
    this.chassisBody = new CANNON.Body({
      mass: 190,
      material: materials.car,
      position: new CANNON.Vec3(spawn.x, spawn.y, spawn.z),
      angularDamping: 0.35,
      linearDamping: 0.02,
    })
    // Lift the collision box well clear of the wheels' contact line. A low
    // chassis catches the leading edge of every ramp before the suspension has
    // a chance to lift the nose.
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.14, 0))

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    })

    const wheelOptions = {
      radius: WHEEL.radius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 44,
      suspensionRestLength: 0.48,
      frictionSlip: 3.6,
      dampingRelaxation: 2.8,
      dampingCompression: 4.7,
      maxSuspensionForce: 100000,
      rollInfluence: 0.015,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.44,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    }

    // Order matters: 0/1 front (steered), 2/3 rear (driven).
    const mounts = [
      [-AXLE_X, 0, AXLE_Z],
      [AXLE_X, 0, AXLE_Z],
      [-AXLE_X, 0, -AXLE_Z],
      [AXLE_X, 0, -AXLE_Z],
    ]
    for (const [x, y, z] of mounts) {
      wheelOptions.chassisConnectionPointLocal.set(x, y, z)
      this.vehicle.addWheel(wheelOptions)
    }
    this.vehicle.addToWorld(world)

    this.wheelMeshes = this.vehicle.wheelInfos.map(() => {
      const w = buildWheel()
      scene.add(w)
      return w
    })

    this.steering = 0
    this.speed = 0
    this.braking = false
    this.airborne = false
    this.grounded = 4
    this.stuckFor = 0
    this.flippedFor = 0
    this._v = new THREE.Vector3()
  }

  /** Apply one frame of input. `input` carries normalised -1..1 axes. */
  drive(input, dt) {
    const v = this.chassisBody.velocity
    const forward = new CANNON.Vec3()
    this.chassisBody.vectorToWorldFrame(new CANNON.Vec3(0, 0, 1), forward)
    const alongForward = v.x * forward.x + v.y * forward.y + v.z * forward.z
    this.speed = Math.hypot(v.x, v.z)
    this.signedSpeed = alongForward

    // Steering authority tapers with speed so the car stays controllable.
    const speedFactor = 1 / (1 + Math.abs(alongForward) * 0.055)
    // cannon's raycast vehicle steers the opposite way from our input axis.
    const targetSteer = -input.steer * MAX_STEER * Math.max(0.34, speedFactor)
    const steerRate = dt * 7
    this.steering += THREE.MathUtils.clamp(targetSteer - this.steering, -steerRate, steerRate)
    this.vehicle.setSteeringValue(this.steering, 0)
    this.vehicle.setSteeringValue(this.steering, 1)

    const throttle = input.throttle
    let engine = 0
    let brake = IDLE_BRAKE

    if (throttle > 0.01) {
      // Pressing forward while rolling backwards should brake first.
      engine = alongForward < -1 ? 0 : -ENGINE_FORCE * throttle
      brake = alongForward < -1 ? BRAKE_FORCE : 0
    } else if (throttle < -0.01) {
      engine = alongForward > 1 ? 0 : -REVERSE_FORCE * throttle
      brake = alongForward > 1 ? BRAKE_FORCE : 0
    }

    this.braking = brake > IDLE_BRAKE || input.handbrake
    if (input.handbrake) {
      engine = 0
      brake = HANDBRAKE_FORCE
    }

    // Rear-wheel drive with a little front assist for grip out of corners.
    this.vehicle.applyEngineForce(engine * 0.35, 0)
    this.vehicle.applyEngineForce(engine * 0.35, 1)
    this.vehicle.applyEngineForce(engine, 2)
    this.vehicle.applyEngineForce(engine, 3)
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i)

    // Soft top-speed limiter.
    const max = 25
    if (this.speed > max) {
      const s = max / this.speed
      v.x *= s
      v.z *= s
    }

    this.tailMat.emissiveIntensity = this.braking ? 2.6 : 0.6

    // Gentle downforce keeps the car planted over ramps and crests.
    const grounded = this.grounded
    this.airborne = grounded === 0
    if (grounded >= 3 && this.speed > 6) {
      this.chassisBody.applyForce(new CANNON.Vec3(0, -this.speed * 26, 0), this.chassisBody.position)
    }
    if (this.airborne) this._stabilise(dt)
  }

  /**
   * Arcade air control: while all four wheels are off the ground, nudge the
   * chassis back towards level. Without it, every jump off the stunt ramps is a
   * coin flip between landing and ending up on the roof.
   */
  _stabilise(dt) {
    const body = this.chassisBody
    const up = UP.clone().applyQuaternion(this.mesh.quaternion)
    // Axis that rotates the car's up vector back onto the world's.
    const axis = new THREE.Vector3().crossVectors(up, UP)
    const tilt = axis.length()
    if (tilt > 0.002) {
      const strength = 14 * dt
      body.angularVelocity.x += axis.x * strength
      body.angularVelocity.y += axis.y * strength
      body.angularVelocity.z += axis.z * strength
    }
    // Bleed off tumble so the car settles rather than spinning through landing.
    const damp = Math.exp(-2.6 * dt)
    body.angularVelocity.x *= damp
    body.angularVelocity.z *= damp
  }

  sync() {
    // cannon clears `isInContact` inside updateWheelTransform, so the contact
    // count has to be read before we touch the wheels.
    this.grounded = this.vehicle.wheelInfos.reduce((n, w) => n + (w.isInContact ? 1 : 0), 0)

    this.mesh.position.copy(this.chassisBody.position)
    this.mesh.quaternion.copy(this.chassisBody.quaternion)
    for (let i = 0; i < this.wheelMeshes.length; i++) {
      this.vehicle.updateWheelTransform(i)
      const t = this.vehicle.wheelInfos[i].worldTransform
      this.wheelMeshes[i].position.copy(t.position)
      this.wheelMeshes[i].quaternion.copy(t.quaternion)
    }
  }

  /**
   * Watches for the two ways a player gets stranded — on the roof, or beached on
   * a prop — and reports which recovery is needed. Returns 'right', 'free', or
   * null. Being upside down recovers on its own; needing a nudge does not,
   * since that would fight a player deliberately pushing something heavy.
   */
  updateRecovery(input, dt) {
    // Anything short of roughly level counts: cars come to rest on their roof,
    // on one side, and nose-up against ramps, and all three strand the player.
    if (this.uprightness < 0.55 && this.speed < 1.5) {
      this.flippedFor += dt
      if (this.flippedFor > 1.3) {
        this.flippedFor = 0
        this.stuckFor = 0
        return 'right'
      }
    } else {
      this.flippedFor = 0
    }

    const trying = Math.abs(input.throttle) > 0.1 && !input.handbrake
    if (trying && this.speed < 0.9) this.stuckFor += dt
    else this.stuckFor = 0
    if (this.stuckFor > 1.8) {
      this.stuckFor = 0
      return 'free'
    }
    return null
  }

  /** Small upward hop that frees the car from whatever it is sitting on. */
  hop() {
    const b = this.chassisBody
    b.wakeUp()
    b.velocity.y = 5.2
    b.angularVelocity.setZero()
  }

  get position() {
    return this.mesh.position
  }

  /** Forward unit vector in world space. */
  forward(target = this._v) {
    return target.set(0, 0, 1).applyQuaternion(this.mesh.quaternion)
  }

  /** How level the car is: 1 is flat, 0 is on its side, -1 is on its roof. */
  get uprightness() {
    return UP.clone().applyQuaternion(this.mesh.quaternion).y
  }

  isFlipped() {
    return this.uprightness < 0.3
  }

  reset(position = this.spawn, heading = this.spawnHeading) {
    const b = this.chassisBody
    b.position.set(position.x, position.y, position.z)
    b.velocity.setZero()
    b.angularVelocity.setZero()
    b.quaternion.setFromEuler(0, heading, 0)
    b.initQuaternion.copy(b.quaternion)
    b.initPosition.copy(b.position)
    b.wakeUp()
    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(0, i)
      this.vehicle.setBrake(0, i)
    }
    this.steering = 0
  }

  /**
   * Set the car back on its wheels where it stands, resting on whatever surface
   * is beneath it — a ramp counts, so righting on a slope doesn't drop the car
   * through the ramp or leave it hovering.
   */
  rightItself() {
    const b = this.chassisBody
    const e = new CANNON.Vec3()
    b.quaternion.toEuler(e)
    b.quaternion.setFromEuler(0, e.y, 0)

    const from = new CANNON.Vec3(b.position.x, b.position.y + 4, b.position.z)
    const to = new CANNON.Vec3(b.position.x, b.position.y - 6, b.position.z)
    const hit = new CANNON.RaycastResult()
    hit.reset()
    // The chassis would otherwise be the first thing the ray finds.
    const wasResponsive = b.collisionResponse
    b.collisionResponse = false
    this.world.rayTest(from, to, hit)
    b.collisionResponse = wasResponsive

    b.position.y = (hit.hasHit ? hit.hitPointWorld.y : 0) + 1.1
    b.velocity.setZero()
    b.angularVelocity.setZero()
    b.wakeUp()
    this.steering = 0
  }
}
