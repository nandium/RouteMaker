import { expect, test } from 'vitest';

import { ICON_COLORS, iconColor, iconSvg } from '../icons.js';

test('embeds explicit colors instead of relying on CSS inheritance', () => {
  const light = iconSvg('map', ICON_COLORS.light.ink);
  const dark = iconSvg('map', ICON_COLORS.dark.ink);

  expect(light).toContain(`stroke="${ICON_COLORS.light.ink}"`);
  expect(dark).toContain(`stroke="${ICON_COLORS.dark.ink}"`);
  expect(dark).not.toContain('currentColor');
  expect(dark).not.toBe(light);
});

test('fills the shapes that are drawn solid and dashes the ones that are dashed', () => {
  expect(iconSvg('like-on', '#123456')).toContain('fill="#123456"');
  expect(iconSvg('proj', '#123456')).toContain('stroke-dasharray');
});

test('draws thinner strokes at small sizes', () => {
  expect(iconSvg('check', '#000', 16)).toContain('stroke-width="2.2"');
  expect(iconSvg('check', '#000', 24)).toContain('stroke-width="2"');
});

test('picks a tone from the scheme', () => {
  expect(iconColor('light', 'link')).toBe(ICON_COLORS.light.link);
  expect(iconColor('dark', 'link')).toBe(ICON_COLORS.dark.link);
});
