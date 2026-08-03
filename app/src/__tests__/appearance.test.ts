import { expect, test } from 'vitest';

import { resolveColorScheme } from '../appearance.js';

test('uses the host scheme until a visitor chooses light or dark', () => {
  expect(resolveColorScheme(null, 'dark')).toBe('dark');
  expect(resolveColorScheme(null, 'light')).toBe('light');
  expect(resolveColorScheme('light', 'dark')).toBe('light');
});
