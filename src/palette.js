// Single source of truth for colour.
//
// The world is set just before sunrise: a deep blue dome overhead, the first
// warm light lying along the horizon, and everything on the ground still cool
// and low-contrast. Warm tones are rationed — they belong to the sun, the lit
// windows and the street lamps, which is what makes those read as light sources
// rather than as paint.
export const C = {
  skyTop: 0x0d1a38,
  skyMid: 0x2b4a80,
  skyHorizon: 0xf0a068,
  fog: 0x40699c,

  // Ground: cool and desaturated, so lit things carry the image.
  grass: 0x24485c,
  grassDark: 0x1c3a4b,
  sand: 0x53697e,
  road: 0x4a6378,
  roadEdge: 0x6d8a9e,

  navy: 0x0e1a30,
  navyLight: 0x1c2d4d,
  cream: 0xe4ecfa,
  white: 0xeef4ff,

  // Accents, pulled cool enough to sit in pre-dawn light.
  coral: 0xef7360,
  amber: 0xf2ac63,
  teal: 0x37bfb6,
  violet: 0x8a7cf5,
  blue: 0x4f9ce8,

  // Building walls sit mid-value so lit windows read as light, not as paint.
  wall: 0x8095b5,
  wallDark: 0x62779a,

  // Emissive sources. These are the only genuinely warm things in the scene.
  lampGlow: 0xffd79a,
  windowGlow: 0xffca7d,
  sunLight: 0xffbe86,
}

export const CSS = {
  navy: '#0e1a30',
  cream: '#dde6f6',
  coral: '#ef7360',
  amber: '#f2ac63',
  teal: '#37bfb6',
  white: '#ffffff',
  ink: '#0b1426',
  muted: '#7d8db0',
}

export const hex = (n) => '#' + n.toString(16).padStart(6, '0')
