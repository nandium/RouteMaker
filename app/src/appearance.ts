import { getNativeModule } from './native-module.js';

const COLOR_SCHEMES = ['light', 'dark'] as const;
export const THEME_CHANGE_EVENT = 'routemaker:themechange';

export type ColorScheme = (typeof COLOR_SCHEMES)[number];
export type ThemePreference = ColorScheme;

type NativeAppearanceStore = {
  setPreference(preference: ThemePreference): void;
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && COLOR_SCHEMES.includes(value as ThemePreference);
}

export function resolveColorScheme(
  preference: ThemePreference | null,
  systemScheme: ColorScheme
): ColorScheme {
  return preference ?? systemScheme;
}

export const appearanceStore = {
  save(preference: ThemePreference) {
    getNativeModule<NativeAppearanceStore>('RouteMakerAppearance')?.setPreference(preference);
  },
};
