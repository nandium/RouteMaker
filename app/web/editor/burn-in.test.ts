import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MARK_COLORS } from '../../src/marking-colors.js';
import { installDom } from '../test-dom.js';
import {
  createSvg,
  LABEL_FONT_FAMILY,
  LABEL_FONT_WEIGHT,
  markShapes,
  paintCanvas,
  paintSvg,
  placeChip,
  type Shape,
  tapeStrip,
} from './burn-in.js';
import { type Annotation, routeLabels } from './route-annotations.js';

const photo = { width: 1200, height: 1600 };

function hold(overrides: Partial<Annotation> = {}): Annotation {
  return {
    x: 0.4,
    y: 0.4,
    width: 0.1,
    height: 0.08,
    use: 'hand',
    order: 1,
    tapes: { start: 0, finish: 0 },
    ...overrides,
  };
}

const shapes = (annotations: Annotation[], size = photo) =>
  markShapes(annotations, routeLabels(annotations, true), size);

/** Every colour a shape uses. */
function coloursOf(list: readonly Shape[]) {
  const found = new Set<string>();
  for (const shape of list) {
    if (shape.type === 'rect') {
      if (shape.fill) found.add(shape.fill);
      if (shape.stroke) found.add(shape.stroke);
    } else if (shape.type === 'hatch') {
      found.add(shape.fill).add(shape.stripe.color);
    } else {
      found.add(shape.fill);
    }
  }
  return found;
}

describe('marking palette', () => {
  it('is all a photo is drawn with', () => {
    const annotations = [
      hold({ use: 'hand', tapes: { start: 2, finish: 0 } }),
      hold({ x: 0.1, use: 'foot' }),
      hold({ x: 0.7, use: 'any', tapes: { start: 0, finish: 1 } }),
      hold({ y: 0.8, use: null, order: null }),
    ];
    const palette = new Set<string>(Object.values(MARK_COLORS));

    expect([...coloursOf(shapes(annotations))].every((colour) => palette.has(colour))).toBe(true);
  });
});

describe('marking shapes', () => {
  it('draws a hold as a dark halo under a coloured outline, dashed by limb', () => {
    const [halo, outline] = shapes([hold({ use: 'foot' })]);

    expect(halo).toMatchObject({ type: 'rect', stroke: MARK_COLORS.halo, opacity: 0.78 });
    expect(outline).toMatchObject({ type: 'rect', stroke: MARK_COLORS.foot });
    expect(outline.type === 'rect' && outline.dash).toBeTruthy();
    const [, hand] = shapes([hold({ use: 'hand' })]);
    expect(hand.type === 'rect' && hand.dash).toBeUndefined();
  });

  it('marks each limb with its own silhouette: circle, triangle, rounded square', () => {
    const kinds = (use: 'hand' | 'foot' | 'any') =>
      shapes([hold({ use })])
        .slice(2)
        .map((shape) => shape.type);

    expect(kinds('hand')).toEqual(['circle', 'circle', 'text']);
    expect(kinds('foot')).toEqual(['polygon', 'polygon', 'text']);
    expect(kinds('any')).toEqual(['rect', 'rect', 'text']);
  });

  it('puts the marker on the top-right corner, so the hold stays visible', () => {
    const annotation = hold();
    const [circle] = shapes([annotation]).filter((shape) => shape.type === 'circle');

    expect(circle.type === 'circle' && circle.center).toEqual([
      (annotation.x + annotation.width) * photo.width,
      annotation.y * photo.height,
    ]);
  });

  it('writes the label in the dark halo colour on the chip', () => {
    const labelled = shapes([hold({ order: 3 })]).find((shape) => shape.type === 'text');

    expect(labelled).toMatchObject({ text: '1', fill: MARK_COLORS.halo });
  });

  it('draws unselected candidates dashed and underneath the route, without a marker', () => {
    const list = shapes([hold(), hold({ x: 0.7, use: null, order: null })]);

    expect(list[0]).toMatchObject({ stroke: MARK_COLORS.halo, opacity: 0.55 });
    expect(list[1]).toMatchObject({ stroke: MARK_COLORS.candidate, opacity: 0.9 });
    expect(list.filter((shape) => shape.type === 'text')).toHaveLength(1);
  });

  it('scales with the photo, down to a floor that keeps small photos legible', () => {
    const chipRadius = (size: { width: number; height: number }) => {
      const circle = shapes([hold()], size).find((shape) => shape.type === 'circle');
      return circle?.type === 'circle' ? circle.radius : 0;
    };

    expect(chipRadius({ width: 3000, height: 4000 })).toBeGreaterThan(chipRadius(photo));
    expect(chipRadius({ width: 200, height: 300 })).toBeGreaterThanOrEqual(15);
  });

  it('draws start tape solid and finish tape hatched, each on a dark backing', () => {
    const start = shapes([hold({ tapes: { start: 2, finish: 0 } })]);
    const solid = start.filter(
      (shape) => shape.type === 'rect' && shape.fill === MARK_COLORS.start
    );
    const backing = start.filter(
      (shape) => shape.type === 'rect' && shape.fill === MARK_COLORS.halo
    );
    expect(solid).toHaveLength(2);
    expect(backing).toHaveLength(2);

    const finish = shapes([hold({ tapes: { start: 0, finish: 1 } })]).filter(
      (shape) => shape.type === 'hatch'
    );
    expect(finish).toHaveLength(1);
    expect(finish[0].type === 'hatch' && finish[0].lines.length).toBeGreaterThan(1);
  });
});

