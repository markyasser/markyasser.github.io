// Single source of truth for colour. Everything in the world pulls from here so
// the scene reads as one coherent illustration rather than a pile of props.
export const C = {
  skyTop: 0x2f6fc4,
  skyBottom: 0xe6f2f7,
  fog: 0xdcecf3,

  grass: 0x9cc389,
  grassDark: 0x86b075,
  sand: 0xe6d7b2,
  road: 0xd9c9a3,
  roadEdge: 0xf2eadb,

  navy: 0x22304a,
  navyLight: 0x33456a,
  cream: 0xf7f3e8,
  white: 0xfdfcf8,

  coral: 0xef6f5c,
  amber: 0xf5b942,
  teal: 0x2fb3a3,
  violet: 0x7a6cf0,
  blue: 0x3f8ede,
}

export const CSS = {
  navy: '#22304a',
  cream: '#f7f3e8',
  coral: '#ef6f5c',
  amber: '#f5b942',
  teal: '#2fb3a3',
  white: '#ffffff',
  ink: '#16202f',
  muted: '#6b7a90',
}

export const hex = (n) => '#' + n.toString(16).padStart(6, '0')
