import type { ColorScheme } from './appearance.js';
import type { Gym } from './client-contract.js';
import { nativeMapScene } from './map-config.js';
import { getNativeModule } from './native-module.js';

type NativeMapBridge = {
  open(scene: string, callback: (gymId: string) => void): void;
};

/**
 * Let each native shell render the map while ReactLynx continues to own gym
 * data and navigation. Returning false keeps the browser implementation as the
 * only fallback instead of leaking platform checks through the app.
 */
export function openNativeMap(gyms: Gym[], theme: ColorScheme, chooseGym: (gymId: string) => void) {
  const bridge = getNativeModule<NativeMapBridge>('RouteMakerMap');
  if (!bridge) return false;
  bridge.open(JSON.stringify(nativeMapScene(gyms, theme)), chooseGym);
  return true;
}
