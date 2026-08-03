import { afterEach, expect, it, vi } from 'vitest';

import type { MapLocation } from '../client-contract.js';
import { nativeMapScene } from '../map-config.js';
import { openNativeMap } from '../native-map.js';

const nativeModules = globalThis.NativeModules;

afterEach(() => {
  vi.useRealTimers();
  globalThis.NativeModules = nativeModules;
});

it('does not request approximate location without a native map', async () => {
  const loadLocation = vi.fn(async () => null);
  globalThis.NativeModules = { ...nativeModules };

  await expect(openNativeMap([], 'light', loadLocation, () => true, vi.fn())).resolves.toBe(
    'unavailable'
  );

  expect(loadLocation).not.toHaveBeenCalled();
});

it('opens the native map with defaults when location stalls', async () => {
  vi.useFakeTimers();
  let scene: Record<string, unknown> | undefined;
  globalThis.NativeModules = {
    ...nativeModules,
    RouteMakerMap: {
      open(value: string) {
        scene = JSON.parse(value) as Record<string, unknown>;
      },
    },
  };

  const opening = openNativeMap(
    [],
    'dark',
    () => new Promise(() => undefined),
    () => true,
    vi.fn()
  );
  await vi.advanceTimersByTimeAsync(1_500);

  await expect(opening).resolves.toBe('opened');
  expect(scene).toMatchObject({
    theme: 'dark',
    centerLatitude: 1.3521,
    centerLongitude: 103.8198,
  });
});

it('does not present a native map after its navigation becomes stale', async () => {
  let resolveLocation: ((location: MapLocation | null) => void) | undefined;
  const open = vi.fn();
  globalThis.NativeModules = {
    ...nativeModules,
    RouteMakerMap: { open },
  };
  let current = true;
  const opening = openNativeMap(
    [],
    'light',
    () =>
      new Promise((resolve) => {
        resolveLocation = resolve;
      }),
    () => current,
    vi.fn()
  );

  current = false;
  resolveLocation?.(null);

  await expect(opening).resolves.toBe('cancelled');
  expect(open).not.toHaveBeenCalled();
});

it('uses the first gym before the country default', () => {
  const scene = nativeMapScene(
    [
      {
        id: 'gym-1',
        name: 'First gym',
        address: '1 Example Street',
        country_code: 'SG',
        latitude: 1.31,
        longitude: 103.86,
        status: 'approved',
      },
      {
        id: 'gym-2',
        name: 'Second gym',
        address: '2 Example Street',
        country_code: 'SG',
        latitude: 1.4,
        longitude: 103.9,
        status: 'approved',
      },
    ],
    'light',
    null
  );

  expect(scene).toMatchObject({
    centerLatitude: 1.31,
    centerLongitude: 103.86,
  });
});
