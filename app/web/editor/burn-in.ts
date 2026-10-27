import { MARK_COLORS } from '../../src/marking-colors.js';
import {
  type Annotation,
  type HoldUse,
  type PixelBox,
  type Size,
  TAPE_KINDS,
  type TapeKind,
  clamp,
  toPixels,
} from './route-annotations.js';
import { layoutTape } from './tape-layout.js';

export const LABEL_FONT_FAMILY = `'RM Display', 'Big Shoulders Display', 'Avenir Next Condensed', 'Arial Narrow', sans-serif`;
export const LABEL_FONT_WEIGHT = 800;

type Point = readonly [number, number];
type Line = readonly [from: Point, to: Point];

/**
 * What a marking looks like, as plain shapes in photo pixels. The editor draws them as SVG over
 * the photo and Publish draws them on a canvas, so the page shows exactly what gets published.
 */
export type Shape =
  | ({
      type: 'rect';
      radius: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      dash?: readonly [number, number];
      opacity?: number;
    } & PixelBox)
  | { type: 'circle'; center: Point; radius: number; fill: string }
  | { type: 'polygon'; points: readonly Point[]; fill: string }
  | { type: 'text'; at: Point; text: string; size: number; fill: string }
  /** A box of `fill` crossed by diagonal `stripe` lines, clipped to the box: finish tape. */
  | ({
      type: 'hatch';
      fill: string;
      lines: readonly Line[];
      stripe: { color: string; opacity: number; width: number };
    } & PixelBox);

// Every size below is a fraction of the photo's shorter side ("unit"), or a multiple of the
// stroke or chip it is drawn with, so a marking looks the same on any photo.
const STROKE = { fraction: 0.0075, min: 3 } as const;
const CHIP = { fraction: 0.034, min: 15 } as const;
/** In stroke widths: the dark outline under every line, and how far the boundary's corners curve. */
const HALO = { width: 2.3, opacity: 0.78 } as const;
const BOUNDARY_RADIUS = 1.1;
/** Dash and gap, in stroke widths, that tell a foot-only or any-limb boundary from a hand one. */
const DASHES: Partial<Record<HoldUse, readonly [number, number]>> = {
  foot: [3.6, 2],
  any: [1.1, 1.5],
};
/** A detected hold that is not part of the route yet: a thin dashed outline on a dim halo. */
const CANDIDATE = {
  haloWidth: 1.9,
  haloOpacity: 0.55,
  width: 0.7,
  opacity: 0.9,
  dash: [1.2, 1.4],
} as const;
/** Dark backing under tape, in pixels beyond the strip. */
const TAPE_BACKING = { pad: 1.4, opacity: 0.85 } as const;
/** Finish tape's stripes: spacing and width as fractions of unit; the dark shows through at 55%. */
const HATCH = { spacing: 0.0165, width: 0.0083, opacity: 0.55 } as const;
/** A marker sits on the first free corner; markers closer than this many chips collide. */
const CORNER_CLEARANCE = 1.9;
/** Marker geometry. Hand: circle. Foot: triangle. Any limb: rounded square. */
const MARKER = {
  circleHalo: 0.9, // × stroke
  triangleReach: 1.18, // × chip
  triangleHalo: 1.1, // × stroke
  triangleSkew: 1.05,
  triangleDrop: 0.78,
  squareHalf: 0.98, // × chip
  squareHaloRadius: 0.3,
  squareRadius: 0.26,
  squareHalo: 0.9, // × stroke
} as const;
/** The label's size relative to its chip, and where its baseline sits relative to the label. */
const LABEL = { single: 1.25, double: 1, scale: 1.15, baseline: 0.34, footBaseline: 0.5 } as const;

const HOLD_COLORS: Record<HoldUse, string> = {
  hand: MARK_COLORS.hand,
  foot: MARK_COLORS.foot,
  any: MARK_COLORS.any,
};

export const filledRect = (box: PixelBox, fill: string, opacity?: number, radius = 0): Shape => ({
  type: 'rect',
  ...box,
  radius,
  fill,
  opacity,
});

