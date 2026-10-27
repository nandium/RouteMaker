import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, browserRequest, isUnauthorized } from './http.js';
import { STORAGE_KEYS } from './storage.js';
import { installDom } from './test-dom.js';

const unauthorized = () =>
  vi.fn(async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: 'Session expired.' }),
  }));

// Parsing and error mapping are covered by the shared fetchJson tests in src/.
describe('browserRequest', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('drops a session the server rejected', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'expired');
    vi.stubGlobal('fetch', unauthorized());

    const failure = await browserRequest('/me', { token: 'expired' }).catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(isUnauthorized(failure)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('keeps a stored session when the failed request carried no token', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'valid');
    vi.stubGlobal('fetch', unauthorized());

    await expect(browserRequest('/gyms')).rejects.toThrow('Session expired.');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('valid');
  });

  it('keeps a newer session when an older token is rejected', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'newer');
    vi.stubGlobal('fetch', unauthorized());

    await expect(browserRequest('/me', { token: 'older' })).rejects.toThrow('Session expired.');

    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('newer');
  });

  it('calls the same-origin API', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }));
    vi.stubGlobal('fetch', fetcher);

    await browserRequest('/gyms');

    expect(fetcher).toHaveBeenCalledWith('/api/gyms', expect.anything());
  });
});
