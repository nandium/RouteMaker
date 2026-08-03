import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../api.js', () => ({ apiBaseUrl: 'https://routes.example' }));

import { shareRoute } from '../share.js';

const baselineNativeModules = globalThis.NativeModules;

beforeEach(() => {
  globalThis.NativeModules = baselineNativeModules;
});

test('preserves the opened result for native chooser presentation', async () => {
  const share = vi.fn((_url: string, _title: string, callback: (result: 'opened') => void) => {
    callback('opened');
  });
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerShare: { share },
  };

  await expect(shareRoute('blue', 'Blue Moon')).resolves.toBe('opened');
  expect(share).toHaveBeenCalledWith(
    'https://routes.example/routes/blue',
    'Blue Moon',
    expect.any(Function)
  );
});
