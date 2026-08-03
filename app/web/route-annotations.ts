export type HoldUse = 'hand' | 'foot' | 'any';

export type Annotation = {
  x: number;
  y: number;
  width: number;
  height: number;
  use: HoldUse | null;
  order: number | null;
  start_tapes: number;
  finish_tapes: number;
};

export const ROUTE_MARKING = {
  markerWidth: 0.08,
  markerHeight: 0.06,
  minimumSourceDimension: 64,
  minimumHitTarget: 44,
  keyboardStep: 0.02,
  keyboardLargeStep: 0.1,
  minimumDrawPixels: 12,
  maxStartTapes: 4,
  maxFinishTapes: 2,
} as const;

export type TapeKind = 'start' | 'finish';
type TapeSide = 'left' | 'right' | 'top' | 'bottom';

const TAPE_GEOMETRY = {
  thicknessScale: 0.006,
  lengthScale: 0.055,
  minimumLengthToThickness: 4,
  gapToThickness: 0.65,
  slantToLength: 0.18,
  maximumSlantToThickness: 2,
} as const;

export type TapeStrip = {
  side: TapeSide;
  left: number;
  top: number;
  width: number;
  height: number;
  points: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
};

export type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type VisualTarget<T> = {
  box: PixelBox;
  hitBox: PixelBox;
  value: T;
};

/**
 * Large invisible tap regions may overlap around small or crowded holds. Route
 * pointer input to the nearest visible shape so target size never changes which
 * annotation the climber meant to select.
 */
export function nearestVisualTarget<T>(
  x: number,
  y: number,
  targets: readonly VisualTarget<T>[]
): T | null {
  let nearest: { value: T; edgeDistance: number; centerDistance: number } | undefined;
  targets.forEach(({ box, hitBox, value }) => {
    if (
      x < hitBox.left ||
      x > hitBox.left + hitBox.width ||
      y < hitBox.top ||
      y > hitBox.top + hitBox.height
    ) {
      return;
    }
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    const dx = x < box.left ? box.left - x : x > right ? x - right : 0;
    const dy = y < box.top ? box.top - y : y > bottom ? y - bottom : 0;
    const edgeDistance = Math.hypot(dx, dy);
    const centerDistance = Math.hypot(
      x - (box.left + box.width / 2),
      y - (box.top + box.height / 2)
    );
    if (
      !nearest ||
      edgeDistance < nearest.edgeDistance ||
      (edgeDistance === nearest.edgeDistance && centerDistance < nearest.centerDistance)
    ) {
      nearest = { value, edgeDistance, centerDistance };
    }
  });
  return nearest?.value ?? null;
}

export function expandedHitTarget(
  box: PixelBox,
  containerWidth: number,
  containerHeight: number,
  minimumSize = ROUTE_MARKING.minimumHitTarget
): PixelBox {
  const width = Math.min(containerWidth, Math.max(minimumSize, box.width));
  const height = Math.min(containerHeight, Math.max(minimumSize, box.height));
  return {
    left: Math.max(0, Math.min(containerWidth - width, box.left - (width - box.width) / 2)),
    top: Math.max(0, Math.min(containerHeight - height, box.top - (height - box.height) / 2)),
    width,
    height,
  };
}

export function tapeBounds(strips: readonly TapeStrip[]): PixelBox | null {
  if (!strips.length) return null;
  const left = Math.min(...strips.map((strip) => strip.left));
  const top = Math.min(...strips.map((strip) => strip.top));
  const right = Math.max(...strips.map((strip) => strip.left + strip.width));
  const bottom = Math.max(...strips.map((strip) => strip.top + strip.height));
  return { left, top, width: right - left, height: bottom - top };
}

export function annotationAt(
  x: number,
  y: number,
  use: HoldUse | null = null,
  order: number | null = null
): Annotation {
  const { markerWidth: width, markerHeight: height } = ROUTE_MARKING;
  return {
    x: Math.min(1 - width, Math.max(0, x - width / 2)),
    y: Math.min(1 - height, Math.max(0, y - height / 2)),
    width,
    height,
    use,
    order,
    start_tapes: 0,
    finish_tapes: 0,
  };
}

