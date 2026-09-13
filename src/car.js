import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C } from './palette.js'

const UP = new THREE.Vector3(0, 1, 0)

// Air-levelling gains: proportional pull towards level, and damping on the
// tumble rate so the correction settles instead of overshooting.
// Damping does most of the work: it kills a tumble without the overshoot a
// large proportional term causes, which was flipping the car past level.
const LEVEL_P = 5.5
const LEVEL_D = 4.6

// Roll resistance on the ground. Enough to stop a slide tipping the car over,
// gentle enough that a deliberate stunt still looks like one.
const ROLL_P = 12
const ROLL_D = 4.2

// Chassis dimensions (metres). Forward is +Z, right is +X, up is +Y.
const BODY = { w: 1.86, h: 0.54, l: 4.0 }
const WHEEL = { radius: 0.56, width: 0.46 }
const AXLE_Z = 1.38
const AXLE_X = 0.96

/**
 * Gear bands, in metres per second of forward speed. Each gear's range overlaps
 * its neighbours', which is what gives the shift hysteresis — without it the box
 * hunts between two gears at the crossover speed.
 */
const GEARS = [
  { min: 0, max: 5.4 },
  { min: 4.5, max: 9.4 },
  { min: 8.4, max: 14 },
  { min: 12.8, max: 18.6 },
  { min: 17.4, max: 23.2 },
  // Top gear stops just past the car's normal ceiling rather than stretching to
  // the nitro ceiling: spread over the full boost range, the revs sat near idle
  // at maximum speed and the engine sounded asleep. Boosting now pins it against
  // the limiter, which is the right sound for it.
  { min: 22, max: 28.5 },
]
// How long the drive is cut for. Long enough to feel the pause, short enough
// not to cost the player speed.
const UPSHIFT_CUT = 0.17
const DOWNSHIFT_CUT = 0.09

