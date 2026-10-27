import { expect, test } from 'vitest';

import { plural } from '../plural.js';

test('writes counts with their noun', () => {
  expect(plural(1, 'send')).toBe('1 send');
  expect(plural(0, 'send')).toBe('0 sends');
});
