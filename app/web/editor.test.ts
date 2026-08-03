import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Gym, Metadata } from '../src/client-contract.js';
import { API_PATHS, STORAGE_KEYS } from '../src/client-contract.js';

vi.mock('./canvas.js', () => ({
  MAX_SOURCE_IMAGE_BYTES: 15 * 1024 * 1024,
  renderRouteImage: vi.fn(),
}));
vi.mock('./detector.js', () => ({ detectHolds: vi.fn() }));
vi.mock('./http.js', () => ({ browserRequest: vi.fn() }));

import { detectHolds } from './detector.js';
import { renderRouteImage } from './canvas.js';
import { mountEditor } from './editor.js';
import { browserRequest } from './http.js';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html?: string, options?: { url?: string }) => { window: Window & typeof globalThis };
};

const gyms: Gym[] = [
  {
    id: 'gym',
    name: 'Test Gym',
    address: '1 Test Street',
    country_code: 'SG',
    latitude: 1.3,
    longitude: 103.8,
    status: 'approved',
  },
];
const metadata: Metadata = {
  grades: ['V4'],
  default_grade: 'V4',
  max_image_bytes: 512 * 1024,
  max_image_dimension: 1600,
};

let triggerResize: () => void;
let previewWidth = 1000;
let previewHeight = 600;

function rectangle(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  };
}

function choosePhoto(root: HTMLElement) {
  const input = root.querySelector<HTMLInputElement>('#route-photo')!;
  const image = root.querySelector<HTMLImageElement>('.preview img')!;
  const photo = new File(['photo'], 'wall.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { configurable: true, value: [photo] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: 1600 },
    naturalHeight: { configurable: true, value: 960 },
  });
  image.onload?.(new Event('load'));
}

async function detectOneHold(root: HTMLElement) {
  const detect = root.querySelector<HTMLButtonElement>('[aria-label="Auto-detect holds"]')!;
  detect.focus();
  detect.click();
  await vi.waitFor(() => expect(root.querySelectorAll('.marker')).toHaveLength(1));
  return detect;
}

