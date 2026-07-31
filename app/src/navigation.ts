import { getNativeModule } from './native-module.js';

type NativeNavigation = {
  push(path: string): void;
  replace(path: string): void;
  back(fallbackPath: string): void;
};

function bridge() {
  return getNativeModule<NativeNavigation>('RouteMakerNavigation');
}

export const navigation = {
  push(path: string) {
    bridge()?.push(path);
  },
  replace(path: string) {
    bridge()?.replace(path);
  },
  back(fallbackPath: string) {
    const module = bridge();
    if (!module) return false;
    module.back(fallbackPath);
    return true;
  },
};
