/** Constants and the small, explicit decoder for the exported YOLOv4 model. */

export const MODEL_INPUT_SIZE = 416;
export const MODEL_URL = '/model/yolov4_1_3_416_416_static.onnx';
export const MODEL_DATA_URL = `${MODEL_URL}.data`;
const MODEL_ANCHORS = [10, 14, 23, 27, 37, 58, 81, 82, 135, 169, 344, 319] as const;
const MODEL_ANCHOR_MASKS = [
  [3, 4, 5],
  [0, 1, 2],
] as const;
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
  class: 'hold';
};

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
  outputs.forEach((output, outputIndex) => {
    const [, channels, gridHeight, gridWidth] = output.dims;
    const anchors =
      gridHeight === 13
        ? MODEL_ANCHOR_MASKS[0]
        : gridHeight === 26
          ? MODEL_ANCHOR_MASKS[1]
          : (MODEL_ANCHOR_MASKS[outputIndex] ?? MODEL_ANCHOR_MASKS[0]);
    if (channels !== anchors.length * 6 || !gridHeight || !gridWidth) return;
    const index = (channel: number, row: number, column: number) =>
      (channel * gridHeight + row) * gridWidth + column;
    anchors.forEach((anchorIndex, anchorPosition) => {
      const channel = anchorPosition * 6;
      const anchorWidth = MODEL_ANCHORS[anchorIndex * 2];
      const anchorHeight = MODEL_ANCHORS[anchorIndex * 2 + 1];
      for (let row = 0; row < gridHeight; row += 1) {
        for (let column = 0; column < gridWidth; column += 1) {
          const tx = Number(output.data[index(channel, row, column)]);
          const ty = Number(output.data[index(channel + 1, row, column)]);
          const tw = Number(output.data[index(channel + 2, row, column)]);
          const th = Number(output.data[index(channel + 3, row, column)]);
          const confidence =
            sigmoid(Number(output.data[index(channel + 4, row, column)])) *
            sigmoid(Number(output.data[index(channel + 5, row, column)]));
          if (!Number.isFinite(confidence) || confidence <= CONFIDENCE_THRESHOLD) continue;
          const centerX =
            (sigmoid(tx) * MODEL_SCALE_XY - 0.5 * (MODEL_SCALE_XY - 1) + column) / gridWidth;
          const centerY =
            (sigmoid(ty) * MODEL_SCALE_XY - 0.5 * (MODEL_SCALE_XY - 1) + row) / gridHeight;
          // Anchors are expressed in 416px input pixels, so widths stay
          // normalized to the model input rather than the head's grid.
          const width = (Math.exp(tw) * anchorWidth) / MODEL_INPUT_SIZE;
          const height = (Math.exp(th) * anchorHeight) / MODEL_INPUT_SIZE;
          candidates.push({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            confidence,
            class: 'hold',
          });
        }
      }
    });
  });

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
