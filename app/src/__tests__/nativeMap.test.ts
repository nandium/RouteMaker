import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test, vi } from 'vitest';

import type { Gym } from '../client-contract.js';
import { LOCATION_WAIT_MS, approximateLocation, nativeMapScene } from '../native-map.js';

afterEach(() => vi.useRealTimers());

const place: Gym = {
  id: 'gym-1',
  name: 'First gym',
  address: '1 Example Street',
  country_code: 'SG',
  latitude: 1.31,
  longitude: 103.86,
  status: 'approved',
};

test('uses the location when it arrives in time', async () => {
  await expect(approximateLocation(async () => ({ latitude: 1, longitude: 2 }))).resolves.toEqual({
    latitude: 1,
    longitude: 2,
  });
});

test('gives up on a location that stalls', async () => {
  vi.useFakeTimers();
  const waiting = approximateLocation(() => new Promise(() => undefined));

  await vi.advanceTimersByTimeAsync(LOCATION_WAIT_MS);

  await expect(waiting).resolves.toBeNull();
});

test('gives up on a location that fails', async () => {
  await expect(approximateLocation(() => Promise.reject(new Error('offline')))).resolves.toBeNull();
});

test('centres on the location, then the first gym, then the default view', () => {
  const second = { ...place, id: 'gym-2', latitude: 1.4, longitude: 103.9 };

  expect(
    nativeMapScene([place, second], 'light', { latitude: 51.5, longitude: -0.1 })
  ).toMatchObject({
    centerLatitude: 51.5,
    centerLongitude: -0.1,
  });
  expect(nativeMapScene([place, second], 'light', null)).toMatchObject({
    centerLatitude: 1.31,
    centerLongitude: 103.86,
  });
  expect(nativeMapScene([], 'dark', null)).toMatchObject({
    theme: 'dark',
    centerLatitude: 1.3521,
    centerLongitude: 103.8198,
  });
});

test('sends the map only what it draws', () => {
  const [sent] = nativeMapScene([place], 'light', null).gyms;

  expect(Object.keys(sent).sort()).toEqual(['address', 'id', 'latitude', 'longitude', 'name']);
});

// The Android unit test MapSceneTest parses this same file, so the scene the app sends and the
// scene the native map reads cannot drift apart unnoticed.
test('builds the scene in fixtures/map-scene.json', () => {
  const gyms: Gym[] = [
    {
      ...place,
      id: 'gym-1',
      name: 'Gravity Yard',
      address: '12 Kallang Way, Singapore',
      latitude: 1.3093,
      longitude: 103.8717,
    },
    {
      ...place,
      id: 'gym-2',
      name: 'Boulder Hut',
      address: '',
      latitude: 51.5072,
      longitude: -0.1276,
    },
  ];
  const fixture = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/map-scene.json'),
    'utf8'
  );

  const sent = JSON.parse(
    JSON.stringify(nativeMapScene(gyms, 'dark', { latitude: 1.3, longitude: 103.8 }))
  );

  expect(sent).toEqual(JSON.parse(fixture));
});
