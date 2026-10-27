import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteStorage, readStorage, writeStorage } from './storage.js';
import { installDom } from './test-dom.js';

describe('storage', () => {
  beforeEach(() => {
    installDom();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('round-trips values', () => {
    writeStorage('key', 'value');
    expect(readStorage('key')).toBe('value');
    deleteStorage('key');
    expect(readStorage('key')).toBeNull();
  });

  it('stays quiet when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    expect(readStorage('key')).toBeNull();
    expect(() => writeStorage('key', 'value')).not.toThrow();
    expect(() => deleteStorage('key')).not.toThrow();
  });
});
