import type { ColorScheme } from './host-contract.js';

/** `d` paths are stroked, `f` paths filled; `dash` makes the stroke dashed. */
type Glyph = { d?: string; f?: string; dash?: string };

/** Icons on a 24px grid with a 2px stroke, miter joins and butt caps: angular, like the shards. */
const ICONS = {
  gyms: { d: 'M12 21.5 5 11V4.5L12 2l7 2.5V11Z M12 10.8a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z' },
  feed: { d: 'M4 6h16 M4 12h16 M4 18h10' },
  admin: { d: 'M12 2.5 4.5 5.5v6c0 4.5 3 8 7.5 10 4.5-2 7.5-5.5 7.5-10v-6Z M8.5 12l2.5 2.5 5-5' },
  user: {
    d: 'M12 11.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5',
  },
  back: { d: 'M20 12H5 M11 5l-7 7 7 7' },
  'chevron-right': { d: 'M9 4l8 8-8 8' },
  'chevron-down': { d: 'M4 9l8 8 8-8' },
  close: { d: 'M5 5l14 14 M19 5 5 19' },
  check: { d: 'M4 12.5l5 5L20 6.5' },
  plus: { d: 'M12 4v16 M4 12h16' },
  beta: { d: 'M3.5 4.5h17v12h-9l-5 4v-4h-3Z M7.5 9h9 M7.5 12.5h5' },
  share: { d: 'M12 15V3 M7 8l5-5 5 5 M5 12v9h14v-9' },
  flag: { d: 'M5 21V3 M5 4h13l-3 4.5 3 4.5H5' },
  search: { d: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M15.5 15.5 21 21' },
  sun: {
    d: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1 7 17 M17 7l2.1-2.1',
  },
  auto: {
    d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 3v18',
    f: 'M12 3a9 9 0 0 0 0 18Z',
  },
  moon: { d: 'M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z' },
  eye: {
    d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  },
  'eye-off': {
    d: 'M2 12s3.6-7 10-7c2 0 3.7.7 5.1 1.6 M22 12s-3.6 7-10 7c-2 0-3.7-.7-5.1-1.6 M4 4l16 16',
  },
  alert: { d: 'M12 3 2.5 20h19Z M12 9.5v5', f: 'M11 16.6h2v2h-2Z' },
  info: { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5.5', f: 'M11 7h2v2h-2Z' },
  'check-circle': { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M7.8 12.4l3 3 5.6-6' },
  map: { d: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z M9 4v14 M15 6v14' },
  photo: { d: 'M3 5h18v14H3Z M3 16l5-5 4 4 3-3 6 6', f: 'M15.5 8.2a1.6 1.6 0 1 0 0 .1Z' },
  upload: { d: 'M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4' },
  undo: { d: 'M4 8h10a6 6 0 0 1 0 12H9 M8 4 4 8l4 4' },
  redo: { d: 'M20 8H10a6 6 0 0 0 0 12h5 M16 4l4 4-4 4' },
  trash: { d: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6' },
  reset: { d: 'M4 12a8 8 0 1 0 2.5-5.8 M4 4v5h5' },
  detect: { d: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5 M12 8.5l3.5 3.5-3.5 3.5L8.5 12Z' },
  hash: { d: 'M9.5 3 7.5 21 M16.5 3l-2 18 M4 8.5h17 M3 15.5h17' },
  logout: { d: 'M9 21H4V3h5 M16 8l5 4-5 4 M21 12H9' },
  external: { d: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6' },
  ban: { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M5.6 5.6l12.8 12.8' },
  // hold-use glyphs (tool buttons): circle = hand, triangle = foot, diamond = any limb
  'use-hand': { d: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z' },
  'use-foot': { d: 'M12 3.5 21.5 20h-19Z' },
  'use-any': { d: 'M12 2.5 21.5 12 12 21.5 2.5 12Z' },
  'tape-start': { d: 'M3 17 21 13 M3 11 21 7 M3 20l18-4' },
  'tape-finish': { d: 'M4 18 18 6 M9 19l10-9 M3 13l10-9' },
  locate: {
    d: 'M12 17.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z M12 2v3 M12 19v3 M2 12h3 M19 12h3',
  },
  lock: { d: 'M5 11h14v10H5Z M8 11V7a4 4 0 0 1 8 0v4' },
  refresh: { d: 'M20 12a8 8 0 1 1-2.5-5.8 M20 4v5h-5' },
  like: { d: 'M12 21 3 11.5V7l4-3 5 3.5L17 4l4 3v4.5Z' },
  'like-on': { f: 'M12 21.5 2.5 11.5V6.8L7 3.5l5 3.6 5-3.6 4.5 3.3v4.7Z' },
  proj: { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', dash: '3.2 3.2' },
  sort: { d: 'M7 4v16 M3 16l4 4 4-4 M17 20V4 M13 8l4-4 4 4' },
  link: {
    d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  },
  edit: { d: 'M4 20h4L19 9l-4-4L4 16Z M13 7l4 4' },
  wall: { d: 'M3 3h18v18H3Z M3 9h18 M3 15h18 M9 3v6 M15 9v6 M9 15v6' },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof ICONS;

/** `size` is only the svg's intrinsic size; the stroke thins slightly at small sizes. */
export function iconSvg(name: IconName, color: string, size = 24) {
  const { d, f, dash }: Glyph = ICONS[name];
  const strokeWidth = size <= 18 ? 2.2 : 2;
  const stroke = d
    ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="miter" stroke-miterlimit="4"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
    : '';
  const fill = f ? `<path d="${f}" fill="${color}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${stroke}${fill}</svg>`;
}

/**
 * Lynx svg content cannot read CSS variables or currentColor, so icon colors are written out per
 * scheme. They mirror the --c-* tokens in theme.css (a test keeps them in step).
 */
export const ICON_COLORS = {
  light: {
    ink: '#17201d',
    'ink-2': '#45514b',
    'ink-3': '#586560',
    link: '#2e5c78',
    bg: '#f3f4ef',
    danger: '#b3261e',
    success: '#1b6a42',
    'on-action': '#f3f4ef',
    'on-danger': '#ffffff',
    'on-wall': '#f3f4ef',
    'wall-3': '#1f4258',
    'on-nav': '#f3f4ef',
    'on-nav-2': '#a9b7b0',
  },
  dark: {
    ink: '#d9e0dd',
    'ink-2': '#aab6b1',
    'ink-3': '#92a09a',
    link: '#86b3cd',
    bg: '#111714',
    danger: '#ff9486',
    success: '#7ad8a5',
    'on-action': '#111714',
    'on-danger': '#1d0f0c',
    'on-wall': '#d9e0dd',
    'wall-3': '#142b39',
    'on-nav': '#d9e0dd',
    'on-nav-2': '#9aa8a2',
  },
} as const satisfies Record<ColorScheme, Record<string, string>>;

/** A theme color an icon may use, named like its --c-* token without the prefix. */
export type IconTone = keyof (typeof ICON_COLORS)['light'];

export const iconColor = (scheme: ColorScheme, tone: IconTone) => ICON_COLORS[scheme][tone];
