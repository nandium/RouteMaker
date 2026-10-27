import { fireEvent } from '@lynx-js/react/testing-library';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  installHost,
  notice,
  reportRoute,
  resetHost,
  route,
  settle,
  sessionStore,
  signIn,
  startApp,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost());

const withHistory = () => {
  const history = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  installHost({ RouteMakerNavigation: history });
  return history;
};

const alpha = { ...route, id: 'a', name: 'Alpha' };
const beta = {
  ...route,
  id: 'b',
  name: 'Beta',
  author: { username: 'leon', display_name: 'Leon' },
};
const byId = ({ param }: { param: string }) =>
  [alpha, beta].find((candidate) => candidate.id === param)!;

test('records each step in browser history', async () => {
  const history = withHistory();
  const { queries } = startApp();

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');
  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();

  expect(history.push).toHaveBeenCalledWith('/gyms/central');
  expect(history.push).toHaveBeenCalledWith('/routes/blue');
});

test('defers Back to browser history when the host owns it', async () => {
  const history = withHistory();
  const { queries } = startApp();

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');
  await tapLabel(queries, 'Back');

  expect(history.back).toHaveBeenCalledWith('/gyms/central');
});

test('Back retraces the visited screens when the host has no history', async () => {
  const { queries } = startApp({ routes: () => [alpha, beta], route: byId });

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Alpha');
  fireEvent.tap(await queries.findByLabelText('By Maya Tan, open profile'));
  await queries.findByText('@maya');
  await tapText(queries, 'Beta');
  expect(await queries.findByLabelText('By Leon, open profile')).toBeInTheDocument();

  await tapLabel(queries, 'Back');
  expect(await queries.findByText('@maya')).toBeInTheDocument();
  await tapLabel(queries, 'Back');
  expect(await queries.findByLabelText('By Maya Tan, open profile')).toBeInTheDocument();
  await tapLabel(queries, 'Back');
  expect(await queries.findByText('Beta')).toBeInTheDocument();
  expect(queries.getByText('1 Test Street')).toBeInTheDocument();
});

test('Back from the only page goes home', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  const { queries } = startApp();
  await queries.findByText('Friendly finish');

  await tapLabel(queries, 'Back');

  expect(await queries.findByText("Pick a gym and see what's on the wall.")).toBeInTheDocument();
});

test('Android system Back pops the stack only while there is something to pop', async () => {
  const setCanGoBack = vi.fn();
  installHost({ RouteMakerNavigation: { setCanGoBack } });
  const { queries } = startApp();
  expect(setCanGoBack).toHaveBeenLastCalledWith(false);

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');
  await vi.waitFor(() => expect(setCanGoBack).toHaveBeenLastCalledWith(true));

  lynx.getJSModule('GlobalEventEmitter').emit('routemaker:back', []);

  expect(await queries.findByText('1 Test Street')).toBeInTheDocument();
});

test('adopts the page the browser navigated to', async () => {
  const { queries } = startApp();
  await queries.findByText("Pick a gym and see what's on the wall.");

  lynx
    .getJSModule('GlobalEventEmitter')
    .emit('routemaker:page', [{ name: 'feed', following: false }]);

  expect(
    await queries.findByText('Fresh routes from every gym, newest first.')
  ).toBeInTheDocument();
});

test('does not push the page it is already on', async () => {
  const history = withHistory();
  const { queries } = startApp();
  await signIn(queries);
  await queries.findByText('Fresh routes from every gym, newest first.');
  history.push.mockClear();

  await tapText(queries, 'Feed', -1);
  await tapText(queries, 'Everyone');

  expect(history.push).not.toHaveBeenCalled();
});

test('replaces a page the visitor may not see in history, not just on screen', async () => {
  resetHost({ initialPage: { name: 'account' } });
  const history = withHistory();
  const { queries } = startApp();

  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(history.replace).toHaveBeenCalledWith('/login');
  expect(history.push).not.toHaveBeenCalled();
});

test('clears a notice when the visitor navigates', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({ route: () => beta });
  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');
  await reportRoute(queries, 'Spam');
  await queries.findByText('Report sent to the moderators.');

  await tapText(queries, 'Gyms', -1);

  await queries.findByText("Pick a gym and see what's on the wall.");
  expect(notice()).toBeUndefined();
});

test('lets Android Back through while a sheet is open, so that Back can close it', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const setCanGoBack = vi.fn();
  installHost({ RouteMakerNavigation: { setCanGoBack } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');
  expect(setCanGoBack).toHaveBeenLastCalledWith(false);

  await tapLabel(queries, 'Sort: Newest');
  await queries.findByText('Sort routes');
  await vi.waitFor(() => expect(setCanGoBack).toHaveBeenLastCalledWith(true));

  lynx.getJSModule('GlobalEventEmitter').emit('routemaker:back', []);

  await vi.waitFor(() => expect(queries.queryByText('Sort routes')).not.toBeInTheDocument());
  expect(queries.getByText('1 Test Street')).toBeInTheDocument();
  await vi.waitFor(() => expect(setCanGoBack).toHaveBeenLastCalledWith(false));
});

test('closes a sheet when the visitor navigates', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');
  await tapLabel(queries, 'Sort: Newest');
  await queries.findByText('Sort routes');

  await tapText(queries, 'Feed', -1);

  await queries.findByText('Fresh routes from every gym, newest first.');
  expect(queries.queryByText('Sort routes')).not.toBeInTheDocument();
});

test('closes a sheet when the browser moves to another page', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');
  await tapLabel(queries, 'Sort: Newest');
  await queries.findByText('Sort routes');

  lynx
    .getJSModule('GlobalEventEmitter')
    .emit('routemaker:page', [{ name: 'feed', following: false }]);

  await queries.findByText('Fresh routes from every gym, newest first.');
  expect(queries.queryByText('Sort routes')).not.toBeInTheDocument();
});

test('keeps a sheet open while the page stays the same', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');
  await tapLabel(queries, 'Sort: Newest');
  await queries.findByText('Sort routes');

  await tapLabel(queries, 'Most liked');
  await settle();

  expect(queries.getByText('Sort routes')).toBeInTheDocument();
});
