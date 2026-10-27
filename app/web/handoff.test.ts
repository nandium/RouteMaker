import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS } from '../src/client-contract.js';
import type { AuthSession } from '../src/client-contract.js';
import { signInFromApp, takeHandoffCode } from './handoff.js';
import { browserRequest } from './http.js';
import { STORAGE_KEYS } from './storage.js';
import { byRole, installDom, queryByRole, settle } from './test-dom.js';

vi.mock('./http.js', () => ({ browserRequest: vi.fn() }));

const request = vi.mocked(browserRequest);
const code = 'ab'.repeat(32);
const session: AuthSession = {
  token: 'session-token',
  user: {
    id: 'u1',
    email: 'maya@example.com',
    username: 'maya',
    display_name: 'Maya',
    role: 'user',
    disabled: false,
  },
};

describe('hand-off code', () => {
  beforeEach(() => {
    installDom('http://localhost/gyms?view=all');
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is taken from the fragment and removed from the address bar', () => {
    history.replaceState(null, '', `/gyms?view=all#handoff=${code}`);

    expect(takeHandoffCode()).toBe(code);

    expect(location.hash).toBe('');
    expect(location.pathname + location.search).toBe('/gyms?view=all');
  });

  it('is removed even when malformed, and is not offered for redeeming', () => {
    history.replaceState(null, '', '/gyms#handoff=not-a-code&x=1');

    expect(takeHandoffCode()).toBeNull();
    expect(location.hash).toBe('');
  });

  it('leaves other fragments alone', () => {
    history.replaceState(null, '', '/gyms#section');

    expect(takeHandoffCode()).toBeNull();
    expect(location.hash).toBe('#section');
  });
});

describe('signing in from the app', () => {
  const alex = { ...session.user, id: 'u2', username: 'alex' };

  /** The server: the code is `session`'s, and `me` says who the stored token belongs to. */
  function server(me: unknown = alex) {
    request.mockImplementation(async (path) => {
      if (path === API_PATHS.auth.redeemHandoff) return session;
      if (path === API_PATHS.me) {
        if (me instanceof Error) throw me;
        return me;
      }
      return undefined;
    });
  }
  /** Starts signing in and returns the question put to the visitor. */
  async function begin() {
    const signedIn = signInFromApp(code);
    await settle();
    const dialog = byRole(document.body, 'dialog');
    return {
      signedIn,
      dialog,
      question: byRole(dialog, 'heading').textContent,
      choose: async (answer: 'Continue' | 'Cancel') => {
        byRole(dialog, 'button', answer).click();
        await signedIn;
      },
    };
  }
  const logoutRequest = [API_PATHS.auth.logout, { method: 'POST', token: session.token }];

  beforeEach(() => {
    installDom();
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks first, stores nothing until the visitor continues, then signs in', async () => {
    server();

    const { dialog, question, choose } = await begin();

    expect(question).toBe('Continue as @maya?');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(byRole(dialog, 'button', 'Continue'));
    expect(request).toHaveBeenCalledWith(API_PATHS.auth.redeemHandoff, {
      method: 'POST',
      json: { code },
    });
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();

    await choose('Continue');

    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('session-token');
    expect(document.body.contains(dialog)).toBe(false);
  });

  it('on Cancel revokes the session it was handed and stays signed out', async () => {
    server();

    const { dialog, choose } = await begin();
    await choose('Cancel');

    expect(request).toHaveBeenCalledWith(...logoutRequest);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(document.body.contains(dialog)).toBe(false);
  });

  it('treats Escape as Cancel', async () => {
    server();

    const { dialog, signedIn } = await begin();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await signedIn;

    expect(request).toHaveBeenCalledWith(...logoutRequest);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('cancels even when the server cannot be reached to revoke the session', async () => {
    server();
    const { choose } = await begin();
    request.mockRejectedValue(new Error('offline'));

    await expect(choose('Cancel')).resolves.toBeUndefined();
  });

  describe('when this browser is already signed in', () => {
    beforeEach(() => localStorage.setItem(STORAGE_KEYS.session, 'old-token'));

    it('says who, and replaces that account only when the visitor continues', async () => {
      server();

      const { question, choose } = await begin();

      expect(question).toBe("You're signed in as @alex on this browser. Switch to @maya?");
      expect(request).toHaveBeenCalledWith(API_PATHS.me, { token: 'old-token' });
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('old-token');

      await choose('Continue');

      expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('session-token');
    });

    it('keeps that account when the visitor cancels', async () => {
      server();

      const { choose } = await begin();
      await choose('Cancel');

      expect(request).toHaveBeenCalledWith(...logoutRequest);
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('old-token');
    });

    it('does not mention an account whose session has expired', async () => {
      server(new Error('Session expired.'));

      const { question } = await begin();

      expect(question).toBe('Continue as @maya?');
    });
  });

  it('carries on signed out, without asking, when the code is expired or used', async () => {
    request.mockRejectedValue(new Error('Hand-off code is invalid or expired'));

    await signInFromApp(code);

    expect(queryByRole(document.body, 'dialog')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });
});
