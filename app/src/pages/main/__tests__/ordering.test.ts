import { expect, test } from 'vitest';

import { approximateDistance, arrangeRoutes, nearestFirst } from '../ordering.js';
import { gym, route } from './fakeApi.js';

const make = (id: string, overrides: Partial<typeof route>) => ({ ...route, id, ...overrides });
const ids = (routes: (typeof route)[]) => routes.map(({ id }) => id);

test('keeps every route, graded or not, while no tier is chosen', () => {
  const routes = [make('a', { public_grade: 'V3' }), make('b', { public_grade: '' })];

  expect(ids(arrangeRoutes(routes, [], 'newest'))).toEqual(['a', 'b']);
});

test('narrows to the chosen tiers by grade, not by text order', () => {
  const routes = [
    make('v10', { public_grade: 'V10' }),
    make('v2', { public_grade: 'V2' }),
    make('v3', { public_grade: 'V3' }),
    make('v8', { public_grade: 'V8' }),
    make('none', { public_grade: '' }),
  ];

  expect(ids(arrangeRoutes(routes, [2], 'newest'))).toEqual(['v2', 'v3']);
  expect(ids(arrangeRoutes(routes, [2, 5], 'newest'))).toEqual(['v10', 'v2', 'v3', 'v8']);
});

test('orders by the chosen measure and breaks ties with the newer route', () => {
  const routes = [
    make('old-popular', { likes: 5, created_at: 1 }),
    make('new-popular', { likes: 5, created_at: 9 }),
    make('quiet', { likes: 1, created_at: 20 }),
  ];

  expect(ids(arrangeRoutes(routes, [], 'likes'))).toEqual(['new-popular', 'old-popular', 'quiet']);
  expect(ids(arrangeRoutes(routes, [], 'newest'))).toEqual(['quiet', 'new-popular', 'old-popular']);
});

test('does not reorder the list it was given', () => {
  const routes = [make('a', { sends: 1 }), make('b', { sends: 9 })];

  arrangeRoutes(routes, [], 'sends');

  expect(ids(routes)).toEqual(['a', 'b']);
});

test('puts the nearest gym first, and leaves the order alone without a location', () => {
  const gyms = [
    { ...gym, id: 'far', latitude: 40, longitude: -74 },
    { ...gym, id: 'near', latitude: 1.35, longitude: 103.82 },
  ];

  expect(nearestFirst(gyms, { latitude: 1.3521, longitude: 103.8198 }).map(({ id }) => id)).toEqual(
    ['near', 'far']
  );
  expect(nearestFirst(gyms, null)).toBe(gyms);
});

test('measures distance across the date line', () => {
  const gyms = [
    { ...gym, id: 'london', latitude: 51.5, longitude: -0.1 },
    { ...gym, id: 'fiji', latitude: -17.7, longitude: 178.4 },
  ];

  expect(nearestFirst(gyms, { latitude: -16.8, longitude: -179.9 })[0].id).toBe('fiji');
});

test('says how far a gym is, coarsely', () => {
  const near = { ...gym, latitude: 1.3, longitude: 103.8 };
  const here = { latitude: 1.3, longitude: 103.805 };

  expect(approximateDistance(here, near)).toBe('~1 km');
  expect(approximateDistance({ latitude: 1.3, longitude: 103.9 }, near)).toBe('~11 km');
  expect(approximateDistance({ latitude: 51.5, longitude: -0.1 }, near)).toMatch(/^~\d+0 km$/);
});
