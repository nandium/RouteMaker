import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_THUMBNAIL_BYTES,
  MAX_THUMBNAIL_DIMENSION,
} from '../../src/client-contract.js';
import { installDom, settle } from '../test-dom.js';
import { MARK_COLORS } from '../../src/marking-colors.js';
import type { Annotation } from './route-annotations.js';
import { fitCanvasSize, renderRouteImages } from './route-image.js';

const hold: Annotation = {
  x: 0.3,
  y: 0.4,
  width: 0.1,
  height: 0.1,
  use: 'foot',
  order: 1,
  tapes: { start: 2, finish: 1 },
};
const small = { width: 800, height: 600 };
const render = (size = small, annotations = [hold]) =>
  renderRouteImages(new Blob(['photo']), size, annotations, true);

type Encode = { width: number; height: number; quality: number };

/** A canvas that records each encode; `bytesFor` decides how large the JPEG would be (-1: fails). */
function stubCanvas(bytesFor: (encode: Encode) => number = () => 1000) {
  const painted: string[] = [];
  const colours = new Set<string>();
  let fillStyle = '';
  let strokeStyle = '';
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(() => painted.push('photo')),
    fill: vi.fn(),
    fillRect: vi.fn(() => painted.push(`rect ${fillStyle}`)),
    fillText: vi.fn(),
    font: '',
    globalAlpha: 1,
    imageSmoothingQuality: '',
    lineTo: vi.fn(),
    lineWidth: 0,
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    textAlign: '',
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      colours.add((fillStyle = value));
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      colours.add((strokeStyle = value));
    },
  };
  const encodes: Encode[] = [];
  const canvases: Array<{ width: number; height: number }> = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return create(tag);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (done: BlobCallback, _type: string, quality: number) => {
        const encode = { width: canvas.width, height: canvas.height, quality };
        encodes.push(encode);
        const bytes = bytesFor(encode);
        done(bytes < 0 ? null : new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
      },
    };
    canvases.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  });
  return { canvases, colours, context, encodes, painted };
}

function stubBitmap(size = small) {
  const bitmap = { ...size, close: vi.fn() };
  const decode = vi.fn(async () => bitmap);
  vi.stubGlobal('createImageBitmap', decode);
  return { bitmap, decode };
}

