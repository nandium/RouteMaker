import { type ReactNode, createContext, useContext } from '@lynx-js/react';

import type { AuthSession, User } from '../../client-contract.js';
import type { ColorScheme, ThemePreference } from '../../host-contract.js';
import type { Page } from '../../web-pages.js';
import type { NavMode } from './hooks/useRouter.js';

export type Notice = { kind: 'success' | 'error'; text: string; retry?: () => void };

/** What every screen may do besides render itself. */
export type AppContextValue = {
  /** The scheme being shown: the visitor's preference, or else the device's. */
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  setThemePreference(preference: ThemePreference): void;
  wideLayout: boolean;
  /** How much the system enlarges text. */
  fontScale: number;
  reducedMotion: boolean;
  /** The signed-in account, or null for a guest. */
  auth: AuthSession | null;
  signIn(auth: AuthSession): void;
  signOut(): void;
  setUser(user: User): void;
  /** Ends the session when a request made with it came back 401; true if it did. */
  sessionExpired(error: unknown): boolean;
  go(page: Page, mode?: NavMode): void;
  back(): void;
  notify(kind: Notice['kind'], text: string, retry?: () => void): void;
  /** True while `run` has work in flight. */
  working: boolean;
  /**
   * Runs one thing at a time, showing that the app is working; a failure becomes a notice.
   * Resolves with the work's result, or undefined if it failed or another run was in flight.
   */
  run<T = void>(work: () => Promise<T>): Promise<T | undefined>;
  /** Shows a sheet above the whole screen, replacing any other; Back or a tap outside closes it. */
  openSheet(sheet: ReactNode): void;
  closeSheet(): void;
  /** Opens a page of the website in the browser, signed in as this account where possible. */
  openInBrowser(path: string, label: string, options?: { replace?: boolean }): Promise<void>;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp must be used inside <App>');
  return app;
}
