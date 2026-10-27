import { beforeEach, expect, test, vi } from 'vitest';

import type { User } from '../../../client-contract.js';
import { ApiError } from '../../../http.js';
import {
  account,
  installHost,
  notice,
  resetHost,
  route,
  sessionStore,
  signIn,
  startApp,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost());

test('a guest who taps Following is asked to sign in, not shown an error', async () => {
  const { queries } = startApp();
  await queries.findByText("Pick a gym and see what's on the wall.");

  await tapText(queries, 'Feed');
  await tapText(queries, 'Following');

  expect(await queries.findByText('Sign in to follow climbers')).toBeInTheDocument();
  expect(notice()).toBeUndefined();
});

test('the gate offers the sign-in screen, or a way back to everyone', async () => {
  resetHost({ initialPage: { name: 'feed', following: true } });
  const { queries } = startApp();
  await queries.findByText('Sign in to follow climbers');

  await tapText(queries, 'Back to Everyone');
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();

  await tapText(queries, 'Following');
  await tapText(queries, 'Sign in');
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
});

test('a failed feed switch leaves the selection and the address in agreement', async () => {
  const history = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  installHost({ RouteMakerNavigation: history });
  let offline = false;
  const { queries } = startApp({
    routes: () => {
      if (offline) throw new ApiError('offline', 503);
      return [route];
    },
  });
  await signIn(queries);
  await queries.findByText('Fresh routes from every gym, newest first.');

  offline = true;
  await tapLabel(queries, 'Following');

  expect(await queries.findByText('offline')).toBeInTheDocument();
  expect(history.push).toHaveBeenLastCalledWith('/feed?view=following');
  expect(queries.getByLabelText('Following')).toHaveAttribute('aria-pressed', 'true');
  expect(queries.getByText('Fresh routes from climbers you follow.')).toBeInTheDocument();
});

test('waits for the saved account to be confirmed, then loads once with its token', async () => {
  resetHost({ initialPage: { name: 'feed', following: false } });
  sessionStore('saved-token');
  let confirm: (user: User) => void = () => {};
  const { api, queries } = startApp({ me: () => new Promise((resolve) => (confirm = resolve)) });

  expect(await queries.findByText('Working…')).toBeInTheDocument();
  expect(api.to('routes')).toHaveLength(0);

  confirm(account);
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();

  expect(api.to('routes').map((request) => request.token)).toEqual(['saved-token']);
  expect(queries.queryByText('Working…')).not.toBeInTheDocument();
});

test('says what to do when nothing has been published', async () => {
  resetHost({ initialPage: { name: 'feed', following: false } });
  const { queries } = startApp({ routes: () => [] });

  expect(await queries.findByText('No routes yet')).toBeInTheDocument();
  expect(queries.getByText('Add a route')).toBeInTheDocument();
});

test('says how to fill an empty Following feed', async () => {
  resetHost({ initialPage: { name: 'feed', following: true } });
  sessionStore('saved-token');
  const { queries } = startApp({ routes: () => [] });

  expect(await queries.findByText('Nothing from climbers you follow yet')).toBeInTheDocument();
  await tapText(queries, 'Browse Everyone');
  expect(
    await queries.findByText('Fresh routes from every gym, newest first.')
  ).toBeInTheDocument();
});

test('names each route’s gym, since the feed spans them all', async () => {
  resetHost({ initialPage: { name: 'feed', following: false } });
  const { queries } = startApp();

  expect(await queries.findByText('Central Bloc · Maya Tan')).toBeInTheDocument();
});
