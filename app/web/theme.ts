import { type ColorScheme, isColorScheme, type ThemePreference } from '../src/host-contract.js';
import { deleteStorage, readStorage, STORAGE_KEYS, writeStorage } from './storage.js';

type Listener = (scheme: ColorScheme) => void;

const schemeListeners = new Set<Listener>();

export const systemScheme = (): ColorScheme =>
  matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** `theme.css` keys its dark tokens on this class, which theme-init.js sets before first paint. */
export const currentScheme = (): ColorScheme =>
  document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';

export function savedTheme(): ColorScheme | null {
  const value = readStorage(STORAGE_KEYS.theme);
  return isColorScheme(value) ? value : null;
}

function show(scheme: ColorScheme) {
  const root = document.documentElement;
  const changed = scheme !== currentScheme();
  root.classList.toggle('theme-dark', scheme === 'dark');
  root.style.colorScheme = scheme;
  if (changed) schemeListeners.forEach((listener) => listener(scheme));
}

/** theme-init.js already applied the saved or OS scheme; this follows OS changes after that. */
export function followSystemTheme() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!savedTheme()) show(systemScheme());
  });
}

/** "system" forgets the saved choice and follows the OS again. */
export function chooseTheme(preference: ThemePreference) {
  // Applies for this page even when storage is blocked.
  if (preference === 'system') deleteStorage(STORAGE_KEYS.theme);
  else writeStorage(STORAGE_KEYS.theme, preference);
  show(preference === 'system' ? systemScheme() : preference);
}

/** Fires when the shown scheme changes, whether chosen or following the OS. */
export function onThemeChange(listener: Listener) {
  schemeListeners.add(listener);
  return () => schemeListeners.delete(listener);
}
