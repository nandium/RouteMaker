import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../client-contract.js';
import { browserRequest } from '../../web/http.js';

describe('browser host seams', () => {
  const storage = {
    values: new Map<string, string>(),
    getItem(key: string) {
      return this.values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      this.values.set(key, value);
    },
    removeItem(key: string) {
      this.values.delete(key);
    },
    clear() {
      this.values.clear();
    },
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('parses API detail and clears an expired browser session', async () => {
    localStorage.setItem(STORAGE_KEYS.session, 'expired');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Session expired.' }),
      }))
    );

    await expect(browserRequest('/me')).rejects.toMatchObject({
      message: 'Session expired.',
      status: 401,
    });
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('resolves empty successful responses without attempting JSON parsing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 204, json: vi.fn() }))
    );
    await expect(browserRequest('/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
