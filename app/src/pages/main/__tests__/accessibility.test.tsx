import { beforeEach, expect, test } from 'vitest';

import { account, resetHost, sessionStore, startApp, tapLabel, tapText } from './helpers.js';

beforeEach(() => resetHost());

const root = () => elementTree.root!;

test('a sheet keeps a native screen reader inside it, and is announced as a dialog', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');

  await tapLabel(queries, 'Sort: Newest');
  await queries.findByText('Sort routes');

  const sheet = root().querySelector('.sheet')!;
  expect(sheet).toHaveAttribute('accessibility-exclusive-focus', 'true');
  expect(sheet).toHaveAttribute('role', 'dialog');
  expect(sheet).toHaveAttribute('aria-modal', 'true');
  expect(sheet).toHaveAttribute('aria-label', 'Sort routes');
});

test('the choices in a sheet are radios in a group, not toggle buttons', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');
  await tapLabel(queries, 'Sort: Newest');

  const group = await queries.findByLabelText('Order');
  expect(group).toHaveAttribute('role', 'radiogroup');
  const newest = queries.getByLabelText('Newest');
  expect(newest).toHaveAttribute('role', 'radio');
  expect(newest).toHaveAttribute('aria-checked', 'true');
  expect(newest).not.toHaveAttribute('aria-pressed');
  expect(queries.getByLabelText('Most liked')).toHaveAttribute('aria-checked', 'false');
});

test('a disabled button says so to a native screen reader, and ignores taps', async () => {
  resetHost({ initialPage: { name: 'account' } });
  sessionStore('saved-token');
  const { api, queries } = startApp();
  await tapText(queries, 'Delete account…');

  const button = await queries.findByLabelText('Delete my account');

  expect(button).toHaveAttribute('accessibility-traits', 'disabled');
  expect(button).toHaveAttribute('accessibility-value', 'Disabled');
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(api.to('deleteAccount')).toHaveLength(0);
});

test('a button that can be used says it is a button, and a selected one says it is selected', async () => {
  resetHost({ initialPage: { name: 'feed', following: false } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');

  expect(queries.getByLabelText('Following')).toHaveAttribute('accessibility-traits', 'button');
  expect(queries.getByLabelText('Everyone')).toHaveAttribute('accessibility-traits', 'selected');
  expect(queries.getByLabelText('Everyone')).toHaveAttribute('accessibility-value', 'Selected');
});

test('headings are marked for the web, iOS and Android', async () => {
  const { queries } = startApp();
  await queries.findByText('Central Bloc');

  const title = queries.getByText('Gyms', { selector: '.hero-title' });
  expect(title).toHaveAttribute('role', 'heading');
  expect(title).toHaveAttribute('aria-level', '1');
  expect(title).toHaveAttribute('accessibility-traits', 'header');
  expect(title).toHaveAttribute('accessibility-heading', 'true');

  const group = queries.getByText('1 gym');
  expect(group).toHaveAttribute('accessibility-heading', 'true');
});

test('navigation marks the page being shown as current, and nothing else as pressed', async () => {
  const { queries } = startApp();
  await queries.findByText('Central Bloc');

  expect(queries.getByLabelText('Gyms')).toHaveAttribute('aria-current', 'page');
  expect(queries.getByLabelText('Feed')).not.toHaveAttribute('aria-current');
  expect(queries.getByLabelText('Gyms')).not.toHaveAttribute('aria-pressed');
  expect(queries.getByLabelText('Account, guest, sign in')).not.toHaveAttribute('aria-current');

  await tapLabel(queries, 'Feed');
  // The Feed screen has a control of its own called Feed, above the bar.
  expect((await queries.findAllByLabelText('Feed')).at(-1)).toHaveAttribute('aria-current', 'page');
  expect(queries.getByLabelText('Gyms')).not.toHaveAttribute('aria-current');
});

test('wide navigation and the account chip mark the current page too', async () => {
  resetHost({ wideLayout: true, initialPage: { name: 'account' } });
  sessionStore('saved-token');
  const { queries } = startApp();

  expect(await queries.findByLabelText(`Account, ${account.username}`)).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(queries.getByLabelText('Gyms')).not.toHaveAttribute('aria-current');
});

test('toggles keep saying pressed', async () => {
  resetHost({ initialPage: { name: 'gym', gymId: 'central' } });
  const { queries } = startApp();
  await queries.findByText('Blue Moon');

  expect(queries.getByLabelText('Grade V4–5')).toHaveAttribute('aria-pressed', 'false');
  await tapLabel(queries, 'Grade V4–5');
  expect(queries.getByLabelText('Grade V4–5')).toHaveAttribute('aria-pressed', 'true');
});

test('a list that is loading says so, instead of leaving shapes to be read', async () => {
  const { queries } = startApp({ gyms: () => new Promise(() => undefined) });

  expect(await queries.findByLabelText('Loading gyms')).toHaveAttribute('aria-busy', 'true');
});

test('the note flag is a labelled button, not an unnamed icon', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Friendly finish');

  const flag = queries.getByLabelText('Report note');
  expect(flag).toHaveAttribute('role', 'button');
  expect(flag).toHaveAttribute('accessibility-traits', 'button');
});

test('a time says how long ago in words to a screen reader', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  const { queries } = startApp();
  await queries.findByText('Friendly finish');

  const time = root().querySelector('.note-time')!;
  expect(time.textContent).toMatch(/^· \d+[mhdw] ago$|^· \d+ \w+ \d{4}$/);
  expect(time.getAttribute('accessibility-label')).toMatch(/ago$|\d{4}$/);
});
