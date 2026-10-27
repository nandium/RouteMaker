import { beforeEach, expect, test, vi } from 'vitest';

import {
  installHost,
  resetHost,
  startApp,
  submitCredentials,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost());

test('signing in from a protected link returns to it', async () => {
  resetHost({ initialPage: { name: 'login', next: '/routes/blue' } });
  const { api, queries } = startApp();
  await queries.findByText('Forgot password?');

  await submitCredentials(queries);

  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
  expect(api.to('route')[0].token).toBe('test-token');
});

test('says where a sign-in will lead', async () => {
  resetHost({ initialPage: { name: 'login', next: '/routes/blue' } });
  const { queries } = startApp();

  expect(
    await queries.findByText('Sign in to continue. You will land right back where you were.')
  ).toBeInTheDocument();
});

test('signing in from a profile link returns to the profile', async () => {
  resetHost({ initialPage: { name: 'login', next: '/users/maya' } });
  const { queries } = startApp();
  await queries.findByText('Forgot password?');

  await submitCredentials(queries);

  expect(await queries.findByText('This is you')).toBeInTheDocument();
});

test('a guest who likes a route comes back to it after signing in', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  const { queries } = startApp();

  await tapLabel(queries, 'Like, 18 likes');
  expect(await queries.findByText('Sign in to like routes.')).toBeInTheDocument();
  await submitCredentials(queries);

  expect(await queries.findByText('Your ascent')).toBeInTheDocument();
});

test('a guest who logs an ascent comes back to the route after signing in', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  const { queries } = startApp();

  await tapText(queries, 'Sign in to log it');
  await submitCredentials(queries);

  expect(await queries.findByText('Your ascent')).toBeInTheDocument();
});

test('a guest who follows a climber comes back to their profile after signing in', async () => {
  resetHost({ initialPage: { name: 'profile', username: 'leon' } });
  const { queries } = startApp();

  await tapText(queries, 'Follow');
  expect(await queries.findByText('Sign in to follow climbers.')).toBeInTheDocument();
  await submitCredentials(queries);

  expect(await queries.findByText('@maya')).toBeInTheDocument();
});

const openingBrowser = () => {
  const openExternal = vi.fn((_url: string, _replace: boolean, done: (ok: boolean) => void) =>
    done(true)
  );
  installHost({ RouteMakerNavigation: { openExternal } });
  return openExternal;
};

test('signing in from a tool link opens the tool in the browser', async () => {
  resetHost({ initialPage: { name: 'login', next: '/gyms/map' } });
  const openExternal = openingBrowser();
  const { queries } = startApp();
  await queries.findByText('Forgot password?');

  await submitCredentials(queries);

  await vi.waitFor(() =>
    expect(openExternal).toHaveBeenCalledWith(
      'http://localhost:8788/gyms/map',
      true,
      expect.any(Function)
    )
  );
});

test('the route editor opens in the gym it was started from, as the link asked', async () => {
  resetHost({ initialPage: { name: 'login', next: '/routes/new?gym=central' } });
  const openExternal = openingBrowser();
  const { queries } = startApp();
  await queries.findByText('Forgot password?');

  await submitCredentials(queries);

  await vi.waitFor(() =>
    expect(openExternal).toHaveBeenCalledWith(
      'http://localhost:8788/routes/new?gym=central',
      true,
      expect.any(Function)
    )
  );
});