const MAX_STEER = 0.52
const BOOST_SECONDS = 2.6
const BOOST_FORCE = 2.1
const BOOST_TOP = 42
const ENGINE_FORCE = 660
const REVERSE_FORCE = 340
const BRAKE_FORCE = 34
const HANDBRAKE_FORCE = 120
const GRIP = 3.6
const SLIDE_GRIP = 1.05
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

  // Nitrous flames, hidden until the boost fires.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.9, toneMapped: false })
  const flames = []
  for (const fx of [-0.5, 0.5]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.5, 10), flameMat)
    flame.rotation.x = Math.PI / 2
    flame.position.set(fx, -0.02, -BODY.l / 2 - 0.75)
    flame.visible = false
    group.add(flame)
    flames.push(flame)
  }

  // Side mirrors + a racing stripe for a bit of character.
  const mirror = new RoundedBoxGeometry(0.16, 0.1, 0.12, 2, 0.04)
  add(mirror, chrome, -(BODY.w / 2 + 0.04), 0.6, 0.5)
  add(mirror, chrome, BODY.w / 2 + 0.04, 0.6, 0.5)
  add(new THREE.BoxGeometry(0.26, 0.02, BODY.l - 0.5), mat(C.cream), 0, 0.32, 0.1)

  return { group, tailMat, headMat, flames }
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

    const { group, tailMat, headMat, flames } = buildBody(paint)
    this.mesh = group
    this.tailMat = tailMat
    this.headMat = headMat
    this.flames = flames
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
      suspensionRestLength: 0.42,
      frictionSlip: GRIP,
      dampingRelaxation: 2.8,
      dampingCompression: 4.7,
      // Capped well below cannon's default: an uncapped spring can pole-vault
      // the car off its outside wheels during a hard slide.
      maxSuspensionForce: 14000,
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
    this.boost = 0
    this.slip = 0
    this.gear = 0
    this.rev = 0
    this.shiftCut = 0
    // Set to +1 or -1 for the one frame a shift happens, for sound and HUD.
    this.shifted = 0
    this.airTime = 0
    this.stuckFor = 0
    this.stuckAnchor = null
    this.flippedFor = 0
    this._axis = new THREE.Vector3()
    this._right = new THREE.Vector3()
    this._fwd = new THREE.Vector3()
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

    // Nitrous: more drive and a higher ceiling, for a couple of seconds.
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt)
    const boosting = this.boost > 0
    const engineScale = boosting ? BOOST_FORCE : 1

    this._updateGearbox(alongForward, Math.abs(input.throttle), dt)

    const throttle = input.throttle
    let engine = 0
    let brake = IDLE_BRAKE

    if (throttle > 0.01) {
      // Pressing forward while rolling backwards should brake first.
      engine = alongForward < -1 ? 0 : -ENGINE_FORCE * throttle * engineScale
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
    // Locking the rears with full grip makes the car trip over itself and roll.
    // Dropping their friction turns the handbrake into a slide, which is both
    // safer and what a handbrake is for.
    const slip = input.handbrake ? SLIDE_GRIP : GRIP
    this.vehicle.wheelInfos[2].frictionSlip = slip
    this.vehicle.wheelInfos[3].frictionSlip = slip

    // The clutch is out mid-shift, so drive stops for a moment. This is the
    // whole point of modelling gears: the pause is what you feel.
    if (this.shiftCut > 0) engine = 0

    // Rear-wheel drive with a little front assist for grip out of corners.
    this.vehicle.applyEngineForce(engine * 0.35, 0)
    this.vehicle.applyEngineForce(engine * 0.35, 1)
    this.vehicle.applyEngineForce(engine, 2)
    this.vehicle.applyEngineForce(engine, 3)
    if (input.handbrake) {
      // Rear-only, as a handbrake actually is. Locking the front wheels as well
      // pivots the car around its nose and rolls it.
      this.vehicle.setBrake(HANDBRAKE_FORCE * 0.12, 0)
      this.vehicle.setBrake(HANDBRAKE_FORCE * 0.12, 1)
      this.vehicle.setBrake(HANDBRAKE_FORCE, 2)
      this.vehicle.setBrake(HANDBRAKE_FORCE, 3)
    } else {
      for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i)
    }

    // Soft top-speed limiter, lifted while the nitrous burns.
    const max = boosting ? BOOST_TOP : 26
    if (this.speed > max) {
      const s = max / this.speed
      v.x *= s
      v.z *= s
    }

    // How far past grip the tyres are, 0..1 — drives the screech.
    let slipping = 0
    for (const wheel of this.vehicle.wheelInfos) {
      if (wheel.sliding) slipping += 1 - Math.min(1, wheel.skidInfo)
    }
    this.slip = Math.min(1, slipping / 2 + (input.handbrake && this.speed > 6 ? 0.5 : 0))

    this.tailMat.emissiveIntensity = this.braking ? 2.6 : 0.6

    for (const flame of this.flames) {
      flame.visible = boosting
      if (boosting) {
        const flicker = 0.7 + Math.random() * 0.6
        flame.scale.set(flicker, 0.8 + Math.random() * 0.7, flicker)
      }
    }

    // Gentle downforce keeps the car planted over ramps and crests. The force
    // must be applied at the centre of mass: cannon's second argument is a point
    // *relative to* the centre of mass, so passing a world position turns the
    // downforce into a torque with a lever arm the length of the car's distance
    // from the world origin — which flips the car the further out it drives.
    const grounded = this.grounded
    this.airborne = grounded === 0
    if (grounded >= 3 && this.speed > 6) {
      this.chassisBody.applyForce(new CANNON.Vec3(0, -this.speed * 26, 0))
    }

    // A wheel lifting over a kerb is not a jump. Levelling only makes sense once
    // the car is properly airborne; applied on every little bump it pumps spin
    // into the chassis instead of taking it out.
    this.airTime = this.airborne ? this.airTime + dt : 0
    if (this.airTime > 0.1) this._stabilise(dt)
    else if (grounded > 0) this._resistRoll(dt)
  }

  /**
   * Keep the car from tipping onto its side. Only roll — rotation about the
   * car's own forward axis — is corrected; pitch is left alone so ramps, crests
   * and jumps still read honestly.
   */
  _resistRoll(dt) {
    const right = this._right.set(1, 0, 0).applyQuaternion(this.mesh.quaternion)
    const roll = Math.asin(THREE.MathUtils.clamp(right.y, -1, 1))
    if (Math.abs(roll) < 0.22) return

    const fwd = this._fwd.set(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize()
    const w = this.chassisBody.angularVelocity
    const rollRate = w.x * fwd.x + w.y * fwd.y + w.z * fwd.z
    const correct = (-roll * ROLL_P - rollRate * ROLL_D) * dt
    w.x += fwd.x * correct
    w.y += fwd.y * correct
    w.z += fwd.z * correct
  }

  /**
   * Pick a gear from road speed and work out where in its band the revs sit.
   * Speed-banded rather than torque-modelled: the car's handling is arcade, and
   * a real ratio/RPM model would fight the flat drive force everywhere else.
   */
  _updateGearbox(alongForward, effort, dt) {
    this.shifted = 0
    if (this.shiftCut > 0) this.shiftCut = Math.max(0, this.shiftCut - dt)

    // Reverse is its own gear, and it only has the one.
    if (alongForward < -0.5) {
      if (this.gear !== -1) this.gear = -1
      this.rev = THREE.MathUtils.clamp(Math.abs(alongForward) / 7 + effort * 0.15, 0.08, 1)
      return
    }
    if (this.gear < 0) this.gear = 0

    const forward = Math.max(0, alongForward)
    const band = GEARS[this.gear]
    if (this.shiftCut <= 0) {
      if (forward > band.max && this.gear < GEARS.length - 1) {
        this.gear += 1
        this.shiftCut = UPSHIFT_CUT
        this.shifted = 1
      } else if (forward < band.min && this.gear > 0) {
        this.gear -= 1
        this.shiftCut = DOWNSHIFT_CUT
        this.shifted = -1
      }
    }

    const now = GEARS[this.gear]
    const through = (forward - now.min) / (now.max - now.min)
    // Throttle lifts the needle a little even at a standstill, so blipping it
    // while parked does something.
    this.rev = THREE.MathUtils.clamp(through + effort * 0.12, 0.06, 1)
  }

  /** 'R', 'N' or the gear number, for the readout. */
  get gearLabel() {
    if (this.gear < 0) return 'R'
    if (this.speed < 0.4 && this.gear === 0) return 'N'
    return String(this.gear + 1)
  }

  /**
   * Arcade air control: while all four wheels are off the ground, nudge the
   * chassis back towards level. Without it, every jump off the stunt ramps is a
   * coin flip between landing and ending up on the roof.
   */
  _stabilise(dt) {
    const w = this.chassisBody.angularVelocity
    const up = UP.clone().applyQuaternion(this.mesh.quaternion)
    // Rotating the car's up vector back onto the world's. The cross product has
    // no yaw component, so this never fights the heading the player chose.
    const axis = this._axis.crossVectors(up, UP)

    // The cross product's length is sin(tilt), which peaks at 90 degrees and
    // falls back to zero when the car is exactly inverted — an unstable
    // equilibrium that can leave a car stuck on its roof mid-air, getting no
    // correction at all. Rescaling by the true angle keeps the pull growing all
    // the way round.
    const sin = axis.length()
    if (sin > 1e-5) {
      const angle = Math.atan2(sin, up.y)
      axis.multiplyScalar(angle / (Math.PI / 2) / sin)
    }

    // Spring towards level, damped by the current tumble rate. A plain
    // proportional push accumulates: it keeps adding rotation every frame and
    // spins the car far past level instead of settling it.
    w.x += (axis.x * LEVEL_P - w.x * LEVEL_D) * dt
    w.z += (axis.z * LEVEL_P - w.z * LEVEL_D) * dt
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
    if (!trying) {
      this.stuckFor = 0
      this.stuckAnchor = null
      return null
    }

    // Judge by ground actually covered rather than instantaneous speed. Shoving
    // a stack of crates, easing up a ramp or parking are all slow on purpose,
    // and interrupting them reads as the car misbehaving.
    if (!this.stuckAnchor) this.stuckAnchor = this.position.clone()
    if (this.position.distanceTo(this.stuckAnchor) > 1.2) {
      this.stuckAnchor.copy(this.position)
      this.stuckFor = 0
      return null
    }

    this.stuckFor += dt
    if (this.stuckFor > 2.6) {
      this.stuckFor = 0
      this.stuckAnchor = null
      return 'free'
    }
    return null
  }

  /**
   * Lift a beached car just clear of whatever it is resting on. Deliberately a
   * small settle rather than a hop — a visible leap into the air looks like a
   * bug to anyone who didn't realise they were stuck.
   */
  freeUp() {
    const b = this.chassisBody
    b.wakeUp()
    b.position.y += 0.5
    b.velocity.set(b.velocity.x * 0.4, 1.3, b.velocity.z * 0.4)
    b.angularVelocity.setZero()
  }

  get position() {
    return this.mesh.position
  }

  /** Spend a nitrous charge. Re-firing mid-boost refreshes rather than stacks. */
  igniteBoost() {
    this.boost = BOOST_SECONDS
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