/** Diagonal lines across `box`, `spacing` apart, to be clipped to it. */
function diagonals({ left, top, width, height }: PixelBox, spacing: number): Line[] {
  const lines: Line[] = [];
  for (let start = -height; start < width; start += spacing * Math.SQRT2) {
    lines.push([
      [left + start, top + height],
      [left + start + height, top],
    ]);
  }
  return lines;
}

type StripLook = {
  /** Pixels of dark backing around the strip. */
  backing: number;
  backingOpacity?: number;
  /** Finish tape's stripes, in pixels. */
  stripeSpacing: number;
  stripeWidth: number;
};

/** One strip of tape on a dark backing: start tape is solid, finish tape hatched. */
export function tapeStrip(kind: TapeKind, strip: PixelBox, look: StripLook): Shape[] {
  const backing = filledRect(
    {
      left: strip.left - look.backing,
      top: strip.top - look.backing,
      width: strip.width + 2 * look.backing,
      height: strip.height + 2 * look.backing,
    },
    MARK_COLORS.halo,
    look.backingOpacity
  );
  if (kind === 'start') return [backing, filledRect(strip, MARK_COLORS.start)];
  return [
    backing,
    {
      type: 'hatch',
      ...strip,
      fill: MARK_COLORS.finish,
      lines: diagonals(strip, look.stripeSpacing),
      stripe: { color: MARK_COLORS.halo, opacity: HATCH.opacity, width: look.stripeWidth },
    },
  ];
}

/** Where the marker for a boundary goes, and the corner it claims so later markers avoid it. */
export function placeChip(
  box: PixelBox,
  takenCorners: readonly Point[],
  chip: number,
  photo: Size
): { corner: Point; centre: Point } {
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const corners: Point[] = [
    [right, box.top],
    [box.left, box.top],
    [right, bottom],
    [box.left, bottom],
  ];
  const isFree = (corner: Point) =>
    takenCorners.every(
      ([x, y]) => Math.hypot(x - corner[0], y - corner[1]) >= chip * CORNER_CLEARANCE
    );
  const corner = corners.find(isFree) ?? corners[0];
  // The marker stays whole inside the photo even when its corner is on the edge.
  const centre: Point = [
    clamp(corner[0], chip, photo.width - chip),
    clamp(corner[1], chip, photo.height - chip),
  ];
  return { corner, centre };
}

/** A hold's marker: a circle, triangle or rounded square, so the use survives colour blindness. */
function chipShapes(
  use: HoldUse,
  label: string,
  [x, y]: Point,
  chip: number,
  stroke: number
): Shape[] {
  const color = HOLD_COLORS[use];
  const size = chip * (label.length > 1 ? LABEL.double : LABEL.single);
  const text = (baseline: number): Shape => ({
    type: 'text',
    at: [x, y + size * baseline],
    text: label,
    size: size * LABEL.scale,
    fill: MARK_COLORS.halo,
  });
  if (use === 'hand') {
    return [
      {
        type: 'circle',
        center: [x, y],
        radius: chip + stroke * MARKER.circleHalo,
        fill: MARK_COLORS.halo,
      },
      { type: 'circle', center: [x, y], radius: chip, fill: color },
      text(LABEL.baseline),
    ];
  }
  if (use === 'foot') {
    const reach = chip * MARKER.triangleReach;
    const triangle = (grow: number): Point[] => [
      [x, y - reach - grow],
      [x + (reach + grow) * MARKER.triangleSkew, y + reach * MARKER.triangleDrop + grow],
      [x - (reach + grow) * MARKER.triangleSkew, y + reach * MARKER.triangleDrop + grow],
    ];
    return [
      {
        type: 'polygon',
        points: triangle(stroke * MARKER.triangleHalo),
        fill: MARK_COLORS.halo,
      },
      { type: 'polygon', points: triangle(0), fill: color },
      text(LABEL.footBaseline),
    ];
  }
  const half = chip * MARKER.squareHalf;
  const square = (grow: number, radius: number): Shape => ({
    type: 'rect',
    left: x - half - grow,
    top: y - half - grow,
    width: 2 * (half + grow),
    height: 2 * (half + grow),
    radius: radius * half,
    fill: grow ? MARK_COLORS.halo : color,
  });
  return [
    square(stroke * MARKER.squareHalo, MARKER.squareHaloRadius),
    square(0, MARKER.squareRadius),
    text(LABEL.baseline),
  ];
}

