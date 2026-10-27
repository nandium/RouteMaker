/** YOLOv4-tiny export: constants, worker protocol and head decoder. */

export const MODEL_INPUT_SIZE = 416;
const MODEL_ANCHORS = [10, 14, 23, 27, 37, 58, 81, 82, 135, 169, 344, 319] as const;
const MODEL_ANCHOR_MASKS = [
  [3, 4, 5],
  [0, 1, 2],
] as const;
/** The coarse head has one cell per 32 input pixels; the fine head, one per 16. */
const COARSE_GRID = MODEL_INPUT_SIZE / 32;
/** Per anchor: x, y, w, h, objectness, class. */
const VALUES_PER_ANCHOR = 6;
const MODEL_SCALE_XY = 1.05;
const CONFIDENCE_THRESHOLD = 0.3;
const NMS_THRESHOLD = 0.4;

export type YoloOutput = {
  data: ArrayLike<number>;
  dims: readonly number[];
};

export type Detection = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export type DetectorRequest = { image: Blob };
export type DetectorStage = 'loading' | 'preparing' | 'detecting';
export type DetectorResponse =
  | { type: 'progress'; stage: DetectorStage }
  | { type: 'result'; boxes: Detection[] }
  | { type: 'error'; message: string };

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

function intersectionOverUnion(left: Detection, right: Detection) {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.width * left.height + right.width * right.height - intersection;
  return union <= 0 ? 0 : intersection / union;
}

/** Decode NCHW raw heads, filter confidence, and apply class-agnostic NMS. */
export function decodeYoloOutputs(outputs: readonly YoloOutput[]): Detection[] {
  const candidates: Detection[] = [];
  for (const output of outputs) {
    const [, channels, gridHeight, gridWidth] = output.dims;
    // The coarse head carries the large anchors, the fine head the small ones.
    const anchors =
      gridHeight === COARSE_GRID
        ? MODEL_ANCHOR_MASKS[0]
        : gridHeight === COARSE_GRID * 2
          ? MODEL_ANCHOR_MASKS[1]
          : null;
    if (!anchors || gridWidth !== gridHeight || channels !== anchors.length * VALUES_PER_ANCHOR) {
      throw new Error('The hold detector returned an unexpected result.');
    }
    const index = (channel: number, row: number, column: number) =>
      (channel * gridHeight + row) * gridWidth + column;
    anchors.forEach((anchorIndex, anchorPosition) => {
      const channel = anchorPosition * VALUES_PER_ANCHOR;
      const anchorWidth = MODEL_ANCHORS[anchorIndex * 2];
      const anchorHeight = MODEL_ANCHORS[anchorIndex * 2 + 1];
      for (let row = 0; row < gridHeight; row += 1) {
        for (let column = 0; column < gridWidth; column += 1) {
          const tx = output.data[index(channel, row, column)];
          const ty = output.data[index(channel + 1, row, column)];
          const tw = output.data[index(channel + 2, row, column)];
          const th = output.data[index(channel + 3, row, column)];
          const confidence =
            sigmoid(output.data[index(channel + 4, row, column)]) *
            sigmoid(output.data[index(channel + 5, row, column)]);
          if (!Number.isFinite(confidence) || confidence <= CONFIDENCE_THRESHOLD) continue;
          const centerX =
            (sigmoid(tx) * MODEL_SCALE_XY - 0.5 * (MODEL_SCALE_XY - 1) + column) / gridWidth;
          const centerY =
            (sigmoid(ty) * MODEL_SCALE_XY - 0.5 * (MODEL_SCALE_XY - 1) + row) / gridHeight;
          // Anchors are in 416px input pixels: normalise by input size, not grid.
          const width = (Math.exp(tw) * anchorWidth) / MODEL_INPUT_SIZE;
          const height = (Math.exp(th) * anchorHeight) / MODEL_INPUT_SIZE;
          candidates.push({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            confidence,
          });
        }
      }
    });
  }

  const selected: Detection[] = [];
  candidates.sort((left, right) => right.confidence - left.confidence);
  for (const candidate of candidates) {
    if (selected.some((item) => intersectionOverUnion(item, candidate) > NMS_THRESHOLD)) continue;
    const left = Math.max(0, candidate.x);
    const top = Math.max(0, candidate.y);
    const right = Math.min(1, candidate.x + candidate.width);
    const bottom = Math.min(1, candidate.y + candidate.height);
    if (right <= left || bottom <= top) continue;
    selected.push({
      ...candidate,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }
  return selected.sort((left, right) => right.width * right.height - left.width * left.height);
}
