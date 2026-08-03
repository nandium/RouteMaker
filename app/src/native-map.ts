import type { ColorScheme } from './appearance.js';
import type { Gym, MapLocation } from './client-contract.js';
import { nativeMapScene } from './map-config.js';
import { getNativeModule } from './native-module.js';

const LOCATION_WAIT_MS = 1_500;

type NativeMapBridge = {
  open(scene: string, callback: (gymId: string) => void): void;
};

export type NativeMapOpenResult = 'opened' | 'unavailable' | 'cancelled';

/**
 * Let each native shell render the map while ReactLynx continues to own gym
 * data and navigation. Location is loaded here so merely opening the app never
 * requests it, and the bounded wait keeps an unavailable hint from delaying
 * the map indefinitely.
 */
export async function openNativeMap(
  gyms: Gym[],
  theme: ColorScheme,
  loadApproximateLocation: () => Promise<MapLocation | null>,
  shouldOpen: () => boolean,
  chooseGym: (gymId: string) => void
): Promise<NativeMapOpenResult> {
  const bridge = getNativeModule<NativeMapBridge>('RouteMakerMap');
  if (!bridge) return 'unavailable';
  const approximateLocation = await new Promise<MapLocation | null>((resolve) => {
    const timeout = setTimeout(() => resolve(null), LOCATION_WAIT_MS);
    loadApproximateLocation().then(
      (location) => {
        clearTimeout(timeout);
        resolve(location);
      },
      () => {
        clearTimeout(timeout);
        resolve(null);
      }
    );
  });
  if (!shouldOpen()) return 'cancelled';
  bridge.open(JSON.stringify(nativeMapScene(gyms, theme, approximateLocation)), chooseGym);
  return 'opened';
}
