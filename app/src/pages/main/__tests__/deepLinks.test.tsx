import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import { gym, installHost, resetHost, sessionStore, startApp, tapText } from './helpers.js';

beforeEach(() => resetHost());

test.each([
  ['a guest on /account', { name: 'account' }, 'Forgot password?'],
  ['a guest on /admin', { name: 'admin' }, 'Forgot password?'],
  [
    'a guest on the following feed',
    { name: 'feed', following: true },
    'Sign in to follow climbers',
  ],
  ['a gym link', { name: 'gym', gymId: 'central' }, '1 Test Street'],
  ['a route link', { name: 'route', routeId: 'blue' }, 'Friendly finish'],
  ['a profile link', { name: 'profile', username: 'maya' }, '@maya'],
])('opens %s directly', async (_name, initialPage, text) => {
  resetHost({ initialPage });
  const { queries } = startApp();

  expect(await queries.findByText(text)).toBeInTheDocument();
});

test('a deep link to a missing gym says so and offers the list', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'missing' } });
  const { queries } = startApp();

  expect(await queries.findByText("That gym isn't here")).toBeInTheDocument();
  expect(queries.queryByText('Add a route')).not.toBeInTheDocument();
  await tapText(queries, 'All gyms');
  expect(await queries.findByText("Pick a gym and see what's on the wall.")).toBeInTheDocument();
});

test('a failed gym list does not hide the routes of a gym, and can be retried', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  let offline = true;
  const { queries } = startApp({
    gyms: () => {
      if (offline) throw new ApiError('offline', 503);
      return [gym];
    },
  });

  expect(await queries.findByText("Couldn't load this gym")).toBeInTheDocument();
  expect(queries.getByText('offline')).toBeInTheDocument();
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(queries.getByText('Add a route')).toBeInTheDocument();

  offline = false;
  await tapText(queries, 'Try again');
  expect(await queries.findByText('1 Test Street')).toBeInTheDocument();
});

test('a failed route list does not hide the gym', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp({
    routes: () => {
      throw new ApiError('offline', 503);
    },
  });

  expect(await queries.findByText('1 Test Street')).toBeInTheDocument();
  expect(await queries.findByText('offline')).toBeInTheDocument();
});

test('a signed-in deep link to the admin page shows the access message for non-admins', async () => {
  resetHost({ initialPage: { name: 'admin' } });
  sessionStore('saved-token');
  const { queries } = startApp();

  expect(await queries.findByText('Administrator access is required.')).toBeInTheDocument();
});

test('a sign-in link sends a signed-in visitor to their account', async () => {
  resetHost({ initialPage: { name: 'login' } });
  sessionStore('saved-token');
  const history = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  installHost({ RouteMakerNavigation: history });
  const { queries } = startApp();

  expect(await queries.findByText('Delete account')).toBeInTheDocument();
  expect(history.replace).toHaveBeenCalledWith('/account');
});
