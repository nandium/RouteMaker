import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS } from '../src/client-contract.js';
import { STORAGE_KEYS } from './storage.js';
import { browserRequest } from './http.js';
import {
  byRole,
  installDom,
  queryByRole,
  settle,
  stubMatchMedia,
  stubNavigation,
} from './test-dom.js';

const loaded = vi.hoisted(() => ({ lynxHost: 0 }));
const redeem = vi.hoisted(() => ({ hashAtRequest: null as string | null }));

vi.mock('./web.css', () => ({}));
vi.mock('./http.js', () => ({ browserRequest: vi.fn() }));

async function boot(url: string, session?: string, failing?: 'lynxHost' | 'tools') {
  vi.resetModules();
  installDom(url);
  const navigation = stubNavigation();
  stubMatchMedia({ dark: false });
  document.body.innerHTML = '<div id="app"></div>';
  if (session) localStorage.setItem(STORAGE_KEYS.session, session);
  loaded.lynxHost = 0;
  redeem.hashAtRequest = null;
  // Registered per boot so a test can make either chunk fail to load.
  const mountLynxHost = vi.fn();
  const mountToolPage = vi.fn();
  vi.doMock('./lynx-host.js', () => {
    loaded.lynxHost += 1;
    if (failing === 'lynxHost') throw new Error('chunk failed');
    return { mountLynxHost };
  });
  vi.doMock('./tools.js', () => {
    if (failing === 'tools') throw new Error('chunk failed');
    return { mountToolPage };
  });
  await import('./main.js');
  await settle();
  return { lynxHostLoads: loaded.lynxHost, mountLynxHost, mountToolPage, navigation };
}

