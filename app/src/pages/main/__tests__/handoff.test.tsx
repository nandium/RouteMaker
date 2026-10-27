import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import { installHost, resetHost, sessionStore, tapText, startApp } from './helpers.js';

const CODE = 'a'.repeat(64);

beforeEach(() => resetHost());

const browser = () => {
  const openExternal = vi.fn((_url: string, _replace: boolean, done: (ok: boolean) => void) =>
    done(true)
  );
  installHost({ RouteMakerNavigation: { openExternal } });
  return openExternal;
};

test('signs a signed-in climber into the browser tool with a one-time code in the fragment', async () => {
  const openExternal = browser();
  sessionStore('saved-token');
  const { api, queries } = startApp({ handoff: () => ({ code: CODE }) });
  await queries.findByText('maya');

  await tapText(queries, 'Add a route');

  await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
  expect(openExternal).toHaveBeenCalledWith(
    `http://localhost:8788/routes/new#handoff=${CODE}`,
    false,
    expect.any(Function)
  );
  expect(api.to('handoff')).toMatchObject([{ token: 'saved-token' }]);
});

test('never puts the code in the query string', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const openExternal = browser();
  sessionStore('saved-token');
  const { queries } = startApp({ handoff: () => ({ code: CODE }) });
  await queries.findByText('All gyms');

  await tapText(queries, 'Add a route');

  await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
  const url = openExternal.mock.calls[0][0];
  expect(url).toBe(`http://localhost:8788/routes/new?gym=central#handoff=${CODE}`);
  expect(url.split('#')[0]).not.toContain(CODE);
});

test('opens the tool without a code when the hand-off fails', async () => {
  const openExternal = browser();
  sessionStore('saved-token');
  const { queries } = startApp({
    handoff: () => {
      throw new ApiError('offline', 503);
    },
  });
  await queries.findByText('maya');

  await tapText(queries, 'Add a route');

  await vi.waitFor(() =>
    expect(openExternal).toHaveBeenCalledWith(
      'http://localhost:8788/routes/new',
      false,
      expect.any(Function)
    )
  );
});

test('asks for no code when signed out', async () => {
  const openExternal = browser();
  const { api, queries } = startApp();

  await tapText(queries, 'Add a route');

  await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
  expect(api.to('handoff')).toHaveLength(0);
  expect(openExternal.mock.calls[0][0]).not.toContain('#');
});

test('needs no hand-off inside the web host, which already shares the browser session', async () => {
  resetHost({ webHost: true });
  const openExternal = browser();
  vi.stubGlobal('fetch', lynx.fetch);
  sessionStore('saved-token');
  const { api, queries } = startApp();
  await queries.findByText('maya');

  await tapText(queries, 'Add a route');

  await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
  expect(api.to('handoff')).toHaveLength(0);
  expect(openExternal.mock.calls[0][0]).not.toContain('#');
  vi.unstubAllGlobals();
});

test('mints one code however many times the button is tapped', async () => {
  const openExternal = browser();
  let issue: (code: { code: string }) => void = () => {};
  sessionStore('saved-token');
  const { api, queries } = startApp({ handoff: () => new Promise((resolve) => (issue = resolve)) });
  await queries.findByText('maya');

  await tapText(queries, 'Add a route');
  await tapText(queries, 'Add a route');
  expect(await queries.findByText('Working…')).toBeInTheDocument();
  issue({ code: CODE });

  await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
  expect(api.to('handoff')).toHaveLength(1);
  expect(queries.queryByText('Working…')).not.toBeInTheDocument();
});
