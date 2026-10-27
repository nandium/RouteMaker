import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { absoluteUrl, api } from '../api.js';

const original = { fetch: lynx.fetch, props: lynx.__globalProps };

beforeEach(() => {
  lynx.__globalProps = { apiBaseUrl: 'https://routes.example/', themePreference: 'system' };
  lynx.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })) as never;
});

afterEach(() => {
  lynx.fetch = original.fetch;
  lynx.__globalProps = original.props;
  vi.unstubAllGlobals();
});

const lastCall = () => vi.mocked(lynx.fetch).mock.calls.at(-1)! as unknown as [string, RequestInit];

test('builds absolute URLs from the host base URL without doubling slashes', () => {
  expect(absoluteUrl('/media/a.jpg')).toBe('https://routes.example/media/a.jpg');
});

test('encodes route filters and omits the unset ones', async () => {
  await api.routes('t', { gymId: 'a b', following: true });
  expect(lastCall()[0]).toBe('https://routes.example/api/routes?gym_id=a%20b&following=true');

  await api.routes(null);
  expect(lastCall()[0]).toBe('https://routes.example/api/routes');
  expect(lastCall()[1].headers).toEqual({});
});

test('authenticates mutations with the bearer token', async () => {
  await api.setUserDisabled('admin-token', 'u1', true);

  const [url, init] = lastCall();
  expect(url).toBe('https://routes.example/api/admin/users/u1');
  expect(init).toMatchObject({
    method: 'PUT',
    headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
    body: '{"disabled":true}',
  });
});

test('uses the browser fetch when the bundle runs in the web host', async () => {
  const browserFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }));
  vi.stubGlobal('fetch', browserFetch);
  lynx.__globalProps = { apiBaseUrl: '', webHost: true, themePreference: 'system' };

  await api.gyms();

  expect(browserFetch).toHaveBeenCalledOnce();
  expect(lynx.fetch).not.toHaveBeenCalled();
});