describe('page boot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(browserRequest).mockImplementation(async () => {
      redeem.hashAtRequest = location.hash;
      throw new Error('unexpected request');
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['/', '/?ref=share'])('rewrites %s to the gym list in place', async (url) => {
    const { mountLynxHost, navigation } = await boot(`http://localhost${url}`);

    expect(location.pathname).toBe('/gyms');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(mountLynxHost).toHaveBeenCalledWith(expect.any(HTMLElement), { name: 'gyms' });
  });

  // A page that is not one of ours must not boot Lynx in place: the document may have been
  // served with a tool page's strict policy (e.g. /gyms/map/extra matches no tool page).
  it.each(['/not-a-page', '/gyms/map/extra', '/routes/new/extra'])(
    'sends %s to the gym list with a real navigation',
    async (path) => {
      const { mountLynxHost, mountToolPage, navigation } = await boot(`http://localhost${path}`);

      expect(navigation.replace).toHaveBeenCalledWith('/gyms');
      expect(mountLynxHost).not.toHaveBeenCalled();
      expect(mountToolPage).not.toHaveBeenCalled();
    }
  );

  it('opens app pages in the Lynx host at their own URL', async () => {
    const { mountLynxHost, mountToolPage } = await boot('http://localhost/routes/blue?x=1');

    expect(location.pathname + location.search).toBe('/routes/blue?x=1');
    expect(mountLynxHost).toHaveBeenCalledWith(expect.any(HTMLElement), {
      name: 'route',
      routeId: 'blue',
    });
    expect(mountToolPage).not.toHaveBeenCalled();
  });

  it('navigates a signed-out visitor from the editor to sign-in, keeping the chosen gym', async () => {
    const { mountLynxHost, mountToolPage, navigation } = await boot(
      'http://localhost/routes/new?gym=g1'
    );

    // A real navigation, because the sign-in page is served with different security headers.
    expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Froutes%2Fnew%3Fgym%3Dg1');
    expect(location.pathname).toBe('/routes/new');
    expect(mountLynxHost).not.toHaveBeenCalled();
    expect(mountToolPage).not.toHaveBeenCalled();
  });

  it('keeps a tool page at its own path, where its headers apply', async () => {
    const { mountToolPage, navigation } = await boot('http://localhost/gyms/map/?x=1');

    expect(navigation.replace).toHaveBeenCalledWith('/gyms/map?x=1');
    expect(mountToolPage).not.toHaveBeenCalled();
  });

  it('opens the editor for a signed-in visitor', async () => {
    const { mountToolPage } = await boot('http://localhost/routes/new', 'token');

    expect(mountToolPage).toHaveBeenCalledWith(expect.any(HTMLElement), { name: 'new-route' });
  });

  it('keeps the Lynx runtime off tool pages', async () => {
    const { lynxHostLoads } = await boot('http://localhost/gyms/map');

    expect(lynxHostLoads).toBe(0);
  });

  describe('email links', () => {
    it('keeps the code out of the address bar', async () => {
      const { mountToolPage } = await boot(
        'http://localhost/auth/action?mode=resetPassword&oobCode=secret'
      );

      expect(location.href).toBe('http://localhost/auth/action');
      expect(mountToolPage).toHaveBeenCalledWith(expect.any(HTMLElement), {
        name: 'auth-action',
        mode: 'resetPassword',
        oobCode: 'secret',
      });
    });

    it('explains a reload or Back after the code is gone, instead of booting Lynx there', async () => {
      const { mountToolPage, mountLynxHost, navigation } = await boot(
        'http://localhost/auth/action'
      );

      expect(mountToolPage).toHaveBeenCalledWith(expect.any(HTMLElement), { name: 'used-link' });
      expect(mountLynxHost).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it('treats a trailing slash like the plain path', async () => {
      const { navigation } = await boot('http://localhost/auth/action/?mode=verifyEmail&oobCode=x');

      expect(navigation.replace).toHaveBeenCalledWith('/auth/action?mode=verifyEmail&oobCode=x');
    });
  });

  it.each([
    ['lynxHost', '/gyms'],
    ['tools', '/gyms/map'],
  ] as const)('offers a reload when the %s code fails to load', async (failing, path) => {
    await boot(`http://localhost${path}`, undefined, failing);

    const app = document.querySelector<HTMLElement>('#app')!;
    expect(app.textContent).toContain('could not load');
    expect(byRole(app, 'button', 'Reload')).not.toBeNull();
  });

  describe('hand-off from the native app', () => {
    const code = 'cd'.repeat(32);
    const session = {
      token: 'handed-off',
      user: { id: 'u1', username: 'maya', display_name: 'Maya' },
    };

    const redeemsAs = () =>
      vi.mocked(browserRequest).mockImplementation(async (path) => {
        redeem.hashAtRequest = location.hash;
        if (path === API_PATHS.auth.redeemHandoff) return session;
        return undefined;
      });

    it('holds the page until the visitor continues, then opens what the link was for', async () => {
      redeemsAs();

      const { mountToolPage } = await boot(`http://localhost/routes/new#handoff=${code}`);

      expect(redeem.hashAtRequest).toBe('');
      expect(location.hash).toBe('');
      expect(byRole(document.body, 'heading').textContent).toBe('Continue as @maya?');
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
      expect(mountToolPage).not.toHaveBeenCalled();

      byRole(document.body, 'button', 'Continue').click();
      await settle();

      expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('handed-off');
      expect(mountToolPage).toHaveBeenCalledWith(expect.any(HTMLElement), { name: 'new-route' });
      expect(queryByRole(document.body, 'dialog')).toBeNull();
    });

    it('carries on signed out when the visitor cancels', async () => {
      redeemsAs();

      const { mountToolPage, navigation } = await boot(
        `http://localhost/routes/new#handoff=${code}`
      );
      byRole(document.body, 'button', 'Cancel').click();
      await settle();

      expect(browserRequest).toHaveBeenCalledWith(API_PATHS.auth.logout, {
        method: 'POST',
        token: 'handed-off',
      });
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
      expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Froutes%2Fnew');
      expect(mountToolPage).not.toHaveBeenCalled();
    });

    it('carries on signed out when the code no longer works', async () => {
      const { mountLynxHost, mountToolPage, navigation } = await boot(
        `http://localhost/routes/new#handoff=${code}`
      );

      expect(redeem.hashAtRequest).toBe('');
      expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
      expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Froutes%2Fnew');
      expect(mountToolPage).not.toHaveBeenCalled();
      expect(mountLynxHost).not.toHaveBeenCalled();
      expect(queryByRole(document.body, 'dialog')).toBeNull();
    });

    it('does not redeem a malformed code, but still removes it', async () => {
      await boot('http://localhost/gyms#handoff=oops');

      expect(browserRequest).not.toHaveBeenCalled();
      expect(location.hash).toBe('');
    });
  });
});
