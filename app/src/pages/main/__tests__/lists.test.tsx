import { beforeEach, expect, test } from 'vitest';

import { NOW, resetHost, route, settle, startApp, tapLabel, tapText } from './helpers.js';

beforeEach(() => resetHost({ initialPage: { name: 'gym', gymId: 'central' } }));

const make = (name: string, overrides: Partial<typeof route>) => ({
  ...route,
  id: name.toLowerCase(),
  name,
  ...overrides,
});
const routes = [
  make('Fresh', { created_at: NOW - 10, public_grade: 'V2', likes: 1, sends: 1 }),
  make('Loved', { created_at: NOW - 300, public_grade: 'V5', likes: 40, sends: 2 }),
  make('Crushed', { created_at: NOW - 200, public_grade: 'V9', likes: 3, sends: 30 }),
  make('Ancient', { created_at: NOW - 900, public_grade: '', likes: 0, sends: 0 }),
];

/** The names of the routes listed, in order, whether they are rows or tiles. */
const shown = () =>
  Array.from(elementTree.root!.querySelectorAll('.route-row, .route-tile')).map(
    (item) => item.getAttribute('aria-label')!.split(',')[0]
  );

const pressed = (queries: { getByLabelText(label: string): HTMLElement }, label: string) =>
  queries.getByLabelText(label).getAttribute('aria-pressed');
const checked = (queries: { getByLabelText(label: string): HTMLElement }, label: string) =>
  queries.getByLabelText(label).getAttribute('aria-checked');

test('lists the newest routes first, including ones nobody has graded', async () => {
  const { queries } = startApp({ routes: () => [...routes].reverse() });

  await queries.findByText('Fresh');

  expect(shown()).toEqual(['Fresh', 'Crushed', 'Loved', 'Ancient']);
  expect(queries.getByLabelText(/^Ancient, unrated/)).toBeInTheDocument();
});

test.each([
  ['V2–3', ['Fresh']],
  ['V4–5', ['Loved']],
  ['V8–10', ['Crushed']],
])('narrows the list to the %s tier', async (tier, expected) => {
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');

  await tapLabel(queries, `Grade ${tier}`);

  expect(shown()).toEqual(expected);
  expect(pressed(queries, `Grade ${tier}`)).toBe('true');
});

test('combines tiers, and shows every route again once none is chosen', async () => {
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');

  await tapLabel(queries, 'Grade V2–3');
  await tapLabel(queries, 'Grade V8–10');
  expect(shown()).toEqual(['Fresh', 'Crushed']);

  await tapLabel(queries, 'Grade V2–3');
  await tapLabel(queries, 'Grade V8–10');
  expect(shown()).toEqual(['Fresh', 'Crushed', 'Loved', 'Ancient']);
});

test('counts the routes showing out of all of them, and clears the filter', async () => {
  const { queries } = startApp({ routes: () => routes });
  expect(await queries.findByText('4 routes')).toBeInTheDocument();
  expect(queries.queryByText('Clear filter')).not.toBeInTheDocument();

  await tapLabel(queries, 'Grade V2–3');
  await tapLabel(queries, 'Grade V4–5');
  expect(await queries.findByText('2 of 4 routes')).toBeInTheDocument();
  expect(queries.getByLabelText('Showing 2 of 4 routes')).toBeInTheDocument();

  await tapText(queries, 'Clear filter');

  expect(await queries.findByText('4 routes')).toBeInTheDocument();
  expect(shown()).toHaveLength(4);
  expect(pressed(queries, 'Grade V2–3')).toBe('false');
});

test('says so, and offers a way back, when no route falls in the chosen tier', async () => {
  const { queries } = startApp({ routes: () => [routes[0], routes[3]] });
  await queries.findByText('Fresh');

  await tapLabel(queries, 'Grade V11+');

  expect(await queries.findByText('No V11+ routes')).toBeInTheDocument();
  expect(shown()).toEqual([]);

  await tapText(queries, 'Clear filter', -1);
  expect(shown()).toEqual(['Fresh', 'Ancient']);
});

test.each([
  ['Most liked', ['Loved', 'Crushed', 'Fresh', 'Ancient']],
  ['Most sent', ['Crushed', 'Loved', 'Fresh', 'Ancient']],
  ['Newest', ['Fresh', 'Crushed', 'Loved', 'Ancient']],
])('orders the list by %s, chosen in the sort sheet', async (sort, expected) => {
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');

  await tapLabel(queries, 'Sort: Newest');
  expect(await queries.findByText('Sort routes')).toBeInTheDocument();
  await tapLabel(queries, sort);
  expect(checked(queries, sort)).toBe('true');
  await tapText(queries, 'Done');

  expect(queries.queryByText('Sort routes')).not.toBeInTheDocument();
  expect(shown()).toEqual(expected);
  expect(queries.getByLabelText(`Sort: ${sort}`)).toBeInTheDocument();
});

test('says how many routes show once the order is not the default', async () => {
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');

  await tapLabel(queries, 'Sort: Newest');
  await tapLabel(queries, 'Most sent');

  expect(await queries.findByText('4 of 4 routes')).toBeInTheDocument();
});

test('closes the sort sheet from outside it', async () => {
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');
  await tapLabel(queries, 'Sort: Newest');
  await queries.findByText('Sort routes');

  const scrim = elementTree.root!.querySelector('.scrim')!;
  scrim.dispatchEvent(
    Object.assign(new window.Event('bindEvent:tap', { bubbles: true }), {
      eventName: 'tap',
      eventType: 'bindEvent',
      detail: {},
    })
  );

  await settle();
  expect(queries.queryByText('Sort routes')).not.toBeInTheDocument();
});

