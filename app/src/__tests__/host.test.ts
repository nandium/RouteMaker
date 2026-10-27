import { afterEach, expect, test, vi } from 'vitest';

import { nativeMap, navigation, session, share } from '../host.js';
import { installHost, resetHost } from './support.js';

afterEach(() => resetHost());

test('loads no session when the host has none', async () => {
  await expect(session.load()).resolves.toBeNull();

  installHost({ RouteMakerSession: { getToken: (done: (token: string) => void) => done('') } });
  await expect(session.load()).resolves.toBeNull();

  installHost({ RouteMakerSession: { getToken: (done: (token: string) => void) => done('abc') } });
  await expect(session.load()).resolves.toBe('abc');
});

test('stores and clears the session through the host', () => {
  const store = { setToken: vi.fn(), clearToken: vi.fn() };
  installHost({ RouteMakerSession: store });

  session.save('abc');
  session.clear();

  expect(store.setToken).toHaveBeenCalledWith('abc');
  expect(store.clearToken).toHaveBeenCalledOnce();
});

test('only reports Back as handled when the host owns history', () => {
  expect(navigation.back('/gyms')).toBe(false);

  const back = vi.fn();
  installHost({ RouteMakerNavigation: { back } });
  expect(navigation.back('/gyms')).toBe(true);
  expect(back).toHaveBeenCalledWith('/gyms');
});

test('tolerates hosts without history or Back reporting', () => {
  installHost({ RouteMakerNavigation: { openExternal: vi.fn() } });

  expect(() => {
    navigation.push('/a');
    navigation.replace('/b');
    navigation.setCanGoBack(true);
  }).not.toThrow();
});

test('resolves whether the host opened a URL', async () => {
  await expect(navigation.openExternal('https://x.test', false)).resolves.toBe(false);

  const openExternal = vi.fn((_url: string, _replace: boolean, done: (ok: boolean) => void) =>
    done(true)
  );
  installHost({ RouteMakerNavigation: { openExternal } });
  await expect(navigation.openExternal('https://x.test', true)).resolves.toBe(true);
  expect(openExternal).toHaveBeenCalledWith('https://x.test', true, expect.any(Function));
});

test('passes the share outcome through, and is unavailable without a host', async () => {
  await expect(share('https://x.test/r', 'Route')).resolves.toBe('unavailable');

  const send = vi.fn((_url: string, _title: string, done: (result: string) => void) =>
    done('opened')
  );
  installHost({ RouteMakerShare: { share: send } });
  await expect(share('https://x.test/r', 'Route')).resolves.toBe('opened');
  expect(send).toHaveBeenCalledWith('https://x.test/r', 'Route', expect.any(Function));
});

test('has a native map only where the host provides one', () => {
  expect(nativeMap()).toBeUndefined();
  installHost({ RouteMakerMap: { open: vi.fn() } });
  expect(nativeMap()).toBeDefined();
});
