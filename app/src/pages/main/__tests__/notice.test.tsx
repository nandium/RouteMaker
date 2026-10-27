import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import { noticeDuration } from '../chrome.js';
import {
  enterField,
  notice,
  resetHost,
  sessionStore,
  startApp,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost({ initialPage: { name: 'account' } }));
afterEach(() => vi.useRealTimers());

const save = async (queries: Parameters<typeof tapText>[0]) => {
  await enterField(queries, 'Display name', 'Maya T.');
  await tapText(queries, 'Save profile');
};

test('a success goes by itself after a few seconds', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  await save(queries);
  expect(await queries.findByText('Profile saved.')).toBeInTheDocument();

  vi.useFakeTimers();
  // The timer starts when the notice appears, so a fresh notice is needed under fake timers.
  await save(queries);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(4100);

  await vi.waitFor(() => expect(notice()).toBeUndefined());
});

test('an error stays until it is dismissed', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({
    updateProfile: () => {
      throw new ApiError('Display name is taken', 409);
    },
  });
  await queries.findByText('Delete account');
  await save(queries);
  expect(await queries.findByText('Display name is taken')).toBeInTheDocument();

  vi.useFakeTimers();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(notice()).toBe('Display name is taken');

  await tapLabel(queries, 'Dismiss message');
  expect(notice()).toBeUndefined();
});

test('gives errors and successes their own look and announcement', async () => {
  sessionStore('saved-token');
  const { queries } = startApp({
    updateProfile: () => {
      throw new ApiError('Display name is taken', 409);
    },
  });
  await queries.findByText('Delete account');

  await save(queries);
  await queries.findByText('Display name is taken');

  expect(elementTree.root!.querySelector('.notice')!.className).toContain('is-error');
});

test('a notice announces itself to a native screen reader', async () => {
  const announce = vi.fn();
  lynx.accessibilityAnnounce = announce;
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');

  await save(queries);
  await queries.findByText('Profile saved.');

  expect(announce).toHaveBeenCalledWith({ content: 'Profile saved.' });
  lynx.accessibilityAnnounce = undefined;
});

test('the notice slot is a live region that is there before any notice, for the web', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  const slot = () => elementTree.root!.querySelector('.notice-slot')!;
  expect(slot()).toHaveAttribute('role', 'status');
  expect(slot().querySelector('.notice')).toBeNull();

  await save(queries);
  await queries.findByText('Profile saved.');

  expect(slot().querySelector('.notice-text')!.textContent).toBe('Profile saved.');
});

test.each([
  ['a short message', 'Saved.', 4000],
  ['a sentence', 'Report sent to the moderators.', 4000],
  [
    'instructions',
    'Check your email for a verification link. Open it in your browser, then return here and sign in.',
    7300,
  ],
  ['a very long message', 'x'.repeat(1000), 12_000],
])('keeps %s for a time that grows with its length, within limits', (_what, text, ms) => {
  expect(noticeDuration(text)).toBe(ms);
});

test('long instructions stay on screen longer than a short success', async () => {
  resetHost({ initialPage: { name: 'forgot-password' } });
  const { queries } = startApp();
  await enterField(queries, 'Email', 'maya@example.com');

  vi.useFakeTimers();
  await tapText(queries, 'Send reset link');
  await vi.advanceTimersByTimeAsync(0);
  expect(notice()).toContain('password-reset link');

  await vi.advanceTimersByTimeAsync(4100);
  expect(notice()).toContain('password-reset link');

  await vi.advanceTimersByTimeAsync(5000);
  await vi.waitFor(() => expect(notice()).toBeUndefined());
});

test('a newer notice restarts the clock, so it is not cut short by the one before', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  await enterField(queries, 'Display name', 'Maya T.');

  vi.useFakeTimers();
  await tapText(queries, 'Save profile');
  await vi.advanceTimersByTimeAsync(3000);
  expect(notice()).toBe('Profile saved.');

  await tapText(queries, 'Save profile');
  await vi.advanceTimersByTimeAsync(1500);
  // 4.5 seconds after the first notice, which would have gone by now.
  expect(notice()).toBe('Profile saved.');

  await vi.advanceTimersByTimeAsync(3000);
  await vi.waitFor(() => expect(notice()).toBeUndefined());
});
