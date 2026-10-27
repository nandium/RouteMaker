import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import { MAP_STYLES } from '../../../map-config.js';
import {
  gym,
  installHost,
  notice,
  resetHost,
  route,
  settle,
  tapText,
  startApp,
} from './helpers.js';

beforeEach(() => resetHost());

const openingBrowser = () => {
  const openExternal = vi.fn((_url: string, _replace: boolean, done: (ok: boolean) => void) =>
    done(true)
  );
  installHost({ RouteMakerNavigation: { openExternal } });
  return openExternal;
};

test('lists gyms, then the routes of the chosen gym', async () => {
  const { api, queries } = startApp();

  await tapText(queries, 'Central Bloc');

  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(api.to('routes')[0].query.get('gym_id')).toBe('central');
});

test('shows routes without a grade as Unrated', async () => {
  const { queries } = startApp({ routes: () => [{ ...route, public_grade: '' }] });

  await tapText(queries, 'Central Bloc');

  expect(await queries.findByLabelText(/unrated/)).toBeInTheDocument();
});

test('shows a failed route list as an error with a retry, not as empty', async () => {
  let offline = true;
  const { queries } = startApp({
    routes: () => {
      if (offline) throw new ApiError('offline', 503);
      return [route];
    },
  });

  await tapText(queries, 'Central Bloc');
  expect(await queries.findByText("Couldn't load routes")).toBeInTheDocument();
  expect(queries.getByText('offline')).toBeInTheDocument();
  expect(queries.queryByText('No routes here yet')).not.toBeInTheDocument();

  offline = false;
  await tapText(queries, 'Try again');
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
});

test('says so when a gym has no routes yet', async () => {
  const { queries } = startApp({ routes: () => [] });

  await tapText(queries, 'Central Bloc');

  expect(await queries.findByText('No routes here yet')).toBeInTheDocument();
  expect(queries.getByText('Add the first route')).toBeInTheDocument();
});

test('offers the map only after the gyms have loaded', async () => {
  let finish: (gyms: (typeof gym)[]) => void = () => {};
  const { queries } = startApp({ gyms: () => new Promise((resolve) => (finish = resolve)) });

  await settle();
  expect(queries.queryByText('Gym map')).not.toBeInTheDocument();

  finish([gym]);
  expect(await queries.findByText('Gym map')).toBeInTheDocument();
});

test('reports a browser tool that cannot be opened', async () => {
  installHost({
    RouteMakerNavigation: {
      openExternal: (_url: string, _replace: boolean, done: (ok: boolean) => void) => done(false),
    },
  });
  const { queries } = startApp();

  await tapText(queries, 'Gym map');

  expect(await queries.findByText('Could not open the gym map. Try again.')).toBeInTheDocument();
});

test('reports a browser tool on a host that cannot open one', async () => {
  const { queries } = startApp();

  await tapText(queries, 'Add a route');

  expect(
    await queries.findByText('Could not open the route editor. Try again.')
  ).toBeInTheDocument();
});

test('opens the route editor in the browser', async () => {
  const openExternal = openingBrowser();
  const { queries } = startApp();

  await tapText(queries, 'Add a route');

  expect(openExternal).toHaveBeenCalledWith(
    'http://localhost:8788/routes/new',
    false,
    expect.any(Function)
  );
});

test('opens the native map once, centred on the climber, and follows the gym chosen there', async () => {
  let scene: any;
  let opened = 0;
  let close: (gymId: string) => void = () => {};
  installHost({
    RouteMakerMap: {
      open: (json: string, callback: (gymId: string) => void) => {
        opened += 1;
        scene = JSON.parse(json);
        close = callback;
      },
    },
  });
  const { api, queries } = startApp({
    location: () => ({ latitude: 51.5072, longitude: -0.1276 }),
  });

  await queries.findByText('Gym map');
  await vi.waitFor(() => expect(api.to('location')).toHaveLength(1));
  await tapText(queries, 'Gym map');
  await tapText(queries, 'Gym map');

  await vi.waitFor(() =>
    expect(scene).toMatchObject({
      gyms: [{ id: 'central', latitude: 1.3, longitude: 103.8 }],
      style: MAP_STYLES.light,
      theme: 'light',
      centerLatitude: 51.5072,
      centerLongitude: -0.1276,
    })
  );
  expect(api.to('location')).toHaveLength(1);
  expect(opened).toBe(1);

  close('central');

  expect(await queries.findByText('All gyms')).toBeInTheDocument();
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
});

test('opens the native map at once, without waiting for a location that is still on its way', async () => {
  const open = vi.fn();
  installHost({ RouteMakerMap: { open } });
  const { queries } = startApp({ location: () => new Promise(() => undefined) });

  await tapText(queries, 'Gym map');

  expect(open).toHaveBeenCalledOnce();
  expect(JSON.parse(open.mock.calls[0][0])).toMatchObject({ centerLatitude: 1.3 });
});

test('ignores taps while the native map is open, and allows opening it again once it is dismissed', async () => {
  let close: (gymId: string) => void = () => {};
  const open = vi.fn((_scene: string, callback: (gymId: string) => void) => (close = callback));
  installHost({ RouteMakerMap: { open } });
  const { queries } = startApp();

  await tapText(queries, 'Gym map');
  await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
  await tapText(queries, 'Gym map');
  await settle();
  expect(open).toHaveBeenCalledOnce();
  close('');
  await tapText(queries, 'Gym map');

  await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));
  expect(queries.getByText("Pick a gym and see what's on the wall.")).toBeInTheDocument();
});

