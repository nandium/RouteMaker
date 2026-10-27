import { describe, expect, test, vi } from 'vitest';

import {
  type Page,
  loginDestination,
  isAuthPage,
  loginPath,
  parseWebPage,
  pathOf,
  WEB_PATHS,
} from '../web-pages.js';

describe('web routes', () => {
  test('matches canonical pages and encoded resource identifiers', () => {
    expect(parseWebPage('/')).toEqual({ name: 'gyms' });
    expect(parseWebPage('/gyms/map')).toEqual({ name: 'gym-map' });
    expect(parseWebPage('/gyms/central%20bloc')).toEqual({
      name: 'gym',
      gymId: 'central bloc',
    });
    expect(parseWebPage('/routes/blue%2Fmoon')).toEqual({
      name: 'route',
      routeId: 'blue/moon',
    });
    expect(parseWebPage('/users/maya')).toEqual({ name: 'profile', username: 'maya' });
  });

  test('keeps view state in a query and ignores a query on the root', () => {
    expect(parseWebPage('/feed', '?view=following')).toEqual({
      name: 'feed',
      following: true,
    });
    expect(parseWebPage('/', '?view=following')).toEqual({ name: 'gyms' });
    expect(parseWebPage('/', '?id=a1')).toEqual({ name: 'gyms' });
  });

  test('accepts only known post-login destinations', () => {
    expect(parseWebPage('/login', '?next=%2Froutes%2Fnew')).toEqual({
      name: 'login',
      next: WEB_PATHS.newRoute,
    });
    expect(parseWebPage('/login', '?next=%2Fgyms%2Fmap')).toEqual({
      name: 'login',
      next: WEB_PATHS.gymMap,
    });
    expect(parseWebPage('/login', '?next=%2Froutes%2Fblue')).toEqual({
      name: 'login',
      next: WEB_PATHS.route('blue'),
    });
    expect(parseWebPage('/login', '?next=https%3A%2F%2Fevil.example')).toEqual({
      name: 'login',
      next: undefined,
    });
    expect(loginPath(WEB_PATHS.gymMap)).toBe('/login?next=%2Fgyms%2Fmap');
    expect(loginPath(WEB_PATHS.admin)).toBe('/login?next=%2Fadmin');
    expect(loginPath(WEB_PATHS.route('blue'))).toBe('/login?next=%2Froutes%2Fblue');
  });

  test('builds encoded resource paths', () => {
    expect(WEB_PATHS.gym('central bloc')).toBe('/gyms/central%20bloc');
    expect(WEB_PATHS.feed(true)).toBe('/feed?view=following');
    expect(WEB_PATHS.route('blue/moon')).toBe('/routes/blue%2Fmoon');
  });

  test('rejects malformed and unknown paths', () => {
    expect(parseWebPage('/routes/')).toBeNull();
    expect(parseWebPage('/routes/a/b')).toBeNull();
    expect(parseWebPage('/not-a-page')).toBeNull();
    expect(parseWebPage('/auth/action', '?mode=verifyEmail')).toBeNull();
  });

  test('turns every page back into the URL it was parsed from', () => {
    const pages: Page[] = [
      { name: 'gyms' },
      { name: 'gym', gymId: 'central bloc' },
      { name: 'feed', following: false },
      { name: 'feed', following: true },
      { name: 'route', routeId: 'blue/moon' },
      { name: 'profile', username: 'maya' },
      { name: 'login', next: WEB_PATHS.admin },
      { name: 'signup' },
      { name: 'forgot-password' },
      { name: 'account' },
      { name: 'admin' },
    ];
    for (const page of pages) {
      const [pathname, search = ''] = pathOf(page).split('?');
      expect(parseWebPage(pathname, search)).toEqual(page);
    }
  });

  test('parses a path without building URLSearchParams', () => {
    vi.stubGlobal('URLSearchParams', undefined);
    try {
      expect(parseWebPage('/routes/blue')).toEqual({ name: 'route', routeId: 'blue' });
      expect(loginPath('/routes/blue')).toBe('/login?next=%2Froutes%2Fblue');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('resumes at an allowed destination after signing in, else at the feed', () => {
    const feed = { name: 'feed', following: false };
    expect(loginDestination(WEB_PATHS.route('blue'))).toEqual({ name: 'route', routeId: 'blue' });
    expect(loginDestination(WEB_PATHS.admin)).toEqual({ name: 'admin' });
    expect(loginDestination(WEB_PATHS.gymMap)).toEqual({ name: 'gym-map' });
    expect(loginDestination(WEB_PATHS.newRoute)).toEqual({ name: 'new-route' });
    expect(loginDestination(WEB_PATHS.account)).toEqual(feed);
    expect(loginDestination('https://evil.example')).toEqual(feed);
    expect(loginDestination()).toEqual(feed);
  });

  test('lets a profile follow a sign-in, as a route does', () => {
    expect(parseWebPage('/login', '?next=%2Fusers%2Fmaya')).toEqual({
      name: 'login',
      next: WEB_PATHS.profile('maya'),
    });
    expect(loginDestination(WEB_PATHS.profile('maya'))).toEqual({
      name: 'profile',
      username: 'maya',
    });
    expect(loginPath(WEB_PATHS.profile('maya'))).toBe('/login?next=%2Fusers%2Fmaya');
  });

  test('knows which pages share the sign-in form', () => {
    expect(
      ['login', 'signup', 'forgot-password'].map((name) => isAuthPage({ name } as Page))
    ).toEqual([true, true, true]);
    expect(isAuthPage({ name: 'account' })).toBe(false);
  });
});
