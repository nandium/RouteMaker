import { getNativeModule } from './native-module.js';

type NativeNavigation = {
  push?(path: string): void;
  replace?(path: string): void;
  back?(fallbackPath: string): void;
  openExternal?(url: string, replace: boolean, callback: (success: boolean) => void): void;
};

function bridge() {
  return getNativeModule<NativeNavigation>('RouteMakerNavigation');
}

export const navigation = {
  push(path: string) {
    bridge()?.push?.(path);
  },
  replace(path: string) {
    bridge()?.replace?.(path);
  },
  back(fallbackPath: string) {
    const module = bridge();
    if (!module?.back) return false;
    module.back(fallbackPath);
    return true;
  },
  openExternal(url: string, replace: boolean, callback: (success: boolean) => void) {
    const module = bridge();
    if (!module?.openExternal) return false;
    module.openExternal(url, replace, callback);
    return true;
  },
};
