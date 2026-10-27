import { expect, test } from 'vitest';

import type { Page } from '../../../web-pages.js';
import { guard } from '../guard.js';

test('sends a guest from protected pages to sign in, remembering the admin page', () => {
  expect(guard({ name: 'account' }, false)).toEqual({ name: 'login' });
  expect(guard({ name: 'admin' }, false)).toEqual({ name: 'login', next: '/admin' });
});

test('sends a signed-in visitor from the sign-in pages to their account', () => {
  for (const name of ['login', 'signup', 'forgot-password'] as const) {
    expect(guard({ name }, true)).toEqual({ name: 'account' });
  }
});

test('leaves every other page alone, returning the same object', () => {
  const open: [Page, boolean][] = [
    [{ name: 'gyms' }, false],
    [{ name: 'feed', following: true }, false],
    [{ name: 'route', routeId: 'a' }, true],
    [{ name: 'login' }, false],
    [{ name: 'account' }, true],
    [{ name: 'admin' }, true],
  ];
  for (const [page, signedIn] of open) expect(guard(page, signedIn)).toBe(page);
});