test('combines tiers with an order', async () => {
  const { queries } = startApp({
    routes: () => [...routes, make('Quiet', { public_grade: 'V4', likes: 2, created_at: NOW })],
  });
  await queries.findByText('Fresh');

  await tapLabel(queries, 'Grade V4–5');
  await tapLabel(queries, 'Sort: Newest');
  await tapLabel(queries, 'Most liked');

  expect(shown()).toEqual(['Loved', 'Quiet']);
});

test('sorts with a segmented control, not a sheet, on wide screens', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' }, wideLayout: true });
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');
  expect(queries.queryByLabelText(/^Sort: /)).not.toBeInTheDocument();

  await tapLabel(queries, 'Most liked');

  expect(shown()).toEqual(['Loved', 'Crushed', 'Fresh', 'Ancient']);
  expect(pressed(queries, 'Most liked')).toBe('true');
  expect(elementTree.root!.querySelectorAll('.route-tile')).toHaveLength(4);
});

test('shows each route’s likes, sends and grade', async () => {
  const { queries } = startApp({ routes: () => [routes[1]] });

  expect(await queries.findByText('Loved')).toBeInTheDocument();
  expect(queries.getByLabelText('40 likes')).toBeInTheDocument();
  expect(queries.getByLabelText('2 sends')).toBeInTheDocument();
  expect(queries.getByText('V5', { selector: '.tag-num' })).toBeInTheDocument();
});

test('draws a liked route’s heart solid, and an unliked one as an outline', async () => {
  const { queries } = startApp({
    routes: () => [
      { ...routes[1], liked: true },
      { ...routes[0], liked: false },
    ],
  });
  await queries.findByText('Loved');

  const heart = (likes: string) =>
    queries.getByLabelText(likes).querySelector('svg')!.getAttribute('content');
  expect(heart('40 likes')).not.toContain('fill="none"');
  expect(heart('1 like')).toContain('fill="none"');
});

test('shows a thumbnail per route and falls back to a plain box when one fails', async () => {
  const { queries } = startApp({ routes: () => routes.slice(0, 2) });
  await queries.findByText('Fresh');

  const thumbs = () => Array.from(elementTree.root!.querySelectorAll('image'));
  expect(thumbs()).toHaveLength(2);
  expect(thumbs()[0]).toHaveAttribute('src', 'http://localhost:8788/media/blue/thumb');
  expect(thumbs()[0]).toHaveAttribute('placeholder', expect.stringContaining('data:image/png'));

  thumbs()[0].dispatchEvent(
    Object.assign(new window.Event('bindEvent:error', { bubbles: true }), {
      eventName: 'error',
      eventType: 'bindEvent',
      detail: {},
    })
  );

  await settle();
  expect(thumbs()).toHaveLength(1);
  expect(queries.getByText('Fresh')).toBeInTheDocument();
});

test('opens a route from its row', async () => {
  const { queries } = startApp({ routes: () => routes });
  await queries.findByText('Fresh');

  await tapText(queries, 'Loved');

  expect(await queries.findByText('Log your ascent')).toBeInTheDocument();
});

const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    make(`Route ${String(index).padStart(2, '0')}`, {
      created_at: NOW - index,
      public_grade: index % 2 ? 'V2' : 'V5',
    })
  );

test('shows a long list a page at a time, and the rest on request', async () => {
  const { queries } = startApp({ routes: () => many(60) });
  await queries.findByText('Route 00');
  expect(shown()).toHaveLength(24);

  await tapLabel(queries, 'Show 24 more routes, 36 not shown yet');
  expect(shown()).toHaveLength(48);

  await tapLabel(queries, 'Show 12 more routes, 12 not shown yet');
  expect(shown()).toHaveLength(60);
  expect(queries.queryByText(/^Show \d+ more$/)).not.toBeInTheDocument();
});

test('offers nothing more for a list that fits on one page', async () => {
  const { queries } = startApp({ routes: () => many(24) });
  await queries.findByText('Route 00');

  expect(shown()).toHaveLength(24);
  expect(queries.queryByText(/more$/)).not.toBeInTheDocument();
});

test('starts again from the first page when the choice changes', async () => {
  const { queries } = startApp({ routes: () => many(60) });
  await queries.findByText('Route 00');
  await tapLabel(queries, 'Show 24 more routes, 36 not shown yet');
  expect(shown()).toHaveLength(48);

  await tapLabel(queries, 'Grade V2–3');
  expect(shown()).toHaveLength(24);
  expect(await queries.findByText('30 of 60 routes')).toBeInTheDocument();

  await tapLabel(queries, 'Show 6 more routes, 6 not shown yet');
  expect(shown()).toHaveLength(30);
  await tapLabel(queries, 'Sort: Newest');
  await tapLabel(queries, 'Most liked');
  expect(shown()).toHaveLength(24);
});

test('counts every route that matches, not just the page showing', async () => {
  const { queries } = startApp({ routes: () => many(60) });

  expect(await queries.findByText('60 routes')).toBeInTheDocument();
  expect(shown()).toHaveLength(24);
});

test('shows a page of tiles at a time on a wide screen too', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' }, wideLayout: true });
  const { queries } = startApp({ routes: () => many(30) });
  await queries.findByText('Route 00');

  expect(elementTree.root!.querySelectorAll('.route-tile')).toHaveLength(24);
  await tapLabel(queries, 'Show 6 more routes, 6 not shown yet');
  expect(elementTree.root!.querySelectorAll('.route-tile')).toHaveLength(30);
});
