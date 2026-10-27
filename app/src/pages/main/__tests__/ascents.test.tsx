import { beforeEach, expect, test } from 'vitest';

import {
  NOW,
  enterField,
  fieldValue,
  note,
  resetHost,
  route,
  sessionStore,
  startApp,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  sessionStore('saved-token');
});

const logged = { sent: true, grade: 'V5', note: 'Sticky start', updated_at: NOW - 60 };
const pressed = (queries: { getByLabelText(label: string): HTMLElement }, label: string) =>
  queries.getByLabelText(label).getAttribute('aria-pressed');

test('asks whether the climb was sent, and shows nothing more until it is answered', async () => {
  const { queries } = startApp();

  await queries.findByText('Your ascent');

  expect(queries.getByLabelText('Sent it')).toHaveAttribute('aria-pressed', 'false');
  expect(queries.getByLabelText('Projecting')).toHaveAttribute('aria-pressed', 'false');
  expect(queries.queryByLabelText('Suggest V5')).not.toBeInTheDocument();
  expect(queries.queryByText('Save ascent')).not.toBeInTheDocument();
});

test('offers all eighteen grades once the choice is made, with the public one marked', async () => {
  const { queries } = startApp();
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Sent it');

  expect(pressed(queries, 'Sent it')).toBe('true');
  expect(queries.getAllByLabelText(/^Suggest V/)).toHaveLength(18);
  expect(queries.getByLabelText('Suggest V4, current public grade')).toBeInTheDocument();
  expect(queries.getByText('Public')).toBeInTheDocument();
  expect(queries.getByText('0/500')).toBeInTheDocument();
});

test('says a grade counts toward the public grade only once the climb is sent', async () => {
  const { queries } = startApp();
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Sent it');
  expect(
    queries.getByText('Your grade counts toward the public grade because you sent it.')
  ).toBeInTheDocument();

  await tapLabel(queries, 'Projecting');
  expect(
    queries.getByText(
      "Saved with your ascent, but it only counts toward the public grade once you've sent it."
    )
  ).toBeInTheDocument();
  expect(pressed(queries, 'Projecting')).toBe('true');
  expect(pressed(queries, 'Sent it')).toBe('false');
});

test('saves a send with its grade and note, then summarizes it', async () => {
  const { api, queries } = startApp({
    logAscent: ({ body }) => ({
      ...route,
      sends: 4,
      public_grade: 'V5',
      my_ascent: {
        sent: true,
        grade: body.grade ?? null,
        note: body.note ?? null,
        updated_at: NOW,
      },
    }),
  });
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Sent it');
  await tapLabel(queries, 'Suggest V5');
  expect(queries.getByText('Yours')).toBeInTheDocument();
  await enterField(queries, 'Note (optional)', ' Sticky start ');
  await tapText(queries, 'Save ascent');

  expect(await queries.findByText('Ascent saved.')).toBeInTheDocument();
  expect(api.to('logAscent')).toMatchObject([
    {
      param: 'blue',
      token: 'saved-token',
      body: { sent: true, grade: 'V5', note: 'Sticky start' },
    },
  ]);
  expect(queries.getByLabelText('4 sends')).toBeInTheDocument();
  expect(queries.getByText('Sticky start')).toBeInTheDocument();
  expect(queries.getByText('Your grade')).toBeInTheDocument();
  expect(queries.getByText('Edit')).toBeInTheDocument();
  expect(queries.queryByText('Save ascent')).not.toBeInTheDocument();
});

test('does not require a grade, or a note', async () => {
  const { api, queries } = startApp();
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Sent it');
  await tapText(queries, 'Save ascent');

  await queries.findByText('Ascent saved.');
  expect(api.to('logAscent')[0].body).toEqual({ sent: true, grade: null, note: null });
});

test('keeps the grade of a project, which counts once it is sent', async () => {
  const { api, queries } = startApp();
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Projecting');
  await tapLabel(queries, 'Suggest V6');
  await tapText(queries, 'Save ascent');

  await queries.findByText('Ascent saved.');
  expect(api.to('logAscent')[0].body).toEqual({ sent: false, grade: 'V6', note: null });
});

test('clears a grade when it is chosen again', async () => {
  const { api, queries } = startApp();
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Sent it');
  await tapLabel(queries, 'Suggest V6');
  expect(pressed(queries, 'Suggest V6')).toBe('true');
  await tapLabel(queries, 'Suggest V6');
  expect(pressed(queries, 'Suggest V6')).toBe('false');
  await tapText(queries, 'Save ascent');

  await queries.findByText('Ascent saved.');
  expect(api.to('logAscent')[0].body.grade).toBeNull();
});

test('starts from the climber’s existing ascent, to edit or to remove', async () => {
  const { api, queries } = startApp({
    route: () => ({ ...route, my_ascent: logged }),
    removeAscent: () => ({ ...route, sends: 2, my_ascent: null }),
  });

  await queries.findByText('Sticky start');
  expect(queries.getByText('Sent', { selector: '.ascent-badges *' })).toBeInTheDocument();
  expect(queries.queryByText('Save ascent')).not.toBeInTheDocument();

  await tapText(queries, 'Edit');
  expect(pressed(queries, 'Suggest V5')).toBe('true');
  expect(fieldValue(queries, 'Note (optional)')).toBe('Sticky start');
  expect(queries.getByText('Editing')).toBeInTheDocument();
  await tapText(queries, 'Save ascent');
  await queries.findByText('Ascent saved.');
  expect(api.to('logAscent')[0].body).toEqual({ sent: true, grade: 'V5', note: 'Sticky start' });
});

