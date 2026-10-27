import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import {
  account,
  installHost,
  note,
  notice,
  resetHost,
  route,
  sessionStore,
  settle,
  startApp,
  submitCredentials,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost({ initialPage: { name: 'route', routeId: 'blue' } }));

const photo = () => elementTree.root!.querySelector('.det-photo-image')!;
const fire = (element: Element, name: string, detail: object = {}) =>
  element.dispatchEvent(
    Object.assign(new window.Event(`bindEvent:${name}`, { bubbles: true }), {
      eventName: name,
      eventType: 'bindEvent',
      detail,
    })
  );
const stranger = { ...route, author: { username: 'leon', display_name: 'Leon' } };

test('shows the route with its photo, grade, send count and notes', async () => {
  const { queries } = startApp();

  expect(await queries.findByLabelText('By Maya Tan, open profile')).toBeInTheDocument();
  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
  expect(queries.getByText('Blue Moon', { selector: '.det-title' })).toBeInTheDocument();
  expect(queries.getByLabelText('3 sends')).toBeInTheDocument();
  expect(queries.getByLabelText('Grade V4')).toBeInTheDocument();
  expect(queries.getByLabelText('Route code BLUE')).toBeInTheDocument();
  expect(queries.getByText('Central Bloc')).toBeInTheDocument();
  expect(photo()).toHaveAttribute('src', 'http://localhost:8788/media/blue');
});

test('shows one send in the singular', async () => {
  const { queries } = startApp({ route: () => ({ ...route, sends: 1 }) });

  expect(await queries.findByLabelText('1 send')).toBeInTheDocument();
});

test('shows an ungraded route as Unrated', async () => {
  const { queries } = startApp({ route: () => ({ ...route, public_grade: '' }) });

  expect(await queries.findByLabelText('Unrated')).toBeInTheDocument();
});

test('explains the marks burned into the photo', async () => {
  const { queries } = startApp();
  await queries.findByText('Friendly finish');

  expect(queries.getByText('How to read the photo')).toBeInTheDocument();
  for (const mark of ['Hand', 'Foot', 'Any limb', 'Start tape', 'Finish tape']) {
    expect(queries.getByText(mark)).toBeInTheDocument();
  }
});

test('replaces a photo that fails to load, and tries again on request', async () => {
  const { queries } = startApp();
  await queries.findByText('Friendly finish');

  fire(photo(), 'error');
  expect(await queries.findByText("Photo didn't load")).toBeInTheDocument();
  expect(elementTree.root!.querySelector('.det-photo-image')).toBeNull();

  await tapText(queries, 'Reload photo');
  await vi.waitFor(() =>
    expect(photo()).toHaveAttribute('src', 'http://localhost:8788/media/blue')
  );
  expect(queries.queryByText("Photo didn't load")).not.toBeInTheDocument();
});

test('gives the photo its own proportions once it has loaded', async () => {
  const { queries } = startApp();
  await queries.findByText('Friendly finish');
  const box = () => elementTree.root!.querySelector('.det-photo')!;
  expect(box().getAttribute('style')).toContain('aspect-ratio: 0.8');

  fire(photo(), 'load', { width: 1600, height: 1000 });

  await vi.waitFor(() => expect(box().getAttribute('style')).toContain('aspect-ratio: 1.6'));
});

test('loads the notes alongside the route, and a failing notes request leaves the route readable', async () => {
  let offline = true;
  const { queries } = startApp({
    notes: () => {
      if (offline) throw new ApiError('offline', 503);
      return [note];
    },
  });

  expect(
    await queries.findByText('Could not load notes. The route is fine, try again.')
  ).toBeInTheDocument();
  expect(queries.getByText('Blue Moon', { selector: '.det-title' })).toBeInTheDocument();

  offline = false;
  await tapText(queries, 'Try again');
  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
});

test('says so when a route has no notes', async () => {
  const { queries } = startApp({ notes: () => [] });

  expect(
    await queries.findByText('No notes yet. Log your ascent and leave the first one.')
  ).toBeInTheDocument();
});

test('shows each note with its author, send, grade and age, and opens the author', async () => {
  const { queries } = startApp({ notes: () => [note] });

  expect(await queries.findByText('Leon')).toBeInTheDocument();
  expect(queries.getByText('Sent')).toBeInTheDocument();
  expect(queries.getByText('V5', { selector: '.tag-num' })).toBeInTheDocument();
  expect(queries.getByText('1 note')).toBeInTheDocument();

  await tapLabel(queries, 'Open profile of Leon');
  expect(await queries.findByText('Maya Tan', { selector: '.hero-title' })).toBeInTheDocument();
});

test('offers a failed route a retry and a way back', async () => {
  let offline = true;
  const { queries } = startApp({
    route: () => {
      if (offline) throw new ApiError('Route not found', 404);
      return route;
    },
  });

  expect(await queries.findByText("Couldn't load this route")).toBeInTheDocument();
  expect(queries.getByText('Route not found')).toBeInTheDocument();

  offline = false;
  await tapText(queries, 'Try again');
  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
});

test('invites guests to sign in, then returns them to the route', async () => {
  const { api, queries } = startApp();

  expect(
    await queries.findByText(
      'Sign in to mark a send, suggest a grade and leave a note. Browsing stays open.'
    )
  ).toBeInTheDocument();
  await tapText(queries, 'Sign in to log it');
  await submitCredentials(queries);

  expect(await queries.findByText('Your ascent')).toBeInTheDocument();
  expect(api.to('route').at(-1)!.token).toBe('test-token');
});

