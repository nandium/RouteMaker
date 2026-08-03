import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderRouteImage } from './canvas.js';
import type { Annotation } from './route-annotations.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new () => { window: Window & typeof globalThis };
};

const routeHold: Annotation = {
  x: 0.3,
  y: 0.4,
  width: 0.1,
  height: 0.1,
  use: 'foot',
  order: 1,
  start_tapes: 2,
  finish_tapes: 1,
};

describe('route image rendering', () => {
  let close: ReturnType<typeof vi.fn>;
  let context: Record<string, unknown>;

  beforeEach(() => {
    const window = new JSDOM().window;
    vi.stubGlobal('document', window.document);
    vi.stubGlobal('File', window.File);
    vi.stubGlobal('Blob', window.Blob);
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
    close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close }))
    );
    context = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      drawImage: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineJoin: '',
      lineTo: vi.fn(),
      lineWidth: 0,
      measureText: vi.fn(() => ({ width: 8 })),
      moveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      setLineDash: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      textAlign: '',
      textBaseline: '',
    };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') return originalCreateElement(tagName);
      return {
        getContext: () => context,
        height: 0,
        toBlob: (callback: BlobCallback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })),
        width: 0,
      } as unknown as HTMLCanvasElement;
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders hold, label, and tape geometry into the published JPEG', async () => {
    const rendered = await renderRouteImage(
      new Blob(['source']),
      [routeHold],
      true,
      512 * 1024,
      1600
    );

    expect(rendered.name).toBe('route.jpg');
    expect(context.strokeRect).toHaveBeenCalledTimes(3);
    expect(context.fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number));
    expect(context.fill).toHaveBeenCalledTimes(3);
    expect(context.stroke).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects undersized sources and releases the decoded image', async () => {
    vi.mocked(createImageBitmap).mockResolvedValueOnce({
      width: 63,
      height: 63,
      close,
    } as unknown as ImageBitmap);

    await expect(
      renderRouteImage(new Blob(['source']), [], true, 512 * 1024, 1600)
    ).rejects.toThrow('at least 64 pixels');
    expect(close).toHaveBeenCalledOnce();
  });
});
