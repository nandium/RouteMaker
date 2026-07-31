import { describe, expect, test } from 'vitest';

import { loginPath, parseWebRoute, WEB_PATHS } from '../web-routes.js';

describe('web routes', () => {
  test('matches canonical pages and encoded resource identifiers', () => {
    expect(parseWebRoute('/')).toEqual({ name: 'gyms' });
    expect(parseWebRoute('/gyms/map')).toEqual({ name: 'gym-map' });
    expect(parseWebRoute('/gyms/central%20bloc')).toEqual({
      name: 'gym',
      gymId: 'central bloc',
    });
    expect(parseWebRoute('/routes/blue%2Fmoon')).toEqual({
      name: 'route',
      routeId: 'blue/moon',
    });
    expect(parseWebRoute('/users/maya')).toEqual({ name: 'profile', username: 'maya' });
  });

  test('keeps view state in a query and rejects old query routes', () => {
    expect(parseWebRoute('/feed', '?view=following')).toEqual({
      name: 'feed',
      following: true,
    });
    expect(parseWebRoute('/', '?tool=map')).toEqual({ name: 'gyms' });
    expect(parseWebRoute('/', '?route=blue')).toEqual({ name: 'gyms' });
  });

  test('accepts only known post-login destinations', () => {
    expect(parseWebRoute('/login', '?next=%2Froutes%2Fnew')).toEqual({
      name: 'login',
      next: WEB_PATHS.newRoute,
    });
    expect(parseWebRoute('/login', '?next=%2Fgyms%2Fmap')).toEqual({
      name: 'login',
      next: WEB_PATHS.gymMap,
    });
    expect(parseWebRoute('/login', '?next=https%3A%2F%2Fevil.example')).toEqual({
      name: 'login',
      next: undefined,
    });
    expect(loginPath(WEB_PATHS.gymMap)).toBe('/login?next=%2Fgyms%2Fmap');
    expect(loginPath(WEB_PATHS.admin)).toBe('/login?next=%2Fadmin');
  });

  test('builds encoded resource paths', () => {
    expect(WEB_PATHS.gym('central bloc')).toBe('/gyms/central%20bloc');
    expect(WEB_PATHS.feed(true)).toBe('/feed?view=following');
    expect(WEB_PATHS.route('blue/moon')).toBe('/routes/blue%2Fmoon');
  });

  test('rejects malformed and unknown paths', () => {
    expect(parseWebRoute('/routes/')).toBeNull();
    expect(parseWebRoute('/routes/a/b')).toBeNull();
    expect(parseWebRoute('/not-a-page')).toBeNull();
    expect(parseWebRoute('/auth/action', '?mode=verifyEmail')).toBeNull();
  });
});
