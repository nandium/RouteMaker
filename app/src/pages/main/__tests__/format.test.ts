import { expect, test } from 'vitest';

import { timeAgo, timeAgoSpoken } from '../format.js';

const now = Date.UTC(2026, 9, 27) / 1000;

test.each([
  [30, 'just now', 'just now'],
  [5 * 60, '5m ago', '5 minutes ago'],
  [60, '1m ago', '1 minute ago'],
  [3 * 3600, '3h ago', '3 hours ago'],
  [2 * 86400, '2d ago', '2 days ago'],
  [3 * 7 * 86400, '3w ago', '3 weeks ago'],
])('describes %i seconds ago as %s', (elapsed, short, spoken) => {
  expect(timeAgo(now - elapsed, now)).toBe(short);
  expect(timeAgoSpoken(now - elapsed, now)).toBe(spoken);
});

test('counts whole units, in the largest unit that fits', () => {
  expect(timeAgo(now - (86400 + 3 * 3600), now)).toBe('1d ago');
  expect(timeAgo(now - (6 * 86400 + 23 * 3600), now)).toBe('6d ago');
  expect(timeAgo(now - 7 * 86400, now)).toBe('1w ago');
});

test('gives a date, without its year when it is this year, after eight weeks', () => {
  expect(timeAgo(now - 55 * 86400, now)).toBe('7w ago');
  expect(timeAgo(now - 56 * 86400, now)).toBe('1 Sep');
  expect(timeAgo(Date.UTC(2025, 9, 24) / 1000, now)).toBe('24 Oct 2025');
  expect(timeAgoSpoken(Date.UTC(2025, 9, 24) / 1000, now)).toBe('24 Oct 2025');
});

test('never reports a time in the future', () => {
  expect(timeAgo(now + 500, now)).toBe('just now');
});
