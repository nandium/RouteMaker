import { describe, expect, test } from 'vitest';

import { loginDestination, loginPath, parseWebPage } from '../web-pages.js';

describe('sign-in destinations with a query', () => {
  test('the query stays out of the page, so it cannot become part of an id', () => {
    expect(loginDestination('/routes/new?gym=g1')).toEqual({ name: 'new-route' });
    expect(loginDestination('/routes/blue?x=1')).toEqual({ name: 'route', routeId: 'blue' });
  });

  test('a query does not turn a disallowed page into an allowed one', () => {
    expect(loginDestination('/account?next=/admin')).toEqual({ name: 'feed', following: false });
    expect(loginDestination('/feed?view=following')).toEqual({ name: 'feed', following: false });
  });

  test('sign-in addresses carry the query along', () => {
    const path = loginPath('/routes/new?gym=g1');

    expect(path).toBe('/login?next=%2Froutes%2Fnew%3Fgym%3Dg1');
    expect(parseWebPage('/login', path.slice(path.indexOf('?')))).toEqual({
      name: 'login',
      next: '/routes/new?gym=g1',
    });
  });
});
