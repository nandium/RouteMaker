import { describe, expect, it } from 'vitest';

import {
  type Annotation,
  annotationAt,
  annotationFromBox,
  candidate,
  clearSelection,
  nextOrder,
  routeLabels,
  selectedAnnotations,
  TAPE_LIMIT,
  tapeTotal,
  toPixels,
} from './route-annotations.js';

function annotation(
  overrides: Partial<Annotation> = {},
  tapes = { start: 0, finish: 0 }
): Annotation {
  return { x: 0.4, y: 0.4, width: 0.1, height: 0.1, use: 'any', order: 1, tapes, ...overrides };
}

describe('boxes in pixels', () => {
  it('scales a normalised box to a photo or screen of any size', () => {
    expect(
      toPixels({ x: 0.25, y: 0.5, width: 0.1, height: 0.2 }, { width: 800, height: 600 })
    ).toEqual({
      left: 200,
      top: 300,
      width: 80,
      height: 120,
    });
  });
});

describe('hold boundaries', () => {
  it('centres a standard boundary on the tap and keeps it inside the photo', () => {
    expect(annotationAt(0, 1, 'hand', 2)).toEqual({
      x: 0,
      y: 1 - 0.06,
      width: 0.08,
      height: 0.06,
      use: 'hand',
      order: 2,
      tapes: { start: 0, finish: 0 },
    });
  });

  it('draws a boundary from either corner and clips it to the photo', () => {
    const drawn = annotationFromBox(0.8, 0.7, -0.2, 1.2, 'hand', 3);

    expect(drawn).toMatchObject({ x: 0, y: 0.7, width: 0.8, use: 'hand', order: 3 });
    expect(drawn.height).toBeCloseTo(0.3);
  });

  it('turns a detection into an unselected candidate and can clear a selection back to one', () => {
    const chosen = annotation({}, { start: 2, finish: 0 });
    expect(candidate(chosen)).toMatchObject({
      use: null,
      order: null,
      tapes: { start: 0, finish: 0 },
    });

    clearSelection(chosen);

    expect(chosen).toMatchObject({ use: null, order: null, tapes: { start: 0, finish: 0 } });
  });

  it('numbers the next selection after the highest order still in use', () => {
    expect(nextOrder([])).toBe(1);
    expect(
      nextOrder([annotation({ order: 4 }), annotation({ order: 2 }), annotation({ order: null })])
    ).toBe(5);
  });

  it('counts tape strips across the route', () => {
    const holds = [
      annotation({}, { start: 3, finish: 0 }),
      annotation({}, { start: 1, finish: 2 }),
    ];

    expect(tapeTotal(holds, 'start')).toBe(TAPE_LIMIT.start);
    expect(tapeTotal(holds, 'finish')).toBe(TAPE_LIMIT.finish);
  });
});

describe('marker text', () => {
  it('numbers hand-usable holds by selection order and leaves feet unnumbered', () => {
    const holds = [
      annotation({ use: 'foot', order: 1 }),
      annotation({ use: 'hand', order: 3 }),
      annotation({ use: null, order: null }),
      annotation({ use: 'any', order: 2 }),
    ];

    const numbers = routeLabels(holds, true);

    expect(selectedAnnotations(holds)).toHaveLength(3);
    expect([holds[3], holds[1], holds[0]].map((hold) => numbers.get(hold))).toEqual([
      '1',
      '2',
      'F',
    ]);
    expect(numbers.has(holds[2])).toBe(false);
  });

  it('shows the limb instead of a number when numbers are off', () => {
    const holds = [
      annotation({ use: 'hand' }),
      annotation({ use: 'foot' }),
      annotation({ use: 'any' }),
    ];

    const letters = routeLabels(holds, false);

    expect(holds.map((hold) => letters.get(hold))).toEqual(['H', 'F', 'A']);
  });

  it('puts start holds first and finish holds last whatever the selection order', () => {
    const holds = [
      annotation({ use: 'hand', order: 1 }, { start: 0, finish: 1 }),
      annotation({ use: 'any', order: 2 }),
      annotation({ use: 'foot', order: 3 }, { start: 4, finish: 0 }),
      annotation({ use: 'hand', order: 4 }, { start: 1, finish: 0 }),
      annotation({ use: 'foot', order: 5 }),
    ];

    const labels = routeLabels(holds, true);

    expect(
      [holds[2], holds[3], holds[1], holds[0], holds[4]].map((hold) => labels.get(hold))
    ).toEqual(['1', '2', '3', '4', 'F']);
  });
});