describe('route editor interactions', () => {
  beforeEach(() => {
    const window = new JSDOM('', { url: 'http://localhost/new-route' }).window;
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', window.document);
    vi.stubGlobal('location', window.location);
    vi.stubGlobal('localStorage', window.localStorage);
    vi.stubGlobal('HTMLElement', window.HTMLElement);
    vi.stubGlobal('File', window.File);
    vi.stubGlobal('FormData', window.FormData);
    vi.stubGlobal('Event', window.Event);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:wall'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          triggerResize = () => callback([], this as unknown as ResizeObserver);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    localStorage.setItem(STORAGE_KEYS.session, 'test-session');
    previewWidth = 1000;
    previewHeight = 600;
    vi.mocked(detectHolds).mockResolvedValue([
      { x: 0.4, y: 0.4, width: 0.1, height: 0.1, confidence: 0.9, class: 'hold' },
    ]);
    vi.mocked(renderRouteImage).mockResolvedValue(
      new File(['jpeg'], 'route.jpg', { type: 'image/jpeg' })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function mountedEditor() {
    const root = document.createElement('main');
    document.body.append(root);
    mountEditor(root, gyms, metadata);
    const preview = root.querySelector<HTMLElement>('.preview')!;
    preview.getBoundingClientRect = () => rectangle(previewWidth, previewHeight);
    choosePhoto(root);
    return { root, preview };
  }

  it('restores detection focus and names the wall photo', async () => {
    const { root, preview } = mountedEditor();
    const detect = await detectOneHold(root);
    const markingPanel = root.querySelector('.hold-editor')!;
    const actions = markingPanel.querySelector('.hold-editor__actions')!;

    expect(document.activeElement).toBe(detect);
    expect(preview.tabIndex).toBe(0);
    expect(root.querySelector<HTMLImageElement>('.preview img')!.alt).toBe(
      'Selected climbing wall'
    );
    expect(root.querySelector('.marker')!.getAttribute('aria-label')).toContain(
      'Detected hold 1 of 1'
    );
    expect(actions.querySelector('[aria-label="Auto-detect holds"]')).not.toBeNull();
    expect(actions.querySelector('[aria-label="Undo last change"]')).not.toBeNull();
    expect(actions.querySelector('[aria-label="Clear route markings"]')).not.toBeNull();
    expect(actions.querySelector('.sequence-toggle')).not.toBeNull();
    expect(markingPanel.querySelector('.tool-status')).not.toBeNull();
    expect(root.lastElementChild?.classList.contains('tool-status')).toBe(false);
  });

  it('positions and adds a manual marker from the keyboard', () => {
    const { root, preview } = mountedEditor();
    preview.focus();

    preview.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    preview.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    preview.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(root.querySelectorAll('.marker')).toHaveLength(1);
    expect(root.querySelector<HTMLElement>('.preview-cursor')!.style.left).toBe('52%');
    expect(root.querySelector<HTMLElement>('.preview-cursor')!.style.top).toBe('52%');
    expect(Number.parseFloat(root.querySelector<HTMLElement>('.marker')!.style.left)).toBeCloseTo(
      480
    );
  });

  it('draws an exact boundary and deletes the box independently of route markings', () => {
    const { root, preview } = mountedEditor();
    preview.dispatchEvent(
      new window.MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 100,
        clientY: 120,
      })
    );
    preview.dispatchEvent(
      new window.MouseEvent('pointermove', { bubbles: true, clientX: 320, clientY: 260 })
    );
    preview.dispatchEvent(
      new window.MouseEvent('pointerup', { bubbles: true, clientX: 320, clientY: 260 })
    );

    const boundary = root.querySelector<HTMLElement>('.marker__box')!;
    expect(boundary.style.width).toBe('220px');
    expect(boundary.style.height).toBe('140px');

    root.querySelector<HTMLButtonElement>('[aria-label="Clear route markings"]')!.click();
    expect(root.querySelector('.marker--candidate')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[aria-label^="Delete boundary"]')!.click();
    root.querySelector<HTMLButtonElement>('.marker')!.click();
    expect(root.querySelector('.marker')).toBeNull();

    root.querySelector<HTMLButtonElement>('[aria-label="Undo last change"]')!.click();
    expect(root.querySelector('.marker--candidate')).not.toBeNull();
  });

  it('caps and removes one clustered tape group, then redraws it on resize', async () => {
    const { root } = mountedEditor();
    await detectOneHold(root);
    root.querySelector<HTMLButtonElement>('[aria-label^="Start tape"]')!.click();

    for (let tap = 0; tap < 5; tap += 1) {
      root.querySelector<HTMLButtonElement>('.marker')!.click();
    }
    expect(root.querySelectorAll('.marker-tape')).toHaveLength(1);
    expect(root.querySelectorAll('.marker-tape__strip')).toHaveLength(4);
    expect(root.querySelectorAll('.marker-tape__remove')).toHaveLength(1);

    const tape = root.querySelector<HTMLButtonElement>('.marker-tape')!;
    tape.focus();
    root
      .querySelector<HTMLElement>('.marker-tape__remove')!
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(root.querySelectorAll('.marker-tape__strip')).toHaveLength(3);
    expect(document.activeElement).toBe(root.querySelector('.marker-tape'));

    const leftBeforeResize = root.querySelector<HTMLElement>('.marker-tape')!.style.left;
    previewWidth = 500;
    previewHeight = 300;
    triggerResize();
    expect(root.querySelector<HTMLElement>('.marker-tape')!.style.left).not.toBe(leftBeforeResize);

    root.querySelector<HTMLButtonElement>('[aria-label="Undo last change"]')!.click();
    expect(root.querySelectorAll('.marker-tape__strip')).toHaveLength(4);
  });

  it('routes overlapping mobile taps to the nearest visible marking', async () => {
    previewWidth = 320;
    previewHeight = 240;
    const { root } = mountedEditor();
    await detectOneHold(root);
    root.querySelector<HTMLButtonElement>('[aria-label^="Start tape"]')!.click();
    root.querySelector<HTMLButtonElement>('.marker')!.click();
    root.querySelector<HTMLButtonElement>('[aria-label^="Hand only"]')!.click();

    root.querySelector<HTMLButtonElement>('.marker-tape')!.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        clientX: 144,
        clientY: 108,
        detail: 1,
      })
    );
    expect(root.querySelector('.marker')!.classList.contains('marker--hand')).toBe(true);
    expect(root.querySelectorAll('.marker-tape')).toHaveLength(1);

    const tape = root.querySelector<HTMLButtonElement>('.marker-tape')!;
    const strip = tape.querySelector<HTMLElement>('.marker-tape__strip')!;
    const tapeCenterX =
      Number.parseFloat(tape.style.left) +
      Number.parseFloat(strip.style.left) +
      Number.parseFloat(strip.style.width) / 2;
    const tapeCenterY =
      Number.parseFloat(tape.style.top) +
      Number.parseFloat(strip.style.top) +
      Number.parseFloat(strip.style.height) / 2;
    tape.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        clientX: tapeCenterX,
        clientY: tapeCenterY,
        detail: 1,
      })
    );
    expect(root.querySelectorAll('.marker-tape')).toHaveLength(0);
  });

  it('keeps start and finish roles mutually exclusive on each hold', async () => {
    const { root } = mountedEditor();
    await detectOneHold(root);
    root.querySelector<HTMLButtonElement>('[aria-label^="Start tape"]')!.click();
    root.querySelector<HTMLButtonElement>('.marker')!.click();
    root.querySelector<HTMLButtonElement>('[aria-label^="Finish tape"]')!.click();
    root.querySelector<HTMLButtonElement>('.marker')!.click();

    expect(root.querySelector('.marker-tape--start')).toBeNull();
    expect(root.querySelectorAll('.marker-tape--finish')).toHaveLength(1);
    expect(root.querySelector('.hold-editor__summary')!.textContent).toContain(
      '0/4 start · 1/2 finish'
    );
  });

  it('validates the route name before rendering the upload', () => {
    const { root, preview } = mountedEditor();
    preview.click();

    root.querySelector<HTMLButtonElement>('.tool-publish button')!.click();

    expect(root.querySelector('.tool-status')!.textContent).toBe(
      'Name the route before publishing.'
    );
    expect(document.activeElement).toBe(root.querySelector('[aria-label="Route name"]'));
    expect(renderRouteImage).not.toHaveBeenCalled();
  });

  it('publishes the selected markings and route fields', async () => {
    const { root, preview } = mountedEditor();
    root.querySelector<HTMLInputElement>('[aria-label="Route name"]')!.value = '  Test route  ';
    preview.click();
    root.querySelector<HTMLButtonElement>('[aria-label="Hide sequence numbers"]')!.click();

    root.querySelector<HTMLButtonElement>('.tool-publish button')!.click();

    await vi.waitFor(() => expect(browserRequest).toHaveBeenCalledOnce());
    const [source, annotations, showSequence] = vi.mocked(renderRouteImage).mock.calls[0];
    expect(source).toBeInstanceOf(File);
    expect(annotations).toMatchObject([
      {
        use: 'any',
        order: 1,
        start_tapes: 0,
        finish_tapes: 0,
      },
    ]);
    expect(showSequence).toBe(false);
    const [path, options] = vi.mocked(browserRequest).mock.calls[0];
    const body = options!.body as FormData;
    expect(path).toBe(API_PATHS.routes);
    expect(options).toMatchObject({ method: 'POST', token: 'test-session' });
    expect(body.get('name')).toBe('Test route');
    expect(body.get('gym_id')).toBe('gym');
    expect(body.get('owner_grade')).toBe('V4');
    expect(body.get('image')).toBeInstanceOf(File);
  });
});
