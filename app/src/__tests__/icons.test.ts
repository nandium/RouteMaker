import { describe, expect, test } from 'vitest';

import { ICON_PALETTE, iconSvg } from '../icons.js';

describe('themed icons', () => {
  test('embeds explicit theme colors instead of relying on CSS inheritance', () => {
    const light = iconSvg('map', ICON_PALETTE.light.base);
    const dark = iconSvg('map', ICON_PALETTE.dark.base);

    expect(light).toContain(`stroke="${ICON_PALETTE.light.base}"`);
    expect(dark).toContain(`stroke="${ICON_PALETTE.dark.base}"`);
    expect(dark).not.toContain('currentColor');
    expect(dark).not.toBe(light);
  });

  test('keeps interface icon colors independent from logo experiments', () => {
    expect(ICON_PALETTE.light.active).toBe('#b74425');
    expect(ICON_PALETTE.dark.active).toBe('#ff9873');
  });
});