describe('route image rendering', () => {
  beforeEach(() => {
    installDom();
    // The published colours are fixed; reading the page's would be a bug.
    vi.stubGlobal('getComputedStyle', () => {
      throw new Error('The published image must not depend on the page theme.');
    });
    vi.stubGlobal('FontFace', undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the photo and a thumbnail as JPEG files', async () => {
    stubCanvas();
    stubBitmap();

    const { photo, thumbnail } = await render();

    expect(photo).toMatchObject({ name: 'route.jpg', type: 'image/jpeg' });
    expect(thumbnail).toMatchObject({ name: 'thumbnail.jpg', type: 'image/jpeg' });
  });

  it('draws the markings in the fixed marking palette over a white-backed photo', async () => {
    const { colours, context, painted } = stubCanvas();
    stubBitmap();

    await render();

    expect(painted.slice(0, 2)).toEqual(['rect #ffffff', 'photo']);
    expect(context.fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number));
    const marking = [...colours].filter((colour) => colour !== '#ffffff');
    expect(marking.length).toBeGreaterThan(0);
    expect(marking.every((colour) => Object.values(MARK_COLORS).includes(colour as never))).toBe(
      true
    );
  });

  it('waits for the display font, so labels are not drawn in a fallback', async () => {
    vi.resetModules(); // the font is registered once per page
    const { renderRouteImages: renderFresh } = await import('./route-image.js');
    const { context } = stubCanvas();
    stubBitmap();
    let loaded = false;
    vi.stubGlobal(
      'FontFace',
      class {
        load = vi.fn(async () => {
          await settle();
          loaded = true;
        });
      }
    );
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: vi.fn() } });
    context.fillText.mockImplementation(() => expect(loaded).toBe(true));

    await renderFresh(new Blob(['photo']), small, [hold], true);

    expect(context.fillText).toHaveBeenCalled();
  });

  it('decodes once and shares the bitmap between both images', async () => {
    stubCanvas();
    const { bitmap, decode } = stubBitmap({ width: 1600, height: 800 });

    await render({ width: 4800, height: 2400 });

    expect(decode).toHaveBeenCalledOnce();
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: 'from-image',
      resizeWidth: 1600,
      resizeHeight: 800,
      resizeQuality: 'high',
    });
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('decodes in full when the browser ignores the resize options', async () => {
    stubCanvas();
    const full = { width: 4800, height: 2400, close: vi.fn() };
    const ignored = { width: 2400, height: 4800, close: vi.fn() };
    const decode = vi.fn().mockResolvedValueOnce(ignored).mockResolvedValueOnce(full);
    vi.stubGlobal('createImageBitmap', decode);

    await render({ width: 4800, height: 2400 });

    expect(ignored.close).toHaveBeenCalledOnce();
    expect(full.close).toHaveBeenCalledOnce();
    expect(decode).toHaveBeenLastCalledWith(expect.any(Blob), { imageOrientation: 'from-image' });
  });

  it('keeps the photo and the thumbnail within their own maximum dimensions', async () => {
    const { encodes } = stubCanvas();
    stubBitmap({ width: 1600, height: 800 });

    await render({ width: 6000, height: 3000 });

    const [photo, thumbnail] = encodes;
    expect(Math.max(photo.width, photo.height)).toBe(MAX_IMAGE_DIMENSION);
    expect(Math.max(thumbnail.width, thumbnail.height)).toBe(MAX_THUMBNAIL_DIMENSION);
    expect(thumbnail.width / thumbnail.height).toBeCloseTo(photo.width / photo.height, 1);
    expect(fitCanvasSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('lowers the JPEG quality before shrinking', async () => {
    const { encodes } = stubCanvas(({ quality }) => (quality > 0.6 ? MAX_IMAGE_BYTES + 1 : 1000));
    stubBitmap({ width: 1600, height: 1200 });

    await render({ width: 1600, height: 1200 });

    expect(encodes.slice(0, 3).map(({ width, quality }) => [width, quality])).toEqual([
      [1600, 0.82],
      [1600, 0.68],
      [1600, 0.54],
    ]);
  });

  it('steps down to smaller dimensions when quality alone is not enough', async () => {
    const { encodes } = stubCanvas(({ width }) => (width > 1400 ? MAX_IMAGE_BYTES + 1 : 1000));
    stubBitmap({ width: 1600, height: 1200 });

    const { photo } = await render({ width: 1600, height: 1200 });

    expect(photo.size).toBe(1000);
    expect(encodes.find((encode) => encode.width < 1600)).toMatchObject({ width: 1280 });
  });

  it('fits the thumbnail under its smaller byte limit by shrinking it', async () => {
    const { encodes } = stubCanvas(({ width }) =>
      width > 500 && width <= 640 ? MAX_THUMBNAIL_BYTES + 1 : 1000
    );
    stubBitmap({ width: 1600, height: 1200 });

    const { thumbnail } = await render({ width: 1600, height: 1200 });

    expect(thumbnail.size).toBe(1000);
    expect(encodes.at(-1)!.width).toBeLessThan(640);
  });

  it('gives up with a message when nothing fits, and still frees everything', async () => {
    const { canvases } = stubCanvas(() => MAX_IMAGE_BYTES + 1);
    const { bitmap } = stubBitmap();

    await expect(render()).rejects.toThrow('cannot be compressed enough');

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvases.every((canvas) => canvas.width === 0)).toBe(true);
  });

  it('reports an encoder failure and frees the bitmap', async () => {
    stubCanvas(() => -1);
    const { bitmap } = stubBitmap();

    await expect(render()).rejects.toThrow('Could not encode');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