/**
 * Every marking on a photo of `size`, as shapes. Unselected candidates sit underneath the
 * selected holds, which carry their tape and a marker on a corner of the boundary (so the hold
 * itself stays visible).
 */
export function markShapes(
  annotations: readonly Annotation[],
  labels: ReadonlyMap<Annotation, string>,
  size: Size
): Shape[] {
  const unit = Math.min(size.width, size.height);
  const stroke = Math.max(STROKE.min, unit * STROKE.fraction);
  const halo = stroke * HALO.width;
  const chip = Math.max(CHIP.min, unit * CHIP.fraction);
  const tapeLook: StripLook = {
    backing: TAPE_BACKING.pad,
    backingOpacity: TAPE_BACKING.opacity,
    stripeSpacing: unit * HATCH.spacing,
    stripeWidth: unit * HATCH.width,
  };

  const shapes: Shape[] = [];
  for (const annotation of annotations.filter(({ use }) => use === null)) {
    const box = toPixels(annotation, size);
    shapes.push(
      {
        type: 'rect',
        ...box,
        radius: stroke,
        stroke: MARK_COLORS.halo,
        strokeWidth: stroke * CANDIDATE.haloWidth,
        opacity: CANDIDATE.haloOpacity,
      },
      {
        type: 'rect',
        ...box,
        radius: stroke,
        stroke: MARK_COLORS.candidate,
        strokeWidth: stroke * CANDIDATE.width,
        dash: [stroke * CANDIDATE.dash[0], stroke * CANDIDATE.dash[1]],
        opacity: CANDIDATE.opacity,
      }
    );
  }

  const takenCorners: Point[] = [];
  for (const annotation of annotations) {
    if (annotation.use === null) continue;
    const box = toPixels(annotation, size);
    const dashes = DASHES[annotation.use];
    shapes.push(
      {
        type: 'rect',
        ...box,
        radius: stroke * BOUNDARY_RADIUS,
        stroke: MARK_COLORS.halo,
        strokeWidth: halo,
        opacity: HALO.opacity,
      },
      {
        type: 'rect',
        ...box,
        radius: stroke * BOUNDARY_RADIUS,
        stroke: HOLD_COLORS[annotation.use],
        strokeWidth: stroke,
        dash: dashes && [stroke * dashes[0], stroke * dashes[1]],
      }
    );
    for (const kind of TAPE_KINDS) {
      for (const strip of layoutTape(annotation, kind, size, halo)) {
        shapes.push(...tapeStrip(kind, strip, tapeLook));
      }
    }
    const { corner, centre } = placeChip(box, takenCorners, chip, size);
    takenCorners.push(corner);
    shapes.push(...chipShapes(annotation.use, labels.get(annotation) ?? '', centre, chip, stroke));
  }
  return shapes;
}

// ---- painters: the only code that knows about SVG or canvas ----

const SVG_NS = 'http://www.w3.org/2000/svg';
let nextClipId = 0;

function svgNode<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number | undefined>
) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) node.setAttribute(name, String(value));
  }
  return node;
}

const points = (list: readonly Point[]) => list.map(([x, y]) => `${x},${y}`).join(' ');

const boxAttributes = (box: PixelBox) => ({
  x: box.left,
  y: box.top,
  width: box.width,
  height: box.height,
});

