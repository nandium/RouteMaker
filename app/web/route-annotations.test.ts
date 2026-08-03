import { describe, expect, it } from 'vitest';

import {
  type Annotation,
  annotationAt,
  annotationFromBox,
  expandedHitTarget,
  layoutTape,
  nearestVisualTarget,
  ROUTE_MARKING,
  selectedAnnotations,
  tapeBounds,
  tapeTotal,
} from './route-annotations.js';
import { annotationLabel, holdUseLabel } from './route-annotation-labels.js';

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    x: 0.4,
    y: 0.4,
    width: 0.1,
    height: 0.1,
    use: 'any',
    order: 1,
    start_tapes: 0,
    finish_tapes: 0,
    ...overrides,
  };
}

describe('route annotations', () => {
  it('creates bounded, inactive markers', () => {
    expect(annotationAt(0, 1)).toEqual({
      x: 0,
      y: 1 - ROUTE_MARKING.markerHeight,
      width: ROUTE_MARKING.markerWidth,
      height: ROUTE_MARKING.markerHeight,
      use: null,
      order: null,
      start_tapes: 0,
      finish_tapes: 0,
    });
  });

  it('creates a bounded custom box in either drag direction', () => {
    const custom = annotationFromBox(0.8, 0.7, -0.2, 1.2, 'hand', 3);
    expect(custom).toMatchObject({
      x: 0,
      y: 0.7,
      width: 0.8,
      use: 'hand',
      order: 3,
      start_tapes: 0,
      finish_tapes: 0,
    });
    expect(custom.height).toBeCloseTo(0.3);
  });

  it('numbers hand-usable holds by selection order and leaves feet unnumbered', () => {
    const holds = [
      annotation({ use: 'foot', order: 1 }),
      annotation({ use: 'hand', order: 3 }),
      annotation({ use: null, order: null }),
      annotation({ use: 'any', order: 2 }),
    ];

    expect(selectedAnnotations(holds)).toHaveLength(3);
    expect(annotationLabel(holds[1], holds, true)).toBe('2');
    expect(annotationLabel(holds[3], holds, true)).toBe('1');
    expect(annotationLabel(holds[0], holds, true)).toBe('F');
    expect(annotationLabel(holds[1], holds, false)).toBe('H');
    expect(annotationLabel(holds[3], holds, false)).toBe('A');
  });

  it('numbers start holds first and finish holds last regardless of selection order', () => {
    const holds = [
      annotation({ use: 'hand', order: 1, finish_tapes: 1 }),
      annotation({ use: 'any', order: 2 }),
      annotation({ use: 'foot', order: 3, start_tapes: 4 }),
      annotation({ use: 'hand', order: 4, start_tapes: 1 }),
      annotation({ use: 'foot', order: 5 }),
    ];

    expect(annotationLabel(holds[2], holds, true)).toBe('1');
    expect(annotationLabel(holds[3], holds, true)).toBe('2');
    expect(annotationLabel(holds[1], holds, true)).toBe('3');
    expect(annotationLabel(holds[0], holds, true)).toBe('4');
    expect(annotationLabel(holds[4], holds, true)).toBe('F');
  });

  it('counts distributed tape strips across the route', () => {
    const holds = [annotation({ start_tapes: 3 }), annotation({ start_tapes: 1, finish_tapes: 2 })];

    expect(tapeTotal(holds, 'start')).toBe(ROUTE_MARKING.maxStartTapes);
    expect(tapeTotal(holds, 'finish')).toBe(ROUTE_MARKING.maxFinishTapes);
  });

  it('keeps hold-use language in one shared vocabulary', () => {
    expect(holdUseLabel('any')).toBe('Any limb');
    expect(holdUseLabel('hand')).toBe('Hand only');
    expect(holdUseLabel('foot')).toBe('Foot only');
  });

  it.each([
    ['start', ROUTE_MARKING.maxStartTapes],
    ['finish', ROUTE_MARKING.maxFinishTapes],
  ] as const)('keeps %s tape strips inside the image and longer than wide', (kind, count) => {
    const width = 1600;
    const height = 1067;
    const strips = layoutTape(
      annotation({ x: 0, y: 0, width: 0.05, height: 0.05 }),
      count,
      kind,
      width,
      height
    );

    expect(strips).toHaveLength(count);
    strips.forEach((strip) => {
      expect(strip.left).toBeGreaterThanOrEqual(0);
      expect(strip.top).toBeGreaterThanOrEqual(0);
      expect(strip.left + strip.width).toBeLessThanOrEqual(width);
      expect(strip.top + strip.height).toBeLessThanOrEqual(height);
      expect(Math.max(strip.width, strip.height)).toBeGreaterThan(
        Math.min(strip.width, strip.height)
      );
      strip.points.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(strip.width);
        expect(y).toBeLessThanOrEqual(strip.height);
      });
    });
  });

  it.each([
    ['left', 'start', annotation()],
    ['right', 'finish', annotation()],
    ['bottom', 'start', annotation({ x: 0.05, y: 0, width: 0.9, height: 0.05 })],
    ['top', 'finish', annotation({ x: 0.05, y: 0.9, width: 0.9, height: 0.05 })],
  ] as const)(
    'angles tape toward the hold from the %s while keeping short edges parallel',
    (side, kind, hold) => {
      const [strip] = layoutTape(hold, 1, kind, 1000, 1000);

      expect(strip.side).toBe(side);
      if (side === 'left' || side === 'right') {
        expect(strip.width).toBeGreaterThan(strip.height);
        expect(strip.points[0][0]).toBe(strip.points[3][0]);
        expect(strip.points[1][0]).toBe(strip.points[2][0]);
        expect(strip.points[0][1]).not.toBe(strip.points[1][1]);
      } else {
        expect(strip.height).toBeGreaterThan(strip.width);
        expect(strip.points[0][1]).toBe(strip.points[1][1]);
        expect(strip.points[2][1]).toBe(strip.points[3][1]);
        expect(strip.points[0][0]).not.toBe(strip.points[2][0]);
      }
    }
  );

  it('keeps edge hit targets fully inside the photo', () => {
    expect(expandedHitTarget({ left: 0, top: 0, width: 10, height: 10 }, 100, 100)).toEqual({
      left: 0,
      top: 0,
      width: ROUTE_MARKING.minimumHitTarget,
      height: ROUTE_MARKING.minimumHitTarget,
    });
    expect(expandedHitTarget({ left: 95, top: 95, width: 5, height: 5 }, 100, 100)).toEqual({
      left: 100 - ROUTE_MARKING.minimumHitTarget,
      top: 100 - ROUTE_MARKING.minimumHitTarget,
      width: ROUTE_MARKING.minimumHitTarget,
      height: ROUTE_MARKING.minimumHitTarget,
    });
  });

  it('combines parallel strips into one removable hit region', () => {
    const strips = layoutTape(annotation(), ROUTE_MARKING.maxStartTapes, 'start', 1000, 1000);
    const bounds = tapeBounds(strips);

    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(bounds!.height);
    expect(expandedHitTarget(bounds!, 1000, 1000).height).toBeGreaterThanOrEqual(
      ROUTE_MARKING.minimumHitTarget
    );
  });

  it('uses visible geometry to disambiguate overlapping touch targets', () => {
    const marker = { left: 115, top: 96, width: 26, height: 14 };
    const tape = { left: 101, top: 96, width: 13, height: 14 };
    const targets = [
      {
        box: marker,
        hitBox: expandedHitTarget(marker, 320, 240),
        value: 'marker',
      },
      {
        box: tape,
        hitBox: expandedHitTarget(tape, 320, 240),
        value: 'tape',
      },
    ];

    expect(nearestVisualTarget(128, 103, targets)).toBe('marker');
    expect(nearestVisualTarget(107, 103, targets)).toBe('tape');
    expect(nearestVisualTarget(10, 10, targets)).toBeNull();
  });

  it('keeps the full clipped edge target active', () => {
    const box = { left: 0, top: 10, width: 5, height: 5 };
    const targets = [
      {
        box,
        hitBox: expandedHitTarget(box, 100, 100),
        value: 'edge hold',
      },
    ];

    expect(nearestVisualTarget(40, 20, targets)).toBe('edge hold');
  });

  it('returns no tape when an image is too small to contain a strip', () => {
    expect(layoutTape(annotation(), 1, 'start', 1, 1)).toEqual([]);
  });
});
