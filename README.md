# Mark Yasser — Interactive 3D Portfolio

**Live: https://markyasser.github.io/portfolio-3d/**

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
| Centre | Start plaza | The name in solid letters, and a banner per direction |
| North | Experience avenue | Prepit, Cairo University, Gameball — one container each, plus their stacks, then the impact cubes |
| East | Skills yard | A container per skill group, fronted by crates you can smash |
| West | Cairo University | Degree, honours, and a graduation cap you can knock off the roof |
| South | Contact | GitHub, LinkedIn and email containers |
| North-east | Stunt park | Ramps, barrels, bowling pins |
| West | Kick-about | A football, a goal, and fireworks when it goes in |

Ten glowing shards line the routes through the experience avenue and the skills
yard; each one reveals a fact about the work. They sit on the way *into* the
zones with the most to read rather than hidden in the empty corners — a player
who just follows the next glow ends up driving the CV end to end.

Everything in the world is solid and everything moves. Containers shunt and
topple, banners fold flat, and trees, rocks, lamps, barrels and crates smash
into pieces when hit hard enough.

## Controls

- **W A S D** or arrow keys to drive, **Space** for the handbrake
- **Scroll**, pinch, or **+** / **&minus;** to zoom the camera out over the map
- **E** or **Enter** opens whatever you are parked next to
- **R** resets the car, **C** cycles the camera (follow / overhead / chase)
- **Shift** burns a nitro charge: roughly double the drive force and a 42 m/s
  ceiling for a couple of seconds, which is what the stunt ramps want
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

There are no gateway arches and no signs painted on the ground. There is exactly
one building — Cairo University's domed hall, because the campus is known by
that silhouette and a lettered box is not it.
Every piece of the CV is carried by a physical object the car can hit: the
titles are stencilled on shipping containers, the zones are marked by banners on
poles, the headline numbers are cubes, and the skills are crates you can smash.

Containers are lettered on their long sides so they read from the road, and
across the roof so they read from the overhead camera — that second face matters,
because a fixed high camera sees anything vertical almost edge-on.

Even the hall is a dynamic body. It carries its centre of mass down near the
ground — cannon treats a body's origin as its centre of mass, so the collision
box is offset upward from it — which gives it the weight distribution of masonry:
a hit shifts it a little and never tips it over.

The only immovable things in the world are the boundary, the stunt ramps and the
goal frame — all of them terrain you play *against* rather than props, and all of
them unusable if they slid away when hit. The
ramps stay fixed because they are terrain you drive *on*; a ramp that slid away
when you hit it would be unusable. Everything else — every container, banner,
crate, barrel, cone, tree, rock and street lamp — has mass and reacts.

Two consequences worth knowing:

- A landmark's reading spot travels with it. Shunt the Prepit container across
  the map and its info panel still opens beside it, because the point of
  interest is attached to the body rather than to a fixed coordinate.
- Smashing a skill group's crates does not lose the information: the full list
  is also printed across its container's roof.

## Logos

Most marks — AWS, Docker, Terraform, React, the country flags — are drawn with
Canvas2D from geometry written by hand in [`src/logos.js`](src/logos.js).
Nothing loads an image file at runtime: the published page's CSP blocks external
images, and keeping the whole site to one JS bundle is why it has no asset
pipeline.

The drawn ones are **stylised originals**, recognisable by shape and colour
rather than facsimiles of anyone's trademark. Each is a function drawing into a
unit square.

Real artwork goes in `IMAGE_MARKS` as a data URI and overrides the drawn mark
everywhere at once. Prepit, Cairo University and the Faculty of Engineering all
use their genuine logos this way; the files live in `src/assets/`, generated by
compositing the source onto a light badge — those crests are drawn for pale
backgrounds and the container plates they land on are near-black. Marks are
preloaded before the world is built, because every texture here is drawn into a
canvas exactly once and an image arriving late would simply be missed.

Adding a technology is two lines: an entry in `ALIASES` mapping its name to a
mark, and one in `BRAND` for its colour. Anything unmapped falls back to a
neutral tile, so a new skill in `data.js` never renders broken.

Marks appear in three places:

- **Crates** — the mark large, one small caption under it, on a crate painted
  that technology's own colour.
- **Container roofs** — a row of marks, which is what the overhead camera
  actually reads. No captions: naming each mark here as well turns the roof into
  a paragraph seen from above.
- **Container sides** — the employer or platform mark beside the name, and at
  most one short line under it.

Copy on the props is deliberately thin. A container identifies itself and
nothing more; the role, the dates, the bullet points and the full skill lists
all live in the panel that opens on **E**.

## The name

The name is not printed on anything — it stands in the plaza as ten solid
letters, one dynamic body each. There is no font file behind them: a 5x7 pixel
font in `props.js` turns each character into blocks, every run of lit pixels in
a row becomes one box, and the lot is merged so a letter costs a single draw
call. The chunky silhouette is the point, since the default camera looks down
on it from the air.

They are the one sign in the world that cannot be destroyed. Heavy and
well-damped, so a bump only rocks them and a real hit shoves one out of line —
but nothing ever breaks them or takes them away.

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

## Revs

There is no gearbox. The car's handling is arcade and its drive force is flat,
so speed-banded ratios only ever added a lurch: the drive cut on every shift and
the engine note sawed up and down while the car itself did nothing different.
The revs now come straight off road speed, measured against the unboosted
ceiling so nitro pins the note against the limiter. The bar beside the speedo
shows the same number the engine is singing.

## Sound

Every sound is synthesised — noise buffers, oscillators and filters — for the
same reason there are no image files. Each material has its own voice, so a
tree, a rock, a lamp post and a shipping container are distinguishable without
looking: shaped noise for the body of the hit, and for metal a set of
inharmonic partials, which is what makes metal sound like metal.

Props carry their voice on the physics body (`body.userData.sfx`), so the
collision handler picks the right one without a lookup table. Anything untagged
falls back to a generic thud.

Sound is **on by default** and the speaker button in the top bar mutes it; the
choice is remembered between visits. Browsers will not let a page make noise
before the visitor has interacted with it, and nothing is clicked to start any
more, so the audio is armed on the first gesture of any kind — a key, a click, a
touch.

One thing to watch in the engine voice: it is a low sawtooth through a lowpass,
and at any real resonance (Q above ~1.5) a static idle tone starts to sound
unnervingly like a human drone. Q is held at 0.7, and the engine is near-silent
when the car is parked.

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
- **GitHub Pages** — already set up. `.github/workflows/deploy.yml` builds and
  publishes on every push to `main`; Pages is configured with GitHub Actions as
  the source. `base: './'` in `vite.config.js` is what makes it work from a
  project sub-path.

  To serve it from the bare `markyasser.github.io` instead, rename the repo:
  `gh repo rename markyasser.github.io`. Nothing in the build needs changing.
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
| `src/audio.js` | Procedural engine, per-material impacts, pickups, fanfares |
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
- **The air-levelling correction has an unstable equilibrium at 180 degrees.**
  It steers on `up x worldUp`, whose length is `sin(tilt)` — which is zero both
  upright *and* exactly inverted, so a car on its roof mid-air gets no
  correction at all. `_stabilise` rescales the axis by the true angle. Raising
  the gains instead makes it worse: the car overshoots level and lands in the
  inverted basin.
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
