/**
 * The marking palette. It is deliberately not read from the theme: a published photo is seen in
 * light and dark alike, so its colors must not depend on who drew it. These are the `--m-*`
 * tokens in theme.css.
 */
export const MARK_COLORS = {
  hand: '#3ccbff',
  foot: '#ffd43b',
  any: '#ffffff',
  start: '#2bd97c',
  finish: '#ff3d8b',
  halo: '#0b100e',
  candidate: '#ffffff',
} as const;
