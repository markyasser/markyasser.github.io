# Mark Yasser — Interactive 3D Portfolio

A driving game that doubles as a résumé. The whole site is one WebGL scene: you
steer a car around a small island and drive up to landmarks to read each part of
the CV.

Built with [three.js](https://threejs.org) for rendering and
[cannon-es](https://pmndrs.github.io/cannon-es/) for physics. No 3D model files,
no textures on disk, no fonts to download — every sign, crate label and road
marking is drawn into a canvas at runtime, so the entire site is one JS bundle.

## The map

| Direction | Zone | Contents |
|---|---|---|
| Centre | Start plaza | The name container, and a banner per direction |
| North | Experience avenue | Prepit, Cairo University, Gameball — one container each, plus their stacks, then the impact cubes |
| East | Skills yard | A container per skill group, fronted by crates you can smash |
| West | Cairo University | Degree, honours, and a graduation cap you can knock off the roof |
| South | Contact | GitHub, LinkedIn and email containers |
| North-east | Stunt park | Ramps, barrels, bowling pins |

Ten glowing shards are hidden around the map; each one reveals a fact about the
work.

Everything in the world is solid and everything moves. Containers shunt and
topple, banners fold flat, and trees, rocks, lamps, barrels and crates smash
into pieces when hit hard enough.

## Controls

- **W A S D** or arrow keys to drive, **Space** for the handbrake
- **Scroll**, pinch, or **+** / **&minus;** to zoom the camera out over the map
- **E** or **Enter** opens whatever you are parked next to
- **R** resets the car, **C** cycles the camera (follow / overhead / chase)
- Gamepad: left stick and triggers
- Touch: on-screen pads appear automatically

Anyone who would rather not play can hit **CV** in the top bar for the whole
résumé as plain, selectable, printable text.

## Look and light

The world is set at blue hour, just before sunrise. That is a lighting rule as
much as a palette: **there is no warm key light anywhere in the scene.** At 5am
the sun is still below the horizon, so everything on the ground is lit by the
sky. This matters more than it sounds — a warm directional light spread across a
blue scene mixes to muddy violet on every surface it touches, which is exactly
what the first attempt looked like. All the warmth here comes from the horizon
band of the sky and from things that genuinely emit light: lit windows, street
lamps, the shards, the car's headlights. A bloom pass makes those read as light
sources rather than as pale paint.

Signage is backlit for the same reason. Skylight alone leaves a panel too dim to
read at this hour, and a lit forecourt board is what you would actually see at
5am anyway.

## Everything is an object

There are no buildings, no gateway arches and no signs painted on the ground.
Every piece of the CV is carried by a physical object the car can hit: the
titles are stencilled on shipping containers, the zones are marked by banners on
poles, the headline numbers are cubes, and the skills are crates you can smash.

Containers are lettered on their long sides so they read from the road, and
across the roof so they read from the overhead camera — that second face matters,
because a fixed high camera sees anything vertical almost edge-on.

The only immovable things in the world are the boundary and the stunt ramps. The
ramps stay fixed because they are terrain you drive *on*; a ramp that slid away
when you hit it would be unusable. Everything else — every container, banner,
crate, barrel, cone, tree, rock and street lamp — has mass and reacts.

Two consequences worth knowing:

- A landmark's reading spot travels with it. Shunt the Prepit container across
  the map and its info panel still opens beside it, because the point of
  interest is attached to the body rather than to a fixed coordinate.
- Smashing a skill group's crates does not lose the information: the full list
  is also printed across its container's roof.

## The camera

The default camera deliberately does **not** sit behind the car. A chase camera
swings round as the car turns, which spins the world around a stationary
vehicle — the third-person-shooter feel. This one holds a fixed angle on the
world and only tracks the car's position, so the map stays still and the car
drives around inside it. That is what makes the scene read as a place rather
than a corridor, and it is the model Bruno Simon's portfolio uses.

Two consequences fall out of that choice, both handled in code:

- The framing leads along the car's velocity rather than its heading, so you
  see where you are going without the view ever rotating.
- Nothing in the world stands tall enough to block the view for long, which is
  part of why the buildings went: with a camera the player cannot swing around
  an obstacle, a five-storey block on the near side of the road is a wall.

Press **C** for an overhead view, or a conventional chase camera if you prefer
it. Scroll or pinch to zoom; the setting is remembered.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve the production build
```

## Deploying

`npm run build` produces a fully static `dist/` folder. It needs no server-side
anything, so it drops onto any static host:

- **Vercel** — `npx vercel --prod` from the project root, or connect the repo and
  accept the detected Vite settings.
- **Netlify** — build command `npm run build`, publish directory `dist`.
- **GitHub Pages** — push `dist/` to a `gh-pages` branch. `base: './'` in
  `vite.config.js` means it already works from a project sub-path.
- **Cloudflare Pages** — build command `npm run build`, output directory `dist`.

`npm run build:artifact` additionally emits `dist/artifact.html` — the same page
reshaped for a host that supplies its own `<html>` wrapper, with the stylesheet
inlined. Only needed for publishing to Claude Artifacts; ignore it otherwise.

## Updating the CV

Everything the world displays comes from [`src/data.js`](src/data.js) — jobs,
bullets, skill groups, stats, contact links, shard facts. Add a skill to a group
and a new crate appears in the yard; add a job and a new building goes up on the
avenue. Nothing else needs touching.

## Source layout

| File | Responsibility |
|---|---|
| `src/main.js` | Bootstrap, render loop, camera, physics stepping |
| `src/data.js` | All résumé content |
| `src/world.js` | Terrain, roads, zones, landmarks, collectibles |
| `src/car.js` | Vehicle physics, body model, recovery behaviour |
| `src/props.js` | Reusable props and physics-body helpers |
| `src/breakables.js` | Instanced scenery, impact handling, the debris pool |
| `src/textures.js` | Canvas-drawn signs, crate faces, the ground map |
| `src/ui.js` | HUD, info panels, plain-text résumé |
| `src/controls.js` | Keyboard, touch and gamepad input |
| `src/minimap.js` | Top-down map |
| `src/audio.js` | Procedural engine, impacts and pickups |
| `src/palette.js` | Shared colour tokens |

## Notes for future changes

A few things are load-bearing and easy to break:

- **Static physics bodies must be given their rotation at construction.** cannon
  caches a body's world AABB and never recomputes it for something that never
  moves, so a rotation assigned afterwards leaves the cached AABB aligned to the
  *unrotated* shape — and raycasts, which is how the car's wheels find the
  ground, then pass straight through it. `props.js` handles this.
- **Crate stacks need gaps.** Tightly packed crates interlock and stop the car
  dead instead of scattering.
- **`updateWheelTransform` clears cannon's `isInContact` flags**, so the car
  reads its grounded state in `sync()` before touching the wheels.
- **`applyForce`'s second argument is a point relative to the centre of mass**,
  not a world position. Passing a world position turns a straight-line force
  into a torque with a lever arm as long as the car's distance from the origin,
  which flips the car the further out it drives.
- **Never remove a body from inside a `collide` handler.** Those fire part-way
  through `world.step()`, and removing a body there corrupts the solver's
  working arrays. `breakables.js` queues breaks and applies them after the step.

## Credits

Inspired by [Bruno Simon's portfolio](https://bruno-simon.com) — the idea that a
portfolio can be somewhere you drive around rather than something you scroll.
