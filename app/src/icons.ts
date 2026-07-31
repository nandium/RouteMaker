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
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  feed: '<path d="M5 7h14M5 12h10M5 17h7"/>',
  map: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  moon: '<path d="M20 15.2A8.3 8.3 0 0 1 8.8 4 8.4 8.4 0 1 0 20 15.2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
} as const;

export type IconName = keyof typeof ICON_BODIES;

export function iconSvg(name: IconName, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_BODIES[name]}</svg>`;
}