describe('where a marker goes', () => {
  const box = { left: 100, top: 100, width: 200, height: 100 };

  it('is the top-right corner, then the next free one when markers would collide', () => {
    expect(placeChip(box, [], 20, photo).centre).toEqual([300, 100]);
    expect(placeChip(box, [[300, 100]], 20, photo).centre).toEqual([100, 100]);
    expect(
      placeChip(
        box,
        [
          [300, 100],
          [100, 100],
        ],
        20,
        photo
      ).centre
    ).toEqual([300, 200]);
  });

  it('claims the corner it chose, not the clamped place its marker sits', () => {
    const edge = { left: 0, top: 0, width: 50, height: 50 };

    const { corner, centre } = placeChip(edge, [], 20, photo);

    expect(corner).toEqual([50, 0]);
    expect(centre).toEqual([50, 20]);
  });

  it('keeps the whole marker inside the photo', () => {
    const corner = { left: 1100, top: 0, width: 100, height: 100 };

    expect(placeChip(corner, [], 20, photo).centre).toEqual([1180, 20]);
  });

  it('puts a second marker on the next corner in a full drawing', () => {
    const centres = shapes([hold(), hold({ x: 0.42, order: 2 })])
      .filter((shape) => shape.type === 'circle')
      .filter((_, index) => index % 2 === 1)
      .map((shape) => shape.type === 'circle' && shape.center);

    expect(centres[1]).toEqual([0.42 * photo.width, 0.4 * photo.height]);
  });
});

describe('a strip of tape', () => {
  const strip = { left: 10, top: 10, width: 4, height: 20 };
  const look = { backing: 1.5, stripeSpacing: 3, stripeWidth: 1.5 };

  it('is a solid strip for start tape and a hatched one for finish tape, on a dark backing', () => {
    const [startBacking, startStrip] = tapeStrip('start', strip, look);
    const [finishBacking, finishStrip] = tapeStrip('finish', strip, look);

    expect(startBacking).toMatchObject({ left: 8.5, width: 7, fill: MARK_COLORS.halo });
    expect(startStrip).toMatchObject({ type: 'rect', fill: MARK_COLORS.start });
    expect(finishBacking).toEqual(startBacking);
    expect(finishStrip).toMatchObject({ type: 'hatch', fill: MARK_COLORS.finish });
  });

  it('crosses finish tape with lines that start inside or before it and are clipped to it', () => {
    const [, hatch] = tapeStrip('finish', strip, look);

    expect(hatch.type === 'hatch' && hatch.stripe).toEqual({
      color: MARK_COLORS.halo,
      opacity: 0.55,
      width: 1.5,
    });
    expect(hatch.type === 'hatch' && hatch.lines.length).toBeGreaterThan(4);
  });
});

/** What a shape came to, whichever painter drew it: type and the numbers that place it. */
type Placed = { kind: string; at: Array<number | string> };

function fromSvg(svg: SVGSVGElement): Placed[] {
  const number = (node: Element, name: string) => Number(node.getAttribute(name) ?? 0);
  return [...svg.querySelectorAll('rect, circle, polygon, text, line')]
    .filter((node) => !node.closest('clipPath'))
    .map((node): Placed => {
      switch (node.tagName) {
        case 'rect':
          return {
            kind: node.parentElement?.tagName === 'g' ? 'hatch' : 'rect',
            at: ['x', 'y', 'width', 'height', 'rx'].map((name) => number(node, name)),
          };
        case 'circle':
          return { kind: 'circle', at: ['cx', 'cy', 'r'].map((name) => number(node, name)) };
        case 'polygon':
          return {
            kind: 'polygon',
            at: node
              .getAttribute('points')!
              .split(/[ ,]/)
              .map((value) => Number(value)),
          };
        case 'text':
          return {
            kind: 'text',
            at: [
              node.textContent!,
              number(node, 'x'),
              number(node, 'y'),
              number(node, 'font-size'),
            ],
          };
        default:
          return { kind: 'line', at: ['x1', 'y1', 'x2', 'y2'].map((name) => number(node, name)) };
      }
    });
}

