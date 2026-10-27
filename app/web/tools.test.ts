import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS } from '../src/client-contract.js';
import type { GymListing } from '../src/client-contract.js';
import { mountAuthAction, mountUsedLink } from './auth-action.js';
import { mountEditor } from './editor/editor.js';
import { createHeader } from './header.js';
import { ApiError, browserRequest } from './http.js';
import { mountMap } from './map/map.js';
import { STORAGE_KEYS } from './storage.js';
import { byRole, installDom, queryByRole, settle, stubNavigation } from './test-dom.js';
import { mountToolPage } from './tools.js';

vi.mock('./tools.css', () => ({}));
vi.mock('./header.js', () => ({
  createHeader: vi.fn(() => {
    const header = document.createElement('header');
    header.textContent = 'header';
    return header;
  }),
}));
vi.mock('./auth-action.js', () => ({ mountAuthAction: vi.fn(), mountUsedLink: vi.fn() }));
vi.mock('./editor/editor.js', () => ({ mountEditor: vi.fn() }));
vi.mock('./map/map.js', () => ({ mountMap: vi.fn() }));
vi.mock('./http.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./http.js')>()),
  browserRequest: vi.fn(),
}));

const gyms = [{ id: 'gym-1', name: 'Test Gym', route_count: 3 }] as GymListing[];
const request = vi.mocked(browserRequest);

describe('tool pages', () => {
  let root: HTMLElement;

  beforeEach(() => {
    installDom();
    vi.clearAllMocks();
    root = document.createElement('main');
    document.body.append(root);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the map with the approved gyms under the page header', async () => {
    request.mockResolvedValue(gyms);

    await mountToolPage(root, { name: 'gym-map' });

    expect(createHeader).toHaveBeenCalledWith('gym-map');
    expect(document.body.firstElementChild!.textContent).toBe('header');
    expect(request).toHaveBeenCalledWith(API_PATHS.gyms);
    expect(mountMap).toHaveBeenCalledWith(root.querySelector('main.tool-main'), gyms);
    expect(byRole(root, 'heading').textContent).toBe('Gym map');
  });

  describe('the route editor', () => {
    const answers = (me: () => unknown) =>
      request.mockImplementation(async (path) => (path === API_PATHS.me ? me() : gyms));

    it('opens with the approved gyms, for the account that is signed in', async () => {
      localStorage.setItem(STORAGE_KEYS.session, 'token');
      answers(() => ({ id: 'u1' }));

      await mountToolPage(root, { name: 'new-route' });

      expect(request).toHaveBeenCalledWith(API_PATHS.me, { token: 'token' });
      expect(mountEditor).toHaveBeenCalledWith(root.querySelector('main.tool-main'), gyms, 'u1');
      expect(byRole(root, 'heading').textContent).toBe('Add a route');
    });

    it.each([
      ['has expired', 'token'],
      ['is missing', null],
    ])('sends the climber to sign in when the session %s', async (_case, token) => {
      if (token) localStorage.setItem(STORAGE_KEYS.session, token);
      history.replaceState(null, '', '/routes/new');
      const navigation = stubNavigation();
      answers(() => {
        throw new ApiError('Session expired.', 401);
      });

      await mountToolPage(root, { name: 'new-route' });

      expect(navigation.assign).toHaveBeenCalledWith('/login?next=%2Froutes%2Fnew');
      expect(mountEditor).not.toHaveBeenCalled();
    });

    it('offers a retry when the account cannot be checked', async () => {
      localStorage.setItem(STORAGE_KEYS.session, 'token');
      answers(() => {
        throw new Error('offline');
      });

      await mountToolPage(root, { name: 'new-route' });

      expect(byRole(root, 'alert').textContent).toBe('offline');
      expect(mountEditor).not.toHaveBeenCalled();
    });
  });

  it('finishes email links without loading gyms', async () => {
    await mountToolPage(root, { name: 'auth-action', mode: 'verifyEmail', oobCode: 'abc' });

    expect(mountAuthAction).toHaveBeenCalledWith(root, 'verifyEmail', 'abc');
    expect(request).not.toHaveBeenCalled();
  });

  it('explains an email link whose code is gone, without loading gyms', async () => {
    await mountToolPage(root, { name: 'used-link' });

    expect(createHeader).toHaveBeenCalledWith('used-link');
    expect(mountUsedLink).toHaveBeenCalledWith(root);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: 'gym-map' }, 'Gym map · RouteMaker'],
    [{ name: 'new-route' }, 'Add a route · RouteMaker'],
    [{ name: 'auth-action', mode: 'verifyEmail', oobCode: 'x' }, 'Verify your email · RouteMaker'],
    [
      { name: 'auth-action', mode: 'resetPassword', oobCode: 'x' },
      'Choose a new password · RouteMaker',
    ],
    [{ name: 'used-link' }, 'Link already used · RouteMaker'],
  ] as const)('titles the tab for %j', async (page, title) => {
    request.mockResolvedValue(gyms);

    await mountToolPage(root, page);

    expect(document.title).toBe(title);
  });

  it('offers a retry when the gyms cannot be loaded', async () => {
    request.mockRejectedValueOnce(new Error('API unavailable'));
    await mountToolPage(root, { name: 'gym-map' });
    expect(byRole(root, 'alert').textContent).toBe('API unavailable');
    expect(mountMap).not.toHaveBeenCalled();

    request.mockResolvedValueOnce(gyms);
    byRole(root, 'button', 'Try again').click();
    await settle();

    expect(mountMap).toHaveBeenCalledWith(root.querySelector('main.tool-main'), gyms);
    expect(queryByRole(root, 'alert')).toBeNull();
  });
});
