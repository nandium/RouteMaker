import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installDom } from './test-dom.js';

describe('display font', () => {
  const faces: Array<{ family: string; source: string; weight: string }> = [];
  const add = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    installDom();
    faces.length = 0;
    add.mockClear();
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(family: string, source: string, descriptors: { weight: string }) {
          faces.push({ family, source, weight: descriptors.weight });
        }
        load = vi.fn(async () => this);
      }
    );
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('registers RM Display once, on the document', async () => {
    const { loadDisplayFont } = await import('./fonts.js');

    await Promise.all([loadDisplayFont(), loadDisplayFont()]);

    expect(faces).toEqual([
      { family: 'RM Display', source: expect.stringMatching(/^url\(.+\.woff2/), weight: '800' },
    ]);
    expect(add).toHaveBeenCalledOnce();
  });

  it('settles quietly when fonts are unavailable', async () => {
    vi.stubGlobal('FontFace', undefined);
    const { loadDisplayFont } = await import('./fonts.js');

    await expect(loadDisplayFont()).resolves.toBeUndefined();
  });
});
