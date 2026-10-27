import { beforeEach, expect, test } from 'vitest';

import { ApiError } from '../../../http.js';
import { profile, resetHost, route, sessionStore, startApp, tapLabel, tapText } from './helpers.js';

const leon = { ...profile, id: 'leon', username: 'leon', display_name: 'Leon', followers: 2 };

beforeEach(() => resetHost({ initialPage: { name: 'profile', username: 'leon' } }));

test('shows the climber and their routes', async () => {
  const { api, queries } = startApp({ profile: () => leon });

  expect(await queries.findByText('Leon', { selector: '.hero-title' })).toBeInTheDocument();
  expect(queries.getByText('@leon')).toBeInTheDocument();
  expect(queries.getByLabelText('2 followers')).toBeInTheDocument();
  expect(queries.getByLabelText('3 following')).toBeInTheDocument();
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(api.to('routes')[0].query.get('author_id')).toBe('leon');
});

test('shows what the climber sets, as a spread across the grade tiers', async () => {
  const graded = (id: string, public_grade: string) => ({ ...route, id, public_grade });
  const { queries } = startApp({
    profile: () => leon,
    routes: () => [
      graded('a', 'V4'),
      graded('b', 'V5'),
      graded('c', 'V4'),
      graded('d', 'V8'),
      graded('e', ''),
    ],
  });

  expect(await queries.findByText('What they set')).toBeInTheDocument();
  expect(queries.getByLabelText('Grade spread: 3 in V4–5, 1 in V8–10')).toBeInTheDocument();
  expect(queries.getByText('Sets mostly V4–5 and V8–10. Based on 5 routes.')).toBeInTheDocument();
});

test('leaves the spread out when no route has a grade', async () => {
  const { queries } = startApp({
    profile: () => leon,
    routes: () => [{ ...route, public_grade: '' }],
  });

  await queries.findByText('Blue Moon');

  expect(queries.queryByText('What they set')).not.toBeInTheDocument();
});

test('follows and unfollows a climber, keeping the count honest', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp({ profile: () => leon });

  await tapText(queries, 'Follow');
  expect(await queries.findByText('Following')).toBeInTheDocument();
  expect(queries.getByLabelText('3 followers')).toBeInTheDocument();
  expect(api.to('follow')).toMatchObject([{ method: 'PUT', param: 'leon', token: 'saved-token' }]);

  await tapLabel(queries, 'Following, tap to unfollow');
  expect(await queries.findByText('Follow')).toBeInTheDocument();
  expect(queries.getByLabelText('2 followers')).toBeInTheDocument();
  expect(api.to('follow').map(({ method }) => method)).toEqual(['PUT', 'DELETE']);
});

test('asks a guest to sign in when they follow', async () => {
  const { api, queries } = startApp({ profile: () => leon });

  await tapText(queries, 'Follow');

  expect(await queries.findByText('Sign in to follow climbers.')).toBeInTheDocument();
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(api.to('follow')).toHaveLength(0);
});

test('does not offer to follow or report yourself', async () => {
  resetHost({ initialPage: { name: 'profile', username: 'maya' } });
  sessionStore('saved-token');
  const { queries } = startApp();

  await queries.findByText('This is you');

  expect(queries.queryByText('Follow')).not.toBeInTheDocument();
  expect(queries.queryByText('Report this climber')).not.toBeInTheDocument();
});

test('invites a climber with no routes to add their first', async () => {
  resetHost({ initialPage: { name: 'profile', username: 'maya' } });
  sessionStore('saved-token');
  const { queries } = startApp({ routes: () => [] });

  expect(await queries.findByText('Add your first route')).toBeInTheDocument();
});

test('tells visitors a climber has published nothing yet', async () => {
  const { queries } = startApp({ profile: () => leon, routes: () => [] });

  expect(
    await queries.findByText(
      'Leon has not published anything. Follow to see their first route in your feed.'
    )
  ).toBeInTheDocument();
});

test('says so when the climber is not found, and offers a way back', async () => {
  const { queries } = startApp({
    profile: () => {
      throw new ApiError('User not found', 404);
    },
  });

  expect(await queries.findByText("That climber isn't here")).toBeInTheDocument();
  expect(queries.getByText('User not found')).toBeInTheDocument();

  await tapText(queries, 'Back');
  expect(await queries.findByText("Pick a gym and see what's on the wall.")).toBeInTheDocument();
});