test('falls back to the browser map when the host has none', async () => {
  const openExternal = openingBrowser();
  const { queries } = startApp();

  await tapText(queries, 'Gym map');

  await vi.waitFor(() =>
    expect(openExternal).toHaveBeenCalledWith(
      'http://localhost:8788/gyms/map',
      false,
      expect.any(Function)
    )
  );
  expect(notice()).toBeUndefined();
});

test('shows how many routes each gym has', async () => {
  const { queries } = startApp({
    gyms: () => [
      { ...gym, route_count: 1 },
      { ...gym, id: 'north', name: 'North Wall', route_count: 0 },
      { ...gym, id: 'east', name: 'East Hold', route_count: 12 },
    ],
  });

  expect(await queries.findByLabelText('Central Bloc, 1 Test Street, 1 route')).toBeInTheDocument();
  expect(queries.getByLabelText('North Wall, 1 Test Street, 0 routes')).toBeInTheDocument();
  expect(queries.getByLabelText('East Hold, 1 Test Street, 12 routes')).toBeInTheDocument();
  expect(queries.getByText('12')).toBeInTheDocument();
  expect(queries.getByText('3 gyms')).toBeInTheDocument();
});

const listed = () =>
  Array.from(elementTree.root!.querySelectorAll('.row-item')).map(
    (row) => row.getAttribute('aria-label')!.split(',')[0]
  );

test('lists the nearest gyms first when a location is known', async () => {
  const { queries } = startApp({
    gyms: () => [
      { ...gym, id: 'far', name: 'Far Wall', latitude: 40, longitude: -74 },
      { ...gym, id: 'near', name: 'Near Wall', latitude: 1.35, longitude: 103.82 },
      { ...gym, id: 'mid', name: 'Mid Wall', latitude: 22, longitude: 114 },
    ],
    location: () => ({ latitude: 1.3521, longitude: 103.8198 }),
  });

  await queries.findByText('Near Wall');

  expect(listed()).toEqual(['Near Wall', 'Mid Wall', 'Far Wall']);
  expect(queries.getByText('Nearest first')).toBeInTheDocument();
});

test('keeps gyms in name order without a location', async () => {
  const { queries } = startApp({
    gyms: () => [
      { ...gym, id: 'a', name: 'A Wall', latitude: 40, longitude: -74 },
      { ...gym, id: 'b', name: 'B Wall', latitude: 1.35, longitude: 103.82 },
    ],
  });

  await queries.findByText('B Wall');

  expect(listed()).toEqual(['A Wall', 'B Wall']);
  expect(queries.getByText('Sorted by name')).toBeInTheDocument();
  expect(queries.queryByText(/~\d+ km/)).not.toBeInTheDocument();
});

test('opens the route creator with this gym selected', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const openExternal = openingBrowser();
  const { queries } = startApp();

  await tapText(queries, 'Add a route');

  expect(openExternal).toHaveBeenCalledWith(
    'http://localhost:8788/routes/new?gym=central',
    false,
    expect.any(Function)
  );
});

test('says roughly how far each gym is when a location is known', async () => {
  const { queries } = startApp({
    gyms: () => [
      { ...gym, id: 'near', name: 'Near Wall', latitude: 1.3, longitude: 103.81 },
      { ...gym, id: 'far', name: 'Far Wall', latitude: 3.1, longitude: 101.7 },
    ],
    location: () => ({ latitude: 1.3, longitude: 103.8 }),
  });

  await queries.findByText('Near Wall');

  expect(queries.getByText('~1 km')).toBeInTheDocument();
  expect(queries.getByText(/^~\d+0 km$/)).toBeInTheDocument();
});

test('shows a failed gym list as an error with a retry', async () => {
  let offline = true;
  const { queries } = startApp({
    gyms: () => {
      if (offline) throw new ApiError('Request failed (503)', 503);
      return [gym];
    },
  });

  expect(await queries.findByText("Couldn't load gyms")).toBeInTheDocument();
  expect(queries.getByText('Request failed (503)')).toBeInTheDocument();
  expect(queries.queryByText('Gym map')).not.toBeInTheDocument();

  offline = false;
  await tapText(queries, 'Try again');
  expect(await queries.findByText('Central Bloc')).toBeInTheDocument();
});

test('invites a visitor to request a gym on the map when there are none', async () => {
  const openExternal = openingBrowser();
  const { queries } = startApp({ gyms: () => [] });

  expect(await queries.findByText('No gyms yet')).toBeInTheDocument();
  await tapText(queries, 'Request a gym on the map');

  await vi.waitFor(() =>
    expect(openExternal).toHaveBeenCalledWith(
      'http://localhost:8788/gyms/map',
      false,
      expect.any(Function)
    )
  );
});

test('names the gym and its address above its routes', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();

  expect(await queries.findByText('Central Bloc', { selector: '.hero-title' })).toBeInTheDocument();
  expect(queries.getByText('1 Test Street')).toBeInTheDocument();
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
});
