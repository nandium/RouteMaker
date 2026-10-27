export type HoldUse = 'hand' | 'foot' | 'any';
export type TapeKind = 'start' | 'finish';

/** Normalised (0-1) rectangle on the wall photo. */
export type Box = { x: number; y: number; width: number; height: number };

/** A hold boundary; `use === null` means a detected candidate that is not part of the route. */
export type Annotation = Box & {
  use: HoldUse | null;
  order: number | null;
  tapes: Record<TapeKind, number>;
};

export type PixelBox = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

/** A normalised box on a photo (or on screen) of `size`, in pixels. */
export const toPixels = (box: Box, { width, height }: Size): PixelBox => ({
  left: box.x * width,
  top: box.y * height,
  width: box.width * width,
  height: box.height * height,
});

export const TAPE_KINDS = ['start', 'finish'] as const;
export const TAPE_LIMIT: Record<TapeKind, number> = { start: 4, finish: 2 };

/** Normalised size of a boundary placed by a tap. */
const MARKER_SIZE = { width: 0.08, height: 0.06 } as const;

const HOLD_USE_LABELS: Record<HoldUse, string> = {
  any: 'Any limb',
  hand: 'Hand only',
  foot: 'Foot only',
};
const HOLD_USE_LETTERS: Record<HoldUse, string> = { any: 'A', hand: 'H', foot: 'F' };

export const holdUseLabel = (use: HoldUse) => HOLD_USE_LABELS[use];

export const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

export function candidate({ x, y, width, height }: Box): Annotation {
  return { x, y, width, height, use: null, order: null, tapes: { start: 0, finish: 0 } };
}

export function cloneAnnotation(annotation: Annotation): Annotation {
  return { ...annotation, tapes: { ...annotation.tapes } };
}

export function clearSelection(annotation: Annotation) {
  annotation.use = null;
  annotation.order = null;
  annotation.tapes.start = 0;
  annotation.tapes.finish = 0;
}

/** A standard-size boundary centred on a point, kept inside the photo. */
export function annotationAt(x: number, y: number, use: HoldUse, order: number): Annotation {
  const { width, height } = MARKER_SIZE;
  return {
    ...candidate({
      x: clamp(x - width / 2, 0, 1 - width),
      y: clamp(y - height / 2, 0, 1 - height),
      width,
      height,
    }),
    use,
    order,
  };
}

/** A boundary drawn corner to corner in either direction, clipped to the photo. */
export function annotationFromBox(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  use: HoldUse,
  order: number
): Annotation {
  const left = clamp(Math.min(startX, endX), 0, 1);
  const top = clamp(Math.min(startY, endY), 0, 1);
  const right = clamp(Math.max(startX, endX), 0, 1);
  const bottom = clamp(Math.max(startY, endY), 0, 1);
  return {
    ...candidate({ x: left, y: top, width: right - left, height: bottom - top }),
    use,
    order,
  };
}

type SelectedAnnotation = Annotation & { use: HoldUse };

export const selectedAnnotations = (annotations: readonly Annotation[]) =>
  annotations.filter((annotation): annotation is SelectedAnnotation => annotation.use !== null);

/** The order for the next selected hold: after every hold selected so far. */
export const nextOrder = (annotations: readonly Annotation[]) =>
  1 + Math.max(0, ...annotations.map((annotation) => annotation.order ?? 0));

export const tapeTotal = (annotations: readonly Annotation[], kind: TapeKind) =>
  annotations.reduce((total, annotation) => total + annotation.tapes[kind], 0);

/** Where a hold falls in the numbering: start holds first, finish holds last. */
function sequenceStage({ tapes }: Annotation) {
  if (tapes.start) return 0;
  if (tapes.finish) return 2;
  return 1;
}

/**
 * Marker text for every selected hold. With numbers on, start holds come first and finish
 * holds last; feet that carry no tape are unnumbered ("F").
 */
export function routeLabels(
  annotations: readonly Annotation[],
  showSequence: boolean
): Map<Annotation, string> {
  const selected = selectedAnnotations(annotations);
  const numbered = selected
    .filter(({ use, tapes }) => use !== 'foot' || tapes.start || tapes.finish)
    .sort(
      (left, right) =>
        sequenceStage(left) - sequenceStage(right) || (left.order ?? 0) - (right.order ?? 0)
    );
  const labels = new Map<Annotation, string>();
  for (const annotation of selected) {
    const position = numbered.indexOf(annotation);
    if (!showSequence) labels.set(annotation, HOLD_USE_LETTERS[annotation.use]);
    else if (position < 0) labels.set(annotation, HOLD_USE_LETTERS.foot);
    else labels.set(annotation, String(position + 1));
  }
  return labels;
}
