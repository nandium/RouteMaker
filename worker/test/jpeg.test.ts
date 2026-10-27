import { describe, expect, it } from 'vitest';
import { isBaselineJpeg } from '../src/jpeg';
import { JPEG, jpegOfLength, jpegOfSize } from './fixture';

const valid = (bytes: Uint8Array, max = 1600) => isBaselineJpeg(bytes, max);

/** Copy of the fixture with `edit` applied at its start-of-frame marker. */
function patched(edit: (bytes: Uint8Array, frame: number) => void) {
  const bytes = JPEG.slice();
  edit(
    bytes,
    bytes.findIndex((value, i) => value === 0xff && bytes[i + 1] === 0xc0)
  );
  return bytes;
}

describe('isBaselineJpeg', () => {
  it('accepts a baseline JPEG, including a large one', () => {
    expect(valid(JPEG)).toBe(true);
    expect(valid(jpegOfLength(512 * 1024))).toBe(true);
  });

  it('bounds both dimensions by the given maximum', () => {
    expect(valid(jpegOfSize(1600, 1600))).toBe(true);
    expect(valid(jpegOfSize(1601, 1))).toBe(false);
    expect(valid(jpegOfSize(1, 1601))).toBe(false);
    expect(valid(jpegOfSize(0, 1))).toBe(false);
    expect(valid(jpegOfSize(1, 0))).toBe(false);
    expect(valid(jpegOfSize(640, 640), 640)).toBe(true);
    expect(valid(jpegOfSize(641, 1), 640)).toBe(false);
  });

  it('rejects every other frame type', () => {
    for (const marker of [0xc1, 0xc2, 0xc3, 0xc5, 0xc9, 0xca, 0xcf]) {
      const bytes = patched((copy, frame) => (copy[frame + 1] = marker));
      expect(valid(bytes), marker.toString(16)).toBe(false);
    }
  });

  it('rejects a scan that comes before any frame', () => {
    const bytes = patched((copy, frame) => (copy[frame + 1] = 0xda));
    expect(valid(bytes)).toBe(false);
  });

  it('requires the file to start and end where a JPEG does', () => {
    expect(valid(JPEG.subarray(0, 40))).toBe(false);
    expect(valid(JPEG.subarray(0, -2))).toBe(false);
    expect(valid(new Uint8Array([...JPEG, 0]))).toBe(false);
    expect(valid(patched((bytes) => (bytes[0] = 0)))).toBe(false);
    expect(valid(new Uint8Array())).toBe(false);
    expect(valid(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(false);
  });

  it('rejects segments that overrun the file', () => {
    const bytes = patched((copy, frame) => copy.set([0xff, 0xff], frame + 2));
    expect(valid(bytes)).toBe(false);
  });
});
