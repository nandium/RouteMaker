export const BRAND_PALETTE = {
  light: { background: '#f3f4ef', primary: '#2e5c78', secondary: '#17201d' },
  dark: { background: '#111714', primary: '#d9e0dd', secondary: '#608ba4' },
} as const;

export const LOGO_MARK_SEGMENTS = [
  { path: 'M14.98 20.76 64.88 72.52 209.61 20.76Z', tone: 'primary' },
  { path: 'M217.28 20.76 338.46 152.71 126.46 54.77Z', tone: 'primary' },
  { path: 'M10 20v142.78l52.21-88.14Z', tone: 'secondary' },
  { path: 'M10 389.11V169.65l80.41 46.97Z', tone: 'primary' },
  { path: 'm338.46 156.7-124 111.9 49.81-146Z', tone: 'secondary' },
  { path: 'M321.79 389.11h-65l-43.66-118.18Z', tone: 'primary' },
  { path: 'M252.46 389.11H11.98l213.99-73.01Z', tone: 'primary' },
] as const;

export function logoMarkPaths(secondary: string) {
  return LOGO_MARK_SEGMENTS.map(
    ({ path, tone }) => `<path${tone === 'secondary' ? ` fill="${secondary}"` : ''} d="${path}"/>`
  ).join('');
}

export function logoMarkSvg(palette: (typeof BRAND_PALETTE)[keyof typeof BRAND_PALETTE]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 348 399" fill="${palette.primary}" aria-hidden="true" focusable="false">${logoMarkPaths(palette.secondary)}</svg>`;
}
