import { describe, expect, it } from 'vitest';

import { decodeYoloOutputs, MODEL_INPUT_SIZE } from './yolo.js';

/** A 3-anchor head (6 channels each) whose listed cells carry the given raw values. */
function head(
  grid: number,
  cells: Array<{ row: number; column: number; values: Record<number, number> }>
) {
  const data = new Float32Array(18 * grid * grid);
  for (const { row, column, values } of cells) {
    for (const [channel, value] of Object.entries(values)) {
      data[(Number(channel) * grid + row) * grid + column] = value;
    }
  }
  return { data, dims: [1, 18, grid, grid] };
}

/** Raw objectness and class scores that sigmoid to ~0.9997 each. */
const CONFIDENT = { 4: 8, 5: 8 };

describe('YOLO head decoding', () => {
  it('decodes a confident cell into a box normalised to the photo', () => {
    const [box] = decodeYoloOutputs([head(13, [{ row: 6, column: 6, values: CONFIDENT }])]);

    // Raw offsets of 0 put the centre mid-cell; the first 13x13 anchor is 81x82 input pixels.
    expect(box.confidence).toBeGreaterThan(0.99);
    expect(box.width).toBeCloseTo(81 / MODEL_INPUT_SIZE);
    expect(box.height).toBeCloseTo(82 / MODEL_INPUT_SIZE);
    expect(box.x + box.width / 2).toBeCloseTo(6.5 / 13);
    expect(box.y + box.height / 2).toBeCloseTo(6.5 / 13);
  });

  it('ignores cells below the confidence threshold', () => {
    expect(decodeYoloOutputs([head(13, [{ row: 3, column: 3, values: { 4: 0, 5: 0 } }])])).toEqual(
      []
    );
  });

  it('keeps the more confident of two overlapping detections', () => {
    const strong = head(26, [{ row: 5, column: 5, values: { 4: 8, 5: 8 } }]);
    const weak = head(26, [{ row: 5, column: 5, values: { 4: 3, 5: 3 } }]);

    const boxes = decodeYoloOutputs([weak, strong]);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].confidence).toBeGreaterThan(0.99);
  });

  it('keeps separate holds and lists the largest first', () => {
    const boxes = decodeYoloOutputs([
      head(13, [{ row: 2, column: 2, values: CONFIDENT }]),
      head(26, [{ row: 20, column: 20, values: CONFIDENT }]),
    ]);

    expect(boxes).toHaveLength(2);
    expect(boxes[0].width * boxes[0].height).toBeGreaterThan(boxes[1].width * boxes[1].height);
  });

  it('clips boxes to the photo', () => {
    const [box] = decodeYoloOutputs([
      head(13, [{ row: 0, column: 0, values: { ...CONFIDENT, 2: 3, 3: 3 } }]),
    ]);

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1);
    expect(box.y + box.height).toBeLessThanOrEqual(1);
  });

  it('refuses a model whose head is not 3 anchors of 6 values', () => {
    expect(() =>
      decodeYoloOutputs([{ data: new Float32Array(17 * 13 * 13), dims: [1, 17, 13, 13] }])
    ).toThrow('unexpected result');
  });
});