test('likes and unlikes a route', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp({
    like: ({ method }) => ({ liked: method === 'PUT', likes: method === 'PUT' ? 19 : 18 }),
  });

  await tapLabel(queries, 'Like, 18 likes');
  expect(await queries.findByLabelText('Liked, 19 likes')).toBeInTheDocument();
  expect(queries.getByText('Liked')).toBeInTheDocument();
  expect(api.to('like')).toMatchObject([{ method: 'PUT', param: 'blue', token: 'saved-token' }]);

  await tapLabel(queries, 'Liked, 19 likes');
  expect(await queries.findByLabelText('Like, 18 likes')).toBeInTheDocument();
  expect(api.to('like').map(({ method }) => method)).toEqual(['PUT', 'DELETE']);
});

test('pops the heart when a like goes through, but not for a like made earlier', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({
    route: () => ({ ...route, liked: false }),
    like: ({ method }) => ({ liked: method === 'PUT', likes: method === 'PUT' ? 19 : 18 }),
  });
  const vote = () => elementTree.root!.querySelector('.vote')!;
  await queries.findByText('Friendly finish');
  expect(vote().className).not.toContain('vote-pop');

  await tapLabel(queries, 'Like, 18 likes');
  await queries.findByLabelText('Liked, 19 likes');
  expect(vote().className).toContain('vote-pop');

  await tapLabel(queries, 'Liked, 19 likes');
  await queries.findByLabelText('Like, 18 likes');
  expect(vote().className).not.toContain('vote-pop');
});

test('does not pop a heart that was already liked when the route opened', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({ route: () => ({ ...route, liked: true, likes: 19 }) });

  await queries.findByLabelText('Liked, 19 likes');

  expect(elementTree.root!.querySelector('.vote')!.className).not.toContain('vote-pop');
});

test('asks guests to sign in when they like', async () => {
  const { api, queries } = startApp();

  await tapLabel(queries, 'Like, 18 likes');

  expect(await queries.findByText('Sign in to like routes.')).toBeInTheDocument();
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(api.to('like')).toHaveLength(0);
});

test('shares the public link', async () => {
  const share = vi.fn((_url: string, _title: string, done: (result: string) => void) =>
    done('copied')
  );
  installHost({ RouteMakerShare: { share } });
  const { queries } = startApp();

  await tapText(queries, 'Share');

  expect(await queries.findByText('Route link copied.')).toBeInTheDocument();
  expect(share).toHaveBeenCalledWith(
    'http://localhost:8788/routes/blue',
    'Blue Moon',
    expect.any(Function)
  );
});

test('says so when sharing is unavailable', async () => {
  const { queries } = startApp();

  await tapText(queries, 'Share');

  expect(await queries.findByText('Sharing is not available on this device.')).toBeInTheDocument();
});

test('stays quiet when the share sheet is cancelled', async () => {
  installHost({
    RouteMakerShare: {
      share: (_url: string, _title: string, done: (result: string) => void) => done('cancelled'),
    },
  });
  const { queries } = startApp();

  await tapText(queries, 'Share');
  await settle();

  expect(notice()).toBeUndefined();
});

test('marks a route as the climber’s own', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();

  expect(await queries.findByText('Your route', { selector: '.badge-label' })).toBeInTheDocument();
});

test('offers removal to the author, who must confirm before it happens', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp();

  await tapText(queries, 'Remove route');
  expect(await queries.findByText('Remove this route?')).toBeInTheDocument();
  expect(api.to('removeRoute')).toHaveLength(0);
  await tapText(queries, 'Keep route');
  expect(queries.queryByText('Remove this route?')).not.toBeInTheDocument();
  expect(api.to('removeRoute')).toHaveLength(0);

  await tapText(queries, 'Remove route');
  await tapText(queries, 'Remove route', -1);

  expect(await queries.findByText('Route removed.')).toBeInTheDocument();
  expect(api.to('removeRoute')).toMatchObject([{ param: 'blue', token: 'saved-token' }]);
  expect(await queries.findByText('All gyms')).toBeInTheDocument();
  expect(queries.queryByText('Friendly finish')).not.toBeInTheDocument();
  expect(queries.queryByText('Remove this route?')).not.toBeInTheDocument();
});

test('offers other climbers a report, not removal', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({ route: () => stranger });

  await queries.findByLabelText('By Leon, open profile');

  expect(queries.queryByText('Remove route')).not.toBeInTheDocument();
  expect(queries.getByText('Report this route')).toBeInTheDocument();
});

test('offers removal to an administrator who is not the author', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({
    route: () => stranger,
    me: () => ({ ...account, role: 'admin' }),
  });

  expect(await queries.findByText('Moderator')).toBeInTheDocument();
  expect(queries.getByText('Remove route')).toBeInTheDocument();
});

test('lays out the photo beside the details on a wide screen', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' }, wideLayout: true });
  const { queries } = startApp();

  await queries.findByText('Friendly finish');

  const left = elementTree.root!.querySelector('.det-left')!;
  const right = elementTree.root!.querySelector('.det-right')!;
  expect(left.querySelector('.det-photo')).not.toBeNull();
  expect(left.textContent).toContain('How to read the photo');
  expect(right.textContent).toContain('Blue Moon');
  expect(elementTree.root!.querySelector('.det-notes')!.textContent).toContain('Friendly finish');
  expect(queries.getByText('Back')).toBeInTheDocument();
});