test('removes an ascent from its summary, which returns the card to the prompt', async () => {
  const { api, queries } = startApp({
    route: () => ({ ...route, my_ascent: logged }),
    removeAscent: () => ({ ...route, sends: 2, my_ascent: null }),
  });
  await queries.findByText('Sticky start');

  await tapText(queries, 'Remove');

  expect(await queries.findByText('Ascent removed.')).toBeInTheDocument();
  expect(api.to('removeAscent')).toMatchObject([{ param: 'blue', token: 'saved-token' }]);
  expect(queries.getByLabelText('2 sends')).toBeInTheDocument();
  expect(queries.getByLabelText('Sent it')).toBeInTheDocument();
  expect(queries.queryByText('Sticky start')).not.toBeInTheDocument();
});

test('removes an ascent while editing it', async () => {
  const { api, queries } = startApp({
    route: () => ({ ...route, my_ascent: logged }),
    removeAscent: () => ({ ...route, my_ascent: null }),
  });
  await queries.findByText('Sticky start');

  await tapText(queries, 'Edit');
  await tapText(queries, 'Remove my ascent');

  expect(await queries.findByText('Ascent removed.')).toBeInTheDocument();
  expect(api.to('removeAscent')).toHaveLength(1);
  expect(queries.queryByText('Save ascent')).not.toBeInTheDocument();
});

test('offers no removal before an ascent is logged', async () => {
  const { queries } = startApp();
  await queries.findByText('Your ascent');
  await tapLabel(queries, 'Sent it');

  expect(queries.queryByText('Remove my ascent')).not.toBeInTheDocument();
  expect(queries.queryByText('Remove')).not.toBeInTheDocument();
});

test('says a summary has no note when none was left', async () => {
  const { queries } = startApp({
    route: () => ({ ...route, my_ascent: { ...logged, note: null } }),
  });

  expect(await queries.findByText('No note added.')).toBeInTheDocument();
});

test('limits notes to the length the server accepts', async () => {
  const { queries } = startApp();
  await queries.findByText('Your ascent');

  await tapLabel(queries, 'Projecting');

  expect(await queries.findByLabelText('Note (optional)')).toHaveAttribute('maxlength', '500');
});

test('lists each note with its author, send, grade and age', async () => {
  const { queries } = startApp({
    notes: () => [
      note,
      {
        ...note,
        id: 'attempt',
        author: { username: 'ada', display_name: 'Ada' },
        sent: false,
        grade: null,
        note: 'Too reachy',
        updated_at: NOW - 30,
      },
    ],
  });

  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
  expect(queries.getByText('Leon')).toBeInTheDocument();
  expect(queries.getAllByText('Sent')).toHaveLength(1);
  expect(queries.getByText('Projecting', { selector: '.badge-label' })).toBeInTheDocument();
  expect(queries.getByText('V5', { selector: '.tag-num' })).toBeInTheDocument();
  expect(queries.getByText('Too reachy')).toBeInTheDocument();
  expect(queries.getByText('2 notes')).toBeInTheDocument();
});

test('highlights the climber’s own note', async () => {
  const { queries } = startApp({
    notes: () => [{ ...note, id: 'mine', author: { username: 'maya', display_name: 'Maya Tan' } }],
  });

  await queries.findByText('Friendly finish');

  expect(elementTree.root!.querySelector('.note')!.className).toContain('is-mine');
});

test('keeps the notes on screen while they are refreshed after saving', async () => {
  let release: (notes: (typeof note)[]) => void = () => {};
  let first = true;
  const { api, queries } = startApp({
    notes: () => {
      if (first) {
        first = false;
        return [note];
      }
      return new Promise((resolve) => (release = resolve));
    },
  });
  await queries.findByText('Friendly finish');

  await tapLabel(queries, 'Projecting');
  await tapText(queries, 'Save ascent');
  await queries.findByText('Ascent saved.');

  expect(api.to('notes')).toHaveLength(2);
  expect(queries.getByText('Friendly finish')).toBeInTheDocument();
  expect(elementTree.root!.querySelector('.note-skeletons')).toBeNull();

  release([note, { ...note, id: 'mine', note: 'Mine now' }]);
  expect(await queries.findByText('Mine now')).toBeInTheDocument();
});

test('starts the grade picker with the chosen grade in view', async () => {
  const { queries } = startApp({
    route: () => ({ ...route, my_ascent: { ...logged, grade: 'V8' } }),
  });
  await queries.findByText('Sticky start');
  await tapText(queries, 'Edit');

  const scroller = elementTree.root!.querySelector('.picker-scroll')!;

  // Each tile takes 66px; the one before the chosen grade is in view too.
  expect(scroller).toHaveAttribute('initial-scroll-offset', String(7 * 66));
});

test('starts the grade picker from its first tile when no grade is chosen', async () => {
  const { queries } = startApp();
  await queries.findByText('Your ascent');
  await tapLabel(queries, 'Sent it');

  expect(elementTree.root!.querySelector('.picker-scroll')).toHaveAttribute(
    'initial-scroll-offset',
    '0'
  );
});