export function annotationFromBox(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  use: HoldUse,
  order: number
): Annotation {
  const left = Math.max(0, Math.min(1, Math.min(startX, endX)));
  const top = Math.max(0, Math.min(1, Math.min(startY, endY)));
  const right = Math.max(0, Math.min(1, Math.max(startX, endX)));
  const bottom = Math.max(0, Math.min(1, Math.max(startY, endY)));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    use,
    order,
    start_tapes: 0,
    finish_tapes: 0,
  };
}

export function selectedAnnotations(annotations: readonly Annotation[]) {
  return annotations.filter((annotation) => annotation.use !== null);
}

export function tapeTotal(annotations: readonly Annotation[], kind: TapeKind) {
  const key = kind === 'start' ? 'start_tapes' : 'finish_tapes';
  return annotations.reduce((total, annotation) => total + annotation[key], 0);
}

/**
 * Tape sits beside a hold whenever space permits. Near an image edge it moves
 * just inside the box instead, so every strip survives the final JPEG crop.
 */
export function layoutTape(
  annotation: Annotation,
  count: number,
  kind: TapeKind,
  imageWidth: number,
  imageHeight: number
): TapeStrip[] {
  if (!count || imageWidth <= 0 || imageHeight <= 0) return [];
  const minDimension = Math.min(imageWidth, imageHeight);
  // A strip cannot remain longer than wide on a one-pixel image. Those sources
  // are rejected by the editor; returning no geometry keeps this helper bounded.
  if (minDimension < 2) return [];
  const thickness = Math.min(
    Math.max(1, minDimension * TAPE_GEOMETRY.thicknessScale),
    minDimension / 2
  );
  const length = Math.min(
    Math.max(
      thickness * TAPE_GEOMETRY.minimumLengthToThickness,
      minDimension * TAPE_GEOMETRY.lengthScale
    ),
    minDimension
  );
  const gap = Math.min(Math.max(1, thickness * TAPE_GEOMETRY.gapToThickness), minDimension / 2);
  const margin = gap;
  const slant = Math.min(
    length * TAPE_GEOMETRY.slantToLength,
    thickness * TAPE_GEOMETRY.maximumSlantToThickness
  );
  const breadth = count * thickness + (count - 1) * gap + slant;
  const box = {
    left: annotation.x * imageWidth,
    top: annotation.y * imageHeight,
    width: annotation.width * imageWidth,
    height: annotation.height * imageHeight,
  };
  const spaces = {
    left: box.left,
    right: imageWidth - box.left - box.width,
    top: box.top,
    bottom: imageHeight - box.top - box.height,
  };
  const preference =
    kind === 'start'
      ? (['left', 'top', 'right', 'bottom'] as const)
      : (['right', 'bottom', 'left', 'top'] as const);
  const side =
    preference.find((candidate) => spaces[candidate] >= length + margin) ??
    preference.reduce((best, candidate) => (spaces[candidate] > spaces[best] ? candidate : best));
  const outside = spaces[side] >= length + margin;
  const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));
  const strips: TapeStrip[] = [];

  for (let index = 0; index < count; index += 1) {
    const offset = index * (thickness + gap);
    if (side === 'left' || side === 'right') {
      const width = length;
      const height = thickness + slant;
      const left =
        side === 'left'
          ? outside
            ? box.left - margin - width
            : box.left + margin
          : outside
            ? box.left + box.width + margin
            : box.left + box.width - margin - width;
      const top = clamp(box.top + (box.height - breadth) / 2 + offset, imageHeight - height);
      strips.push({
        side,
        left: clamp(left, imageWidth - width),
        top,
        width,
        height,
        points:
          side === 'left'
            ? [
                [0, 0],
                [width, slant],
                [width, height],
                [0, thickness],
              ]
            : [
                [0, slant],
                [width, 0],
                [width, thickness],
                [0, height],
              ],
      });
    } else {
      const width = thickness + slant;
      const height = length;
      const top =
        side === 'top'
          ? outside
            ? box.top - margin - height
            : box.top + margin
          : outside
            ? box.top + box.height + margin
            : box.top + box.height - margin - height;
      const left = clamp(box.left + (box.width - breadth) / 2 + offset, imageWidth - width);
      strips.push({
        side,
        left,
        top: clamp(top, imageHeight - height),
        width,
        height,
        points:
          side === 'top'
            ? [
                [0, 0],
                [thickness, 0],
                [width, height],
                [slant, height],
              ]
            : [
                [slant, 0],
                [width, 0],
                [thickness, height],
                [0, height],
              ],
      });
    }
  }
  return strips;
}
