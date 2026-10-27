import { expect, test } from 'vitest';

import { GRADE_TIERS, gradeSpread, tierLabels, tierOf } from '../grade-tiers.js';
import { route } from '../pages/main/__tests__/fakeApi.js';

const rated = (public_grade: string) => ({ ...route, public_grade });

test('folds the eighteen grades into six tiers', () => {
  expect(
    ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V10', 'V11', 'V17'].map(tierOf)
  ).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  expect(GRADE_TIERS.map(({ label }) => label)).toEqual([
    'V0–1',
    'V2–3',
    'V4–5',
    'V6–7',
    'V8–10',
    'V11+',
  ]);
});

test('puts a route nobody has graded in no tier', () => {
  expect(tierOf('')).toBe(0);
  expect(tierOf(null)).toBe(0);
  expect(tierOf('V99')).toBe(0);
});

test('counts the routes in each tier that has any, easiest first', () => {
  const spread = gradeSpread([rated('V9'), rated('V2'), rated('V8'), rated(''), rated('V3')]);

  expect(spread.map(({ tier, count }) => [tier.label, count])).toEqual([
    ['V2–3', 2],
    ['V8–10', 2],
  ]);
});

test('names tiers for a sentence', () => {
  expect(tierLabels([3, 4])).toBe('V4–5 and V6–7');
});