/** A canvas that notes what lands on it, as the same kinds of placed shapes. */
function recordingCanvas() {
  const placed: Placed[] = [];
  let path: Array<[number, number]> = [];
  let closed = false;
  let inHatch = false;
  const context = {
    save: () => undefined,
    restore: () => {
      inHatch = false;
    },
    beginPath: () => {
      path = [];
      closed = false;
    },
    closePath: () => {
      closed = true;
    },
    moveTo: (x: number, y: number) => path.push([x, y]),
    lineTo: (x: number, y: number) => path.push([x, y]),
    roundRect: (x: number, y: number, w: number, h: number, r: number) =>
      placed.push({ kind: 'rect', at: [x, y, w, h, r] }),
    arc: (x: number, y: number, r: number) => placed.push({ kind: 'circle', at: [x, y, r] }),
    rect: () => {
      inHatch = true;
    },
    clip: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) =>
      placed.push({ kind: 'hatch', at: [x, y, w, h, 0] }),
    fill: () => {
      if (closed) placed.push({ kind: 'polygon', at: path.flat() });
    },
    stroke: () => {
      if (inHatch && path.length === 2) placed.push({ kind: 'line', at: path.flat() });
    },
    fillText: (text: string, x: number, y: number) =>
      placed.push({
        kind: 'text',
        at: [text, x, y, Number(context.font.split(' ')[1].replace('px', ''))],
      }),
    setLineDash: () => undefined,
    font: '',
    textAlign: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
  };
  return { context, placed };
}

describe('painting', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('paints SVG scaled to its container, with no inline style (the page forbids it)', () => {
    const svg = createSvg(photo, shapes([hold({ tapes: { start: 0, finish: 1 } })]));

    expect(svg.getAttribute('viewBox')).toBe('0 0 1200 1600');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('[style]')).toBeNull();
    const text = svg.querySelector('text')!;
    expect(text.textContent).toBe('1');
    expect(text.getAttribute('font-family')).toBe(LABEL_FONT_FAMILY);
    expect(text.getAttribute('font-weight')).toBe(String(LABEL_FONT_WEIGHT));
    const clip = svg.querySelector('clipPath')!;
    expect(svg.querySelector('g')!.getAttribute('clip-path')).toBe(`url(#${clip.id})`);
  });

  it('replaces what it drew before', () => {
    const svg = createSvg(photo, shapes([hold()]));

    paintSvg(svg, { width: 10, height: 10 }, []);

    expect(svg.childElementCount).toBe(0);
    expect(svg.getAttribute('viewBox')).toBe('0 0 10 10');
  });

  it('puts every shape in the same place on a canvas as in the editor', () => {
    const annotations = [
      hold({ use: 'hand', tapes: { start: 2, finish: 0 } }),
      hold({ x: 0.1, y: 0.7, use: 'foot', order: 2, tapes: { start: 0, finish: 1 } }),
      hold({ x: 0.7, use: 'any', order: 3 }),
      hold({ x: 0.2, use: null, order: null }),
    ];
    const list = shapes(annotations);
    const { context, placed } = recordingCanvas();

    paintCanvas(context as unknown as CanvasRenderingContext2D, list);

    expect(placed.length).toBeGreaterThan(20);
    const onScreen = fromSvg(createSvg(photo, list));
    // The two painters meet the same shapes in the same order.
    expect(placed.map(({ kind }) => kind)).toEqual(onScreen.map(({ kind }) => kind));
    placed.forEach((canvasShape, index) => {
      const expected = onScreen[index].at;
      canvasShape.at.forEach((value, place) => {
        if (typeof value === 'number') expect(value).toBeCloseTo(expected[place] as number, 6);
        else expect(value).toBe(expected[place]);
      });
    });
  });

  it('draws labels in the display face on a canvas', () => {
    const { context } = recordingCanvas();

    paintCanvas(context as unknown as CanvasRenderingContext2D, shapes([hold()]));

    expect(context.font).toMatch(new RegExp(`^${LABEL_FONT_WEIGHT} [\\d.]+px `));
    expect(context.font).toContain(LABEL_FONT_FAMILY);
  });
});
