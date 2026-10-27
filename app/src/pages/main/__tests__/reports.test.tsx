import { beforeEach, expect, test } from 'vitest';

import { ApiError } from '../../../http.js';
import {
  enterField,
  note,
  profile,
  reportRoute,
  resetHost,
  route,
  sessionStore,
  startApp as start,
  tapLabel,
  tapText,
} from './helpers.js';

// The signed-in climber wrote the fake route, and nobody reports their own.
const byLeon = { ...route, author: { username: 'leon', display_name: 'Leon' } };
const startApp = (overrides: Parameters<typeof start>[0] = {}) =>
  start({ route: () => byLeon, ...overrides });

beforeEach(() => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  sessionStore('saved-token');
});

test('reports a route with a reason and optional details', async () => {
  const { api, queries } = startApp();
  await queries.findByText('Friendly finish');

  await tapText(queries, 'Report this route');
  expect(await queries.findByLabelText('Reason')).toBeInTheDocument();
  await tapText(queries, 'Send report');
  expect(await queries.findByText('Choose a reason for the report.')).toBeInTheDocument();
  expect(api.to('report')).toHaveLength(0);

  await tapText(queries, 'Inaccurate');
  await enterField(queries, 'Details (optional)', 'Wrong gym');
  await tapText(queries, 'Send report');

  expect(await queries.findByText('Report sent to the moderators.')).toBeInTheDocument();
  expect(api.to('report')[0]).toMatchObject({
    token: 'saved-token',
    body: { target_type: 'route', target_id: 'blue', reason: 'inaccurate', details: 'Wrong gym' },
  });
  expect(queries.getByText('Report this route')).toBeInTheDocument();
  expect(queries.queryByLabelText('Reason')).not.toBeInTheDocument();
});

test('sends no details when none were typed, and can be cancelled', async () => {
  const { api, queries } = startApp();
  await queries.findByText('Friendly finish');

  await tapText(queries, 'Report this route');
  await tapText(queries, 'Cancel');
  expect(queries.getByText('Report this route')).toBeInTheDocument();

  await reportRoute(queries, 'Spam');
  await queries.findByText('Report sent to the moderators.');
  expect(api.to('report')[0].body).toEqual({
    target_type: 'route',
    target_id: 'blue',
    reason: 'spam',
  });
});

test('says so when the route was already reported', async () => {
  const { queries } = startApp({
    report: () => {
      throw new ApiError('You already reported this content', 409);
    },
  });
  await queries.findByText('Friendly finish');

  await reportRoute(queries, 'Spam');

  expect(await queries.findByText('You already reported this content')).toBeInTheDocument();
});

test('reports another climber’s note, but not your own', async () => {
  const { api, queries } = startApp({
    notes: () => [
      note,
      { ...note, id: 'mine', author: { username: 'maya', display_name: 'Maya' } },
    ],
  });
  await queries.findByText('Maya');

  expect(queries.getAllByLabelText('Report note')).toHaveLength(1);
  await tapLabel(queries, 'Report note');
  await tapText(queries, 'Offensive');
  await tapText(queries, 'Send report');

  await queries.findByText('Report sent to the moderators.');
  expect(api.to('report')[0].body).toMatchObject({
    target_type: 'ascent',
    target_id: 'note',
    reason: 'offensive',
  });
});

test('offers guests no way to report', async () => {
  sessionStore('');
  const { queries } = startApp();
  await queries.findByText('Friendly finish');

  expect(queries.queryByText('Report this route')).not.toBeInTheDocument();
  expect(queries.queryByLabelText('Report note')).not.toBeInTheDocument();
});

test('reports a climber', async () => {
  resetHost({ initialPage: { name: 'profile', username: 'leon' } });
  sessionStore('saved-token');
  const leon = { ...profile, id: 'leon', username: 'leon', display_name: 'Leon' };
  const { api, queries } = startApp({ profile: () => leon });

  await tapText(queries, 'Report this climber');
  await tapText(queries, 'Spam');
  await enterField(queries, 'Details (optional)', 'Posts the same link');
  await tapText(queries, 'Send report');

  expect(await queries.findByText('Report sent to the moderators.')).toBeInTheDocument();
  expect(api.to('report')[0].body).toEqual({
    target_type: 'user',
    target_id: 'leon',
    reason: 'spam',
    details: 'Posts the same link',
  });
});
