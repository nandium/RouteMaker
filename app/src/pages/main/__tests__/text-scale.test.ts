import { expect, test } from 'vitest';

import { displayStyle, glyphStyle, iconScale, textSizeClasses } from '../text-scale.js';

test('leaves display and glyph text at their size until the system size reaches the cap', () => {
  expect(displayStyle(44, 52, 1)).toEqual({ fontSize: '44px', lineHeight: '1.18' });
  expect(displayStyle(44, 52, 1.5)).toEqual({ fontSize: '44px', lineHeight: '1.18' });
  expect(glyphStyle(26, 28, 1.3)).toEqual({ fontSize: '26px', lineHeight: '1.08' });
});

test('shrinks them by the factor the system will enlarge them beyond the cap', () => {
  // 3x text on a 150% cap: 44 * 1.5 / 3 = 22, which the system makes 66.
  expect(displayStyle(44, 52, 3).fontSize).toBe('22px');
  expect(glyphStyle(26, 28, 2).fontSize).toBe('16.9px');
});

test('sets line height as a ratio, which keeps pace with the text whatever size it ends up', () => {
  expect(displayStyle(44, 52, 3).lineHeight).toBe(displayStyle(44, 52, 1).lineHeight);
});

test('keeps a line taller than its text, which Lynx would otherwise clip', () => {
  expect(displayStyle(44, 44, 1).lineHeight).toBe('1.05');
  expect(displayStyle(56, 54, 1).lineHeight).toBe('1.05');
});

test('adds the layout classes at 130% and 200%', () => {
  expect(textSizeClasses(1)).toBe('');
  expect(textSizeClasses(1.29)).toBe('');
  expect(textSizeClasses(1.3)).toBe('fs-lg');
  expect(textSizeClasses(1.99)).toBe('fs-lg');
  expect(textSizeClasses(2)).toBe('fs-lg fs-xl');
});

test('enlarges icons in two steps', () => {
  expect([1, 1.3, 1.9, 2, 3].map(iconScale)).toEqual([1, 1.25, 1.25, 1.6, 1.6]);
});
