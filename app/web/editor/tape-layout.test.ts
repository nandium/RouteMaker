import { describe, expect, it } from 'vitest';

import { type Annotation, TAPE_LIMIT, type TapeKind } from './route-annotations.js';
import { layoutTape } from './tape-layout.js';

const photo = { width: 1000, height: 1000 };
const HALO = 18;

function hold(overrides: Partial<Annotation> = {}, tapes = { start: 0, finish: 0 }): Annotation {
  return { x: 0.4, y: 0.4, width: 0.1, height: 0.1, use: 'any', order: 1, tapes, ...overrides };
}

describe('tape layout', () => {
  it.each<[TapeKind, number]>([
    ['start', TAPE_LIMIT.start],
    ['finish', TAPE_LIMIT.finish],
  ])('lays %s strips side by side, longer than thick, inside the photo', (kind, count) => {
    const annotation = hold({ x: 0.45, y: 0.45 }, { start: 0, finish: 0 });
    annotation.tapes[kind] = count;

    const strips = layoutTape(annotation, kind, photo, HALO);

    expect(strips).toHaveLength(count);
    for (const strip of strips) {
      expect(Math.max(strip.width, strip.height)).toBeGreaterThan(
        2 * Math.min(strip.width, strip.height)
      );
      expect(strip.left).toBeGreaterThanOrEqual(0);
      expect(strip.top).toBeGreaterThanOrEqual(0);
      expect(strip.left + strip.width).toBeLessThanOrEqual(photo.width);
      expect(strip.top + strip.height).toBeLessThanOrEqual(photo.height);
    }
    // Side by side: neighbours share a size and never overlap.
    for (const [index, strip] of strips.slice(1).entries()) {
      const previous = strips[index];
      expect([strip.width, strip.height]).toEqual([previous.width, previous.height]);
      const apart =
        strip.left >= previous.left + previous.width ||
        previous.left >= strip.left + strip.width ||
        strip.top >= previous.top + previous.height ||
        previous.top >= strip.top + strip.height;
      expect(apart).toBe(true);
    }
  });

  it.each([
    ['left of', 'start', hold({}, { start: 2, finish: 0 })],
    ['right of', 'finish', hold({}, { start: 0, finish: 2 })],
    ['above', 'start', hold({ x: 0.05 }, { start: 2, finish: 0 })],
    ['below', 'finish', hold({ x: 0.9, width: 0.09 }, { start: 0, finish: 2 })],
  ] as const)('puts the tape %s the hold, clear of its outline', (place, kind, annotation) => {
    const box = {
      left: annotation.x * photo.width,
      top: annotation.y * photo.height,
      right: (annotation.x + annotation.width) * photo.width,
      bottom: (annotation.y + annotation.height) * photo.height,
    };

    for (const strip of layoutTape(annotation, kind, photo, HALO)) {
      if (place === 'left of') expect(strip.left + strip.width).toBeLessThan(box.left - HALO / 2);
      if (place === 'right of') expect(strip.left).toBeGreaterThan(box.right + HALO / 2);
      if (place === 'above') expect(strip.top + strip.height).toBeLessThan(box.top - HALO / 2);
      if (place === 'below') expect(strip.top).toBeGreaterThan(box.bottom + HALO / 2);
    }
  });

  it('moves strips away from the boundary one after another', () => {
    const strips = layoutTape(hold({}, { start: 3, finish: 0 }), 'start', photo, HALO);

    expect(strips[1].left).toBeLessThan(strips[0].left);
    expect(strips[2].left).toBeLessThan(strips[1].left);
  });

  it('keeps strips a readable size on a small photo', () => {
    const [strip] = layoutTape(
      hold({ height: 0.5 }, { start: 1, finish: 0 }),
      'start',
      { width: 100, height: 100 },
      3
    );

    expect(strip.height).toBeGreaterThanOrEqual(20);
    expect(strip.width).toBeGreaterThanOrEqual(4);
  });

  it('returns nothing for a hold without that tape', () => {
    expect(layoutTape(hold(), 'start', photo, HALO)).toEqual([]);
  });
});
