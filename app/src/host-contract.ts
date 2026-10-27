/** What the app and its Kotlin, Swift, and web hosts agree on; scripts/check-client-contract.mjs verifies the hosts. */
export type ColorScheme = 'light' | 'dark';
export const isColorScheme = (value: unknown): value is ColorScheme =>
  value === 'light' || value === 'dark';

/** What the appearance control sets: a fixed scheme, or "system" to follow the OS. */
export type ThemePreference = ColorScheme | 'system';
export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || isColorScheme(value);

/** What a host reports back after a share: the system sheet, a link opened, or a copied link. */
export type ShareResult = 'shared' | 'opened' | 'copied' | 'cancelled' | 'unavailable';

const EVERYWHERE = ['android', 'ios', 'web'] as const;

/** NativeModules each host registers: every method, and the platforms that must provide it. */
export const HOST_MODULES = {
  RouteMakerSession: { getToken: EVERYWHERE, setToken: EVERYWHERE, clearToken: EVERYWHERE },
  RouteMakerAppearance: { setPreference: EVERYWHERE },
  RouteMakerNavigation: {
    openExternal: EVERYWHERE,
    setCanGoBack: ['android'],
    push: ['web'],
    replace: ['web'],
    back: ['web'],
  },
  RouteMakerShare: { share: EVERYWHERE },
  RouteMakerMap: { open: ['android', 'ios'] },
} as const;

/**
 * Global props the hosts provide, and the platforms that provide them. A host sends the complete
 * set on every update, because the engine replaces what it stored. `themePreference` is `light`,
 * `dark`, or `system` while the visitor follows the device; `fontScale` is the factor by which
 * the system enlarges text, and `reducedMotion` is the system's wish for less animation.
 */
export const HOST_PROPS = {
  apiBaseUrl: EVERYWHERE,
  systemTheme: EVERYWHERE,
  themePreference: EVERYWHERE,
  fontScale: EVERYWHERE,
  reducedMotion: EVERYWHERE,
  webHost: ['web'],
  wideLayout: ['web'],
  initialPage: ['web'],
} as const;

/** Global events hosts send to the app, and the platforms that send them. */
export const HOST_EVENTS = {
  back: { name: 'routemaker:back', hosts: ['android', 'web'] },
  page: { name: 'routemaker:page', hosts: ['web'] },
} as const;
