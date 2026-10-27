import {
  type Annotation,
  type PixelBox,
  type Size,
  type TapeKind,
  toPixels,
} from './route-annotations.js';

/** Fractions of the photo's shorter side; with a floor so strips survive a small photo. */
const STRIP = { length: 0.08, minLength: 20, thickness: 0.011, minThickness: 4 } as const;
/** Space between a boundary and its tape, and between strips, in strip thicknesses. */
const GAP = 0.9;
const PITCH = 1.9;
/** A strip is no longer than its boundary plus this many pixels. */
const OVERHANG = 8;
/** How much of the photo's width a side needs before tape may sit on it. */
const EDGE_ROOM = 0.12;

type Side = 'left' | 'right' | 'top' | 'bottom';

/** Start tape goes left of the boundary, finish tape right; near the edge, above and below. */
function tapeSide(kind: TapeKind, box: PixelBox, photoWidth: number): Side {
  if (kind === 'start') return box.left > photoWidth * EDGE_ROOM ? 'left' : 'top';
  return box.left + box.width < photoWidth * (1 - EDGE_ROOM) ? 'right' : 'bottom';
}

/**
 * Where an annotation's tape strips sit, in pixels of a photo of `size`. Strips stand side by
 * side, moving away from the boundary. `halo` is the width of the dark outline drawn around the
 * boundary, which the tape must clear.
 */
export function layoutTape(
  annotation: Annotation,
  kind: TapeKind,
  size: Size,
  halo: number
): PixelBox[] {
  const unit = Math.min(size.width, size.height);
  const length = Math.max(STRIP.minLength, unit * STRIP.length);
  const thickness = Math.max(STRIP.minThickness, unit * STRIP.thickness);
  const box = toPixels(annotation, size);
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const near = halo / 2 + thickness * GAP;
  const side = tapeSide(kind, box, size.width);
  const vertical = side === 'left' || side === 'right';
  const strip = Math.min(length, (vertical ? box.height : box.width) + OVERHANG);

  return Array.from({ length: annotation.tapes[kind] }, (_, index) => {
    const away = index * thickness * PITCH;
    if (vertical) {
      return {
        left: side === 'left' ? box.left - near - thickness - away : right + near + away,
        top: box.top + box.height / 2 - strip / 2,
        width: thickness,
        height: strip,
      };
    }
    return {
      left: box.left + box.width / 2 - strip / 2,
      top: side === 'top' ? box.top - near - thickness - away : bottom + near + away,
      width: strip,
      height: thickness,
    };
  });
}
