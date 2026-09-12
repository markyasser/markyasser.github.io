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
| Centre | Start plaza | Name, summary, headline numbers |
| North | Experience avenue | Prepit, Cairo University, Gameball |
| East | Skills yard | Crates you can smash, one per technology |
| West | Cairo University | Degree and honours |
| South | Contact portals | GitHub, LinkedIn, email, phone |
| North-east | Stunt park | Ramps, barrels, bowling pins |

Ten glowing shards are hidden around the map; each one reveals a fact about the
work.

## Controls

- **W A S D** or arrow keys to drive, **Space** for the handbrake
- **E** or **Enter** opens whatever you are parked next to
- **R** resets the car, **C** cycles the camera
- Gamepad: left stick and triggers
- Touch: on-screen pads appear automatically

Anyone who would rather not play can hit **CV** in the top bar for the whole
résumé as plain, selectable, printable text.

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

## Credits

Inspired by [Bruno Simon's portfolio](https://bruno-simon.com) — the idea that a
portfolio can be somewhere you drive around rather than something you scroll.
