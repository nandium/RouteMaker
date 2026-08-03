import { describe, expect, it } from 'vitest';

import { fitCanvasSize } from '../../web/canvas.js';
import { decodeYoloOutputs } from '../../web/yolo.js';

function head(grid: number, values: Record<number, number>) {
  const data = new Float32Array(18 * grid * grid);
  Object.entries(values).forEach(([index, value]) => {
    data[Number(index)] = value;
  });
  return { data, dims: [1, 18, grid, grid] };
}

describe('browser detection and publishing geometry', () => {
  it('decodes a confident cell into normalized model coordinates', () => {
    const cell = 6 * 13 + 6;
    const plane = 13 * 13;
    const output = head(13, {
      [cell + 4 * plane]: 8,
      [cell + 5 * plane]: 8,
    });
    const [box] = decodeYoloOutputs([output]);
    expect(box?.confidence).toBeGreaterThan(0.99);
    expect(box?.x).toBeGreaterThan(0.4);
    expect(box?.x).toBeLessThan(0.7);
    expect(box?.y).toBeGreaterThan(0.4);
    expect(box?.width).toBeGreaterThan(0);
  });

  it('suppresses overlapping detections with the lower confidence', () => {
    const plane = 26 * 26;
    const cell = 13;
    const strong = head(26, {
      [cell + 4 * plane]: 8,
      [cell + 5 * plane]: 8,
    });
    const weak = head(26, {
      [cell + 4 * plane]: 7,
      [cell + 5 * plane]: 7,
    });
    expect(decodeYoloOutputs([strong, weak])).toHaveLength(1);
  });

  it('caps the long edge while preserving aspect ratio', () => {
    expect(fitCanvasSize(4800, 2400, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitCanvasSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