function svgShape(shape: Shape): SVGElement {
  switch (shape.type) {
    case 'rect':
      return svgNode('rect', {
        ...boxAttributes(shape),
        rx: shape.radius || undefined,
        fill: shape.fill ?? 'none',
        stroke: shape.stroke,
        'stroke-width': shape.strokeWidth,
        'stroke-dasharray': shape.dash?.join(' '),
        opacity: shape.opacity,
      });
    case 'circle':
      return svgNode('circle', {
        cx: shape.center[0],
        cy: shape.center[1],
        r: shape.radius,
        fill: shape.fill,
      });
    case 'polygon':
      return svgNode('polygon', { points: points(shape.points), fill: shape.fill });
    case 'text': {
      const text = svgNode('text', {
        x: shape.at[0],
        y: shape.at[1],
        'text-anchor': 'middle',
        'font-family': LABEL_FONT_FAMILY,
        'font-weight': LABEL_FONT_WEIGHT,
        'font-size': shape.size,
        fill: shape.fill,
      });
      text.textContent = shape.text;
      return text;
    }
    case 'hatch': {
      const clip = svgNode('clipPath', { id: `mark-clip-${(nextClipId += 1)}` });
      clip.append(svgNode('rect', boxAttributes(shape)));
      const group = svgNode('g', { 'clip-path': `url(#${clip.id})` });
      group.append(
        clip,
        svgNode('rect', { ...boxAttributes(shape), fill: shape.fill }),
        ...shape.lines.map(([from, to]) =>
          svgNode('line', {
            x1: from[0],
            y1: from[1],
            x2: to[0],
            y2: to[1],
            stroke: shape.stripe.color,
            'stroke-opacity': shape.stripe.opacity,
            'stroke-width': shape.stripe.width,
          })
        )
      );
      return group;
    }
  }
}

/** Draw `shapes` into `svg`, scaled to fill it whatever its on-screen size. */
export function paintSvg(svg: SVGSVGElement, size: Size, shapes: readonly Shape[]) {
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.replaceChildren(...shapes.map(svgShape));
}

/** A decorative SVG showing `shapes` in a `size` box; CSS sets how large it is drawn. */
export function createSvg(size: Size, shapes: readonly Shape[]) {
  const svg = svgNode('svg', {});
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  paintSvg(svg, size, shapes);
  return svg;
}

export function paintCanvas(context: CanvasRenderingContext2D, shapes: readonly Shape[]) {
  for (const shape of shapes) {
    context.save();
    switch (shape.type) {
      case 'rect':
        context.globalAlpha = shape.opacity ?? 1;
        context.beginPath();
        context.roundRect(shape.left, shape.top, shape.width, shape.height, shape.radius);
        if (shape.fill) {
          context.fillStyle = shape.fill;
          context.fill();
        }
        if (shape.stroke) {
          context.strokeStyle = shape.stroke;
          context.lineWidth = shape.strokeWidth ?? 1;
          context.setLineDash(shape.dash ?? []);
          context.stroke();
        }
        break;
      case 'circle':
        context.beginPath();
        context.arc(shape.center[0], shape.center[1], shape.radius, 0, Math.PI * 2);
        context.fillStyle = shape.fill;
        context.fill();
        break;
      case 'polygon':
        context.beginPath();
        shape.points.forEach(([x, y], index) =>
          index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)
        );
        context.closePath();
        context.fillStyle = shape.fill;
        context.fill();
        break;
      case 'text':
        context.font = `${LABEL_FONT_WEIGHT} ${shape.size}px ${LABEL_FONT_FAMILY}`;
        context.textAlign = 'center';
        context.fillStyle = shape.fill;
        context.fillText(shape.text, shape.at[0], shape.at[1]);
        break;
      case 'hatch':
        context.beginPath();
        context.rect(shape.left, shape.top, shape.width, shape.height);
        context.clip();
        context.fillStyle = shape.fill;
        context.fillRect(shape.left, shape.top, shape.width, shape.height);
        context.strokeStyle = shape.stripe.color;
        context.globalAlpha = shape.stripe.opacity;
        context.lineWidth = shape.stripe.width;
        for (const [from, to] of shape.lines) {
          context.beginPath();
          context.moveTo(from[0], from[1]);
          context.lineTo(to[0], to[1]);
          context.stroke();
        }
        break;
    }
    context.restore();
  }
}
