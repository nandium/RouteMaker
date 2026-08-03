import type { ColorScheme } from './appearance.js';

export const ICON_PALETTE: Record<ColorScheme, { base: string; active: string }> = {
  light: { base: '#52605a', active: '#b74425' },
  dark: { base: '#bdc8c2', active: '#ff9873' },
};

export type IconTone = 'base' | 'active' | 'sun' | 'moon';

export function iconColor(scheme: ColorScheme, tone: IconTone) {
  if (tone === 'sun') return ICON_PALETTE[scheme][scheme === 'light' ? 'active' : 'base'];
  if (tone === 'moon') return ICON_PALETTE[scheme][scheme === 'dark' ? 'active' : 'base'];
  return ICON_PALETTE[scheme][tone];
}

const ICON_BODIES = {
  admin:
    '<path d="M12 3 4.8 6v5.4c0 4.6 2.9 8.1 7.2 9.6 4.3-1.5 7.2-5 7.2-9.6V6Z"/><path d="m9.2 12 1.8 1.8 3.8-4"/>',
  any: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  boundaryDelete:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="1" stroke-dasharray="3 2"/><path d="m8.5 8.5 7 7m0-7-7 7"/>',
  detect: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3"/>',
  feed: '<path d="M5 7h14M5 12h10M5 17h7"/>',
  foot: '<ellipse cx="10" cy="15" rx="4" ry="6" transform="rotate(-20 10 15)"/><circle cx="16" cy="5" r="1.4"/><circle cx="12.8" cy="3.8" r="1.2"/><circle cx="9.8" cy="4.2" r="1"/>',
  hand: '<path d="M6 12V8a1.5 1.5 0 0 1 3 0v2-5a1.5 1.5 0 0 1 3 0v5-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2.5 7-6.5 7H10c-2 0-3.5-1-4.5-2.5L3 14a1.8 1.8 0 0 1 3-2Z"/>',
  map: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  moon: '<path d="M20 15.2A8.3 8.3 0 0 1 8.8 4 8.4 8.4 0 1 0 20 15.2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  reset: '<path d="M4 7h16M9 7V4h6v3M18 7l-1 13H7L6 7M10 11v5M14 11v5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sequence: '<path d="M5 6h2v4H5M5 14h2v4H5M11 8h8M11 16h8"/>',
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  tapeFinish: '<path d="M9 5v14M15 5v14"/>',
  tapeStart: '<path d="M5 6v12M9.5 6v12M14.5 6v12M19 6v12"/>',
  undo: '<path d="m9 14-5-5 5-5"/><path d="M4 9h9a7 7 0 0 1 7 7v3"/>',
} as const;

export type IconName = keyof typeof ICON_BODIES;

export function iconSvg(name: IconName, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_BODIES[name]}</svg>`;
}
