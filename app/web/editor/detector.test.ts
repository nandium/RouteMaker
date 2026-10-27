import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Detection, DetectorResponse } from './yolo.js';

class FakeWorker {
  static instances: FakeWorker[] = [];
  listeners = new Map<string, (event: unknown) => void>();
  posted: Array<{ image: Blob }> = [];
  terminated = false;
  throwOnPost = false;

  constructor() {
    FakeWorker.instances.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, listener);
  }
  postMessage(message: { image: Blob }) {
    if (this.throwOnPost) throw new Error('clone failed');
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(response: DetectorResponse) {
    this.listeners.get('message')?.({ data: response });
  }
  emit(type: string) {
    this.listeners.get(type)?.({});
  }
}

const hold: Detection = { x: 0.1, y: 0.1, width: 0.2, height: 0.2, confidence: 0.9 };
const image = new Blob(['photo']);

/** A fresh copy of the module, since it keeps its worker for the whole page session. */
async function loadDetector() {
  vi.resetModules();
  return (await import('./detector.js')).detectHolds;
}

describe('hold detector', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    // Vite rewrites `new Worker(new URL(..., import.meta.url))` to resolve against `self.location`.
    vi.stubGlobal('self', { location: 'http://localhost/' });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends the photo and resolves with the boxes, reporting progress', async () => {
    const detectHolds = await loadDetector();
    const progress = vi.fn();
    const pending = detectHolds(image, progress);
    const worker = FakeWorker.instances[0];

    worker.reply({ type: 'progress', stage: 'loading' });
    worker.reply({ type: 'progress', stage: 'detecting' });
    worker.reply({ type: 'result', boxes: [hold] });

    await expect(pending).resolves.toEqual([hold]);
    expect(worker.posted).toEqual([{ image }]);
    expect(progress.mock.calls).toEqual([['Loading the hold detector…'], ['Finding holds…']]);
  });

  it('reuses one worker so the loaded model stays in memory', async () => {
    const detectHolds = await loadDetector();

    const first = detectHolds(image, vi.fn());
    FakeWorker.instances[0].reply({ type: 'result', boxes: [] });
    await first;
    const second = detectHolds(image, vi.fn());
    FakeWorker.instances[0].reply({ type: 'result', boxes: [] });
    await second;

    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].posted).toHaveLength(2);
  });

  it('runs one detection at a time', async () => {
    const detectHolds = await loadDetector();
    const first = detectHolds(image, vi.fn());

    await expect(detectHolds(image, vi.fn())).rejects.toThrow('already running');

    FakeWorker.instances[0].reply({ type: 'result', boxes: [] });
    await expect(first).resolves.toEqual([]);
  });

  it('rejects with the worker message when inference fails, and can be retried', async () => {
    const detectHolds = await loadDetector();
    const failed = detectHolds(image, vi.fn());

    FakeWorker.instances[0].reply({ type: 'error', message: 'Model failed' });
    await expect(failed).rejects.toThrow('Model failed');

    const retry = detectHolds(image, vi.fn());
    FakeWorker.instances[0].reply({ type: 'result', boxes: [hold] });
    await expect(retry).resolves.toEqual([hold]);
  });

  it('drops a crashed worker and starts a fresh one next time', async () => {
    const detectHolds = await loadDetector();
    const pending = detectHolds(image, vi.fn());
    const crashed = FakeWorker.instances[0];

    crashed.emit('error');

    await expect(pending).rejects.toThrow('Hold detection stopped.');
    expect(crashed.terminated).toBe(true);
    const retry = detectHolds(image, vi.fn());
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].reply({ type: 'result', boxes: [hold] });
    await expect(retry).resolves.toEqual([hold]);
  });

  it('gives a model that never loads two minutes, then terminates the worker', async () => {
    const detectHolds = await loadDetector();
    const pending = detectHolds(image, vi.fn());
    const worker = FakeWorker.instances[0];
    const rejected = expect(pending).rejects.toThrow('timed out');

    vi.advanceTimersByTime(119_000);
    expect(worker.terminated).toBe(false);
    vi.advanceTimersByTime(1_000);

    await rejected;
    expect(worker.terminated).toBe(true);
  });

  it('gives inference thirty seconds once the model is ready', async () => {
    const detectHolds = await loadDetector();
    const pending = detectHolds(image, vi.fn());
    const worker = FakeWorker.instances[0];
    const rejected = expect(pending).rejects.toThrow('timed out');

    vi.advanceTimersByTime(60_000);
    worker.reply({ type: 'progress', stage: 'detecting' });
    vi.advanceTimersByTime(29_000);
    expect(worker.terminated).toBe(false);
    vi.advanceTimersByTime(1_000);

    await rejected;
    expect(worker.terminated).toBe(true);
  });

  it('rejects when the request cannot be posted', async () => {
    const detectHolds = await loadDetector();
    const first = detectHolds(image, vi.fn());
    const worker = FakeWorker.instances[0];
    worker.reply({ type: 'result', boxes: [] });
    await first;
    worker.throwOnPost = true;

    await expect(detectHolds(image, vi.fn())).rejects.toThrow('clone failed');
    expect(worker.terminated).toBe(true);
  });
});
