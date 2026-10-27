import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSession, saveSession, storedSession } from './session.js';
import { installDom } from './test-dom.js';

describe('session', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is kept as a token until it is cleared', () => {
    saveSession('token');
    expect(storedSession()).toBe('token');

    clearSession();

    expect(storedSession()).toBeNull();
  });
});
