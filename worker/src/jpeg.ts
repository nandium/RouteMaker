const BASELINE_FRAME = 0xc0;
// Every other frame type: extended, progressive, lossless and arithmetic-coded.
const OTHER_FRAMES = new Set([
  0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Only the header is read, to keep out images that cost clients the most to
 * decode: anything but baseline, and frames larger than `maxDimension`. The
 * file must also end where it claims to, which rejects truncated uploads.
 */
export function isBaselineJpeg(raw: Uint8Array, maxDimension: number): boolean {
  if (raw.length < 4 || raw[0] !== 0xff || raw[1] !== 0xd8) return false;
  if (raw.at(-2) !== 0xff || raw.at(-1) !== 0xd9) return false;
  // Walk the segments before the scan: each is 0xFF, a marker, a length, a payload.
  for (let offset = 2; offset + 4 <= raw.length;) {
    if (raw[offset] !== 0xff) return false;
    const marker = raw[offset + 1];
    if (marker === 0xff) {
      offset++; // fill byte
      continue;
    }
    const length = (raw[offset + 2] << 8) | raw[offset + 3];
    if (length < 2 || offset + 2 + length > raw.length) return false;
    if (marker === BASELINE_FRAME) {
      // Payload: precision (1), height (2), width (2), then at least one component (3).
      if (length < 11) return false;
      const height = (raw[offset + 5] << 8) | raw[offset + 6];
      const width = (raw[offset + 7] << 8) | raw[offset + 8];
      return width > 0 && height > 0 && width <= maxDimension && height <= maxDimension;
    }
    // A scan or another frame type before the baseline frame.
    if (marker === 0xda || OTHER_FRAMES.has(marker)) return false;
    offset += 2 + length;
  }
  return false;
}
