import type { GlobalProps } from '@lynx-js/types';

import type { HOST_MODULES, ShareResult, ThemePreference } from './host-contract.js';

/** What each host registers under NativeModules; names and platforms live in HOST_MODULES. */
type ModuleApis = {
  RouteMakerSession: {
    getToken(callback: (token: string) => void): void;
    setToken(token: string): void;
    clearToken(): void;
  };
  RouteMakerAppearance: { setPreference(preference: ThemePreference): void };
  RouteMakerNavigation: {
    openExternal(url: string, replace: boolean, callback: (success: boolean) => void): void;
    /** Android lets system Back reach JS only while this is true. */
    setCanGoBack?(canGoBack: boolean): void;
    /** Web only: the browser owns history, so native hosts omit these. */
    push?(path: string): void;
    replace?(path: string): void;
    back?(fallbackPath: string): void;
  };
  RouteMakerShare: {
    share(url: string, title: string, callback: (result: ShareResult) => void): void;
  };
  RouteMakerMap: { open(scene: string, callback: (gymId: string) => void): void };
};

function hostModule<K extends keyof typeof HOST_MODULES>(name: K): ModuleApis[K] | undefined {
  'background only';
  // Looked up per call so a host (or test) may install modules after import.
  return typeof NativeModules === 'undefined'
    ? undefined
    : (NativeModules as unknown as Partial<ModuleApis>)[name];
}

// The page re-renders on every host update, so reading these during render is enough.
export const hostProps = (): GlobalProps => lynx.__globalProps;

export const session = {
  load: () =>
    new Promise<string | null>((resolve) => {
      const store = hostModule('RouteMakerSession');
      if (store) store.getToken((token) => resolve(token || null));
      else resolve(null);
    }),
  save: (token: string) => hostModule('RouteMakerSession')?.setToken(token),
  clear: () => hostModule('RouteMakerSession')?.clearToken(),
};

export const appearance = {
  save: (preference: ThemePreference) =>
    hostModule('RouteMakerAppearance')?.setPreference(preference),
};

export const navigation = {
  push: (path: string) => hostModule('RouteMakerNavigation')?.push?.(path),
  replace: (path: string) => hostModule('RouteMakerNavigation')?.replace?.(path),
  /** True when the host handles Back through browser history. */
  back(fallbackPath: string) {
    const host = hostModule('RouteMakerNavigation');
    if (!host?.back) return false;
    host.back(fallbackPath);
    return true;
  },
  setCanGoBack: (canGoBack: boolean) =>
    hostModule('RouteMakerNavigation')?.setCanGoBack?.(canGoBack),
  /** Resolves true once the host has opened the URL. */
  openExternal: (url: string, replace: boolean) =>
    new Promise<boolean>((resolve) => {
      const host = hostModule('RouteMakerNavigation');
      if (host) host.openExternal(url, replace, resolve);
      else resolve(false);
    }),
};

export const share = (url: string, title: string) =>
  new Promise<ShareResult>((resolve) => {
    const host = hostModule('RouteMakerShare');
    if (host) host.share(url, title, resolve);
    else resolve('unavailable');
  });

/** The native map; absent on hosts that only have the browser map. It reports '' when dismissed. */
export const nativeMap = () => hostModule('RouteMakerMap');
