import '@testing-library/jest-dom';
import { fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library';
import { beforeEach, expect, test, vi } from 'vitest';

const gym = {
  id: 'central',
  name: 'Central Bloc',
  address: '1 Test Street',
  country_code: 'SG',
  latitude: 1.3,
  longitude: 103.8,
  status: 'approved',
};
const route = {
  id: 'blue',
  name: 'Blue Moon',
  public_grade: 'V4',
  votes: 18,
  voted: false,
  comment_count: 1,
  image_url: '/media/blue.jpg',
  author: { username: 'maya', display_name: 'Maya Tan' },
  gym: { name: gym.name },
};
const account = {
  id: 'maya',
  email: 'maya@example.com',
  username: 'maya',
  display_name: 'Maya Tan',
  role: 'user' as const,
  disabled: false,
};

vi.mock('../../../api.js', () => ({
  apiBaseUrl: 'http://localhost:8788',
  ApiError: class extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  },
  api: {
    gyms: vi.fn(async () => [gym]),
    location: vi.fn(async () => null),
    routes: vi.fn(async () => [route]),
    route: vi.fn(async () => route),
    comments: vi.fn(async () => [
      {
        id: 'comment',
        body: 'Friendly finish',
        author: { username: 'leon', display_name: 'Leon' },
      },
    ]),
    imageUrl: vi.fn((path: string) => path),
    login: vi.fn(async () => ({
      token: 'test-token',
      user: account,
    })),
    logout: vi.fn(async () => undefined),
    me: vi.fn(async () => account),
    signup: vi.fn(async () => ({ message: 'Verification email sent.' })),
    forgot: vi.fn(async () => ({ message: 'Password reset email sent.' })),
    updateProfile: vi.fn(async () => undefined),
    profile: vi.fn(async () => ({
      id: 'maya',
      username: 'maya',
      display_name: 'Maya Tan',
      followers: 2,
      following: 3,
      followed: false,
    })),
    vote: vi.fn(async () => ({ voted: true, votes: 19 })),
    grade: vi.fn(async () => ({ public_grade: 'V5' })),
    comment: vi.fn(async () => undefined),
    follow: vi.fn(async () => ({ followed: true })),
    report: vi.fn(async () => undefined),
    adminReports: vi.fn(async () => []),
    adminGyms: vi.fn(async () => []),
    adminUsers: vi.fn(async () => []),
    moderateReport: vi.fn(async () => undefined),
    moderateGym: vi.fn(async () => undefined),
    setUserDisabled: vi.fn(async () => undefined),
  },
}));

import { App } from '../App.js';
import { ApiError, api } from '../../../api.js';
import { BRAND_PALETTE } from '../../../brand.js';
import { ICON_PALETTE } from '../../../icons.js';
import { MAP_STYLES } from '../../../map-config.js';

const baselineNativeModules = globalThis.NativeModules;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.NativeModules = baselineNativeModules;
  route.public_grade = 'V4';
});

async function tapText(queries: ReturnType<typeof getQueriesForElement>, text: string, index = 0) {
  const matches = await queries.findAllByText(text);
  let target = matches[index];
  while (target && !target.hasAttribute('accessibility-label')) target = target.parentElement!;
  expect(target).toBeTruthy();
  fireEvent.tap(target);
}

async function enterField(
  queries: ReturnType<typeof getQueriesForElement>,
  label: string,
  value: string
) {
  await queries.findByPlaceholderText(label);
  const event = new window.Event('bindEvent:input', { bubbles: true });
  Object.assign(event, {
    detail: { value },
    eventName: 'input',
    eventType: 'bindEvent',
  });
  fireEvent(
    lynx.createSelectorQuery().select(`[placeholder="${label}"]`) as unknown as Element,
    event
  );
}

async function enterLogin(queries: ReturnType<typeof getQueriesForElement>) {
  await enterField(queries, 'Email', account.email);
  await enterField(queries, 'Password', 'valid-password');
}

async function confirmField(queries: ReturnType<typeof getQueriesForElement>, label: string) {
  await queries.findByPlaceholderText(label);
  const event = new window.Event('bindEvent:confirm', { bubbles: true });
  Object.assign(event, {
    detail: {},
    eventName: 'confirm',
    eventType: 'bindEvent',
  });
  fireEvent(
    lynx.createSelectorQuery().select(`[placeholder="${label}"]`) as unknown as Element,
    event
  );
}

test('loads gyms and follows the route-detail journey', async () => {
  const push = vi.fn();
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerNavigation: { push, replace: vi.fn(), back: vi.fn() },
  };
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');

  expect(push).toHaveBeenCalledWith('/gyms/central');
  expect(push).toHaveBeenCalledWith('/routes/blue');
  expect(await queries.findByText('Maya Tan')).toBeTruthy();
  expect(await queries.findByText('Friendly finish')).toBeTruthy();
  expect(elementTree.root!.querySelector('image')?.getAttribute('src')).toBe('/media/blue.jpg');
});

test('keeps mobile navigation outside the screen scroller', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  const scroller = () => elementTree.root!.querySelector('.page');

  expect(elementTree.root!.querySelector('.app-frame .nav')).toBeInTheDocument();
  expect(scroller()!.querySelector('.nav')).not.toBeInTheDocument();

  await tapText(queries, 'Central Bloc');
  expect(scroller()!.querySelector('.nav')).not.toBeInTheDocument();

  await tapText(queries, 'Blue Moon');
  expect(await queries.findByText('Friendly finish')).toBeTruthy();
  expect(scroller()!.querySelector('.nav')).not.toBeInTheDocument();
});

test('keeps ungraded routes visible in lists and details', async () => {
  route.public_grade = '';
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Central Bloc');
  expect(await queries.findByText('Unrated')).toBeTruthy();

  await tapText(queries, 'Blue Moon');
  expect(await queries.findByText('Unrated')).toBeTruthy();
});

test('invites guests to sign in before contributing to a route', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');

  expect(await queries.findByText('Sign in to suggest a grade or add a note.')).toBeInTheDocument();
  expect(await queries.findByText('Sign in to contribute')).toBeInTheDocument();

  await tapText(queries, 'Sign in to contribute');
  await enterLogin(queries);
  await tapText(queries, 'Sign in');

  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(api.route).toHaveBeenCalledWith(route.id, 'test-token');
});

test('uses browser history for route-detail back navigation when available', async () => {
  const back = vi.fn();
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerNavigation: { push: vi.fn(), replace: vi.fn(), back },
  };
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');
  await tapText(queries, 'Back');

  expect(back).toHaveBeenCalledOnce();
});

test('still renders route details when comments fail to load', async () => {
  vi.mocked(api.comments).mockRejectedValueOnce(new Error('offline'));
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');

  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(await queries.findByText('Could not load comments. Try again.')).toBeInTheDocument();
});

test('keeps account actions behind a clear sign-in screen', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Guest');
  expect(await queries.findByText('Welcome back.')).toBeInTheDocument();
  expect(await queries.findByText('Create an account')).toBeInTheDocument();
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
});

test('validates authentication before calling the API', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Guest');
  await tapText(queries, 'Sign in');

  expect(await queries.findByText('Enter your email.')).toBeInTheDocument();
  expect(api.login).not.toHaveBeenCalled();
});

test('validates forgot-password email when the field is confirmed', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Guest');
  await tapText(queries, 'Forgot password?');
  await confirmField(queries, 'Email');

  expect(await queries.findByText('Enter your email.')).toBeInTheDocument();
  expect(api.forgot).not.toHaveBeenCalled();
});

test('reports tool navigation failures without asking users to open a raw URL', async () => {
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerNavigation: {
      openExternal: (_url: string, _replace: boolean, callback: (success: boolean) => void) =>
        callback(false),
    },
  };
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Gym map');

  expect(await queries.findByText('Could not open the gym map. Try again.')).toBeInTheDocument();
  expect(queries.queryByText(/Open http/)).not.toBeInTheDocument();
});

test('offers the native map only after gyms finish loading', async () => {
  let resolveGyms: ((gyms: [typeof gym]) => void) | undefined;
  vi.mocked(api.gyms).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveGyms = resolve;
      })
  );
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  expect(queries.queryByText('Gym map')).not.toBeInTheDocument();
  resolveGyms?.([gym]);

  expect(await queries.findByText('Gym map')).toBeInTheDocument();
});

test('opens the native map and follows a selected gym', async () => {
  let resolveLocation: ((location: { latitude: number; longitude: number }) => void) | undefined;
  vi.mocked(api.location).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveLocation = resolve;
      })
  );
  const push = vi.fn();
  const openExternal = vi.fn(() => true);
  let mapScene: unknown;
  let mapOpenCount = 0;
  let selectGym: ((gymId: string) => void) | undefined;
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerNavigation: { push, replace: vi.fn(), back: vi.fn(), openExternal },
    RouteMakerMap: {
      open: (scene: string, callback: (gymId: string) => void) => {
        mapOpenCount += 1;
        mapScene = JSON.parse(scene);
        selectGym = callback;
      },
    },
  };
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await queries.findByText('Gym map');
  expect(api.location).not.toHaveBeenCalled();
  await tapText(queries, 'Gym map');
  await tapText(queries, 'Gym map');
  resolveLocation?.({
    latitude: 51.5072,
    longitude: -0.1276,
  });
  await vi.waitFor(() =>
    expect(mapScene).toMatchObject({
      gyms: [{ id: 'central', latitude: 1.3, longitude: 103.8 }],
      style: MAP_STYLES.light,
      theme: 'light',
      centerLatitude: 51.5072,
      centerLongitude: -0.1276,
    })
  );
  expect(api.location).toHaveBeenCalledOnce();
  expect(mapOpenCount).toBe(1);
  selectGym?.('central');

  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(push).toHaveBeenCalledWith('/gyms/central');
});

test.each(['Add a route', 'Feed', 'Central Bloc'])(
  'does not present a pending native map after navigating to %s',
  async (destination) => {
    let resolveLocation: ((location: null) => void) | undefined;
    vi.mocked(api.location).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocation = resolve;
        })
    );
    const open = vi.fn();
    globalThis.NativeModules = {
      ...baselineNativeModules,
      RouteMakerMap: { open },
    };
    render(<App />);
    const queries = getQueriesForElement(elementTree.root!);

    await tapText(queries, 'Gym map');
    await tapText(queries, destination);
    resolveLocation?.(null);

    await vi.waitFor(() => expect(api.location).toHaveBeenCalledOnce());
    expect(open).not.toHaveBeenCalled();
  }
);

test('applies and persists an explicit color theme', async () => {
  const setPreference = vi.fn();
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerAppearance: { setPreference },
  };
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  expect(elementTree.root!.querySelector('.nav__icon')?.getAttribute('content')).toContain(
    `stroke="${ICON_PALETTE.light.active}"`
  );
  expect(elementTree.root!.querySelector('.brand__mark')?.getAttribute('content')).toContain(
    `fill="${BRAND_PALETTE.light.primary}"`
  );

  fireEvent.tap(await queries.findByLabelText('Switch to dark theme'));
  expect(elementTree.root!.querySelector('.app-frame')).toHaveClass('theme-dark');
  expect(elementTree.root!.querySelector('.nav__icon')?.getAttribute('content')).toContain(
    `stroke="${ICON_PALETTE.dark.active}"`
  );
  expect(elementTree.root!.querySelector('.brand__mark')?.getAttribute('content')).toContain(
    `fill="${BRAND_PALETTE.dark.primary}"`
  );
  expect(setPreference).toHaveBeenCalledWith('dark');
});

test('supports the login and logout state transition', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  await tapText(queries, 'Guest');
  await enterLogin(queries);
  await tapText(queries, 'Sign in');
  expect(await queries.findByText('Fresh routes.')).toBeInTheDocument();
  const everyone = (await queries.findByText('Everyone')).parentElement!;
  const following = (await queries.findByText('Following')).parentElement!;
  expect(everyone).not.toHaveClass('action--quiet');
  expect(everyone).toHaveAttribute('aria-pressed', 'true');
  expect(following).toHaveClass('action--quiet');
  expect(following).toHaveAttribute('aria-pressed', 'false');
  await tapText(queries, 'maya');
  await tapText(queries, 'Sign out');
  expect(await queries.findByText('Welcome back.')).toBeInTheDocument();
});

test('does not commit a login when the initial authenticated feed is rejected', async () => {
  const setToken = vi.fn();
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerSession: {
      getToken: (callback: (token: string) => void) => callback(''),
      setToken,
      clearToken: vi.fn(),
    },
  };
  vi.mocked(api.routes).mockRejectedValueOnce(new ApiError('Unauthorized', 401));

  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  await tapText(queries, 'Guest');
  await enterLogin(queries);
  await tapText(queries, 'Sign in');

  expect(await queries.findByText('Unauthorized')).toBeInTheDocument();
  expect(await queries.findByText('Welcome back.')).toBeInTheDocument();
  expect(setToken).not.toHaveBeenCalled();
  expect(queries.queryByText('Fresh routes.')).not.toBeInTheDocument();
});

test('restores and clears a saved session', async () => {
  let cleared = false;
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerSession: {
      getToken: (callback: (token: string) => void) => callback('saved-token'),
      setToken: vi.fn(),
      clearToken: () => {
        cleared = true;
      },
    },
  };
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  expect(await queries.findByText('maya')).toBeInTheDocument();
  expect(api.me).toHaveBeenCalledWith('saved-token');
  await tapText(queries, 'maya');
  await tapText(queries, 'Sign out');
  expect(cleared).toBe(true);
});

test('keeps a saved session through a transient restore failure', async () => {
  let cleared = false;
  globalThis.NativeModules = {
    ...baselineNativeModules,
    RouteMakerSession: {
      getToken: (callback: (token: string) => void) => callback('saved-token'),
      setToken: vi.fn(),
      clearToken: () => {
        cleared = true;
      },
    },
  };
  vi.mocked(api.me).mockRejectedValueOnce(new Error('offline'));

  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  expect(
    await queries.findByText('Could not restore your session. Check your connection and try again.')
  ).toBeInTheDocument();
  expect(cleared).toBe(false);
});

test('keeps verification and password reset in the browser', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  await tapText(queries, 'Guest');
  await tapText(queries, 'Create an account');
  await enterField(queries, 'Username', account.username);
  await enterLogin(queries);
  await tapText(queries, 'Create account');
  expect(
    await queries.findByText(
      'Check your email for a verification link. Open it in your browser, then return here and sign in.'
    )
  ).toBeInTheDocument();
  await tapText(queries, 'Forgot password?');
  expect(
    queries.queryByText(
      'Check your email for a verification link. Open it in your browser, then return here and sign in.'
    )
  ).not.toBeInTheDocument();
  expect(await queries.findByText('Back to sign in')).toBeInTheDocument();
  expect(queries.queryByText('Forgot password?')).not.toBeInTheDocument();
  await tapText(queries, 'Send reset link');
  expect(
    await queries.findByText(
      'Check your email for a password-reset link. Complete it in your browser, then return here and sign in.'
    )
  ).toBeInTheDocument();
  expect(await queries.findByText('Welcome back.')).toBeInTheDocument();
});

test('covers voting, commenting and reporting from route detail', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  await tapText(queries, 'Guest');
  await enterLogin(queries);
  await tapText(queries, 'Sign in');
  await tapText(queries, 'Blue Moon');
  await tapText(queries, 'Vote · 18');
  expect(await queries.findByText('Voted · 19')).toBeInTheDocument();
  await enterField(queries, 'Note', 'Useful beta');
  await tapText(queries, 'Post comment');
  expect(api.comment).toHaveBeenCalledWith('test-token', route.id, 'Useful beta');
  await tapText(queries, 'Report this route');
  expect(await queries.findByText('Report sent to the moderators.')).toBeInTheDocument();
});

test('validates community contributions before calling the API', async () => {
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);
  await tapText(queries, 'Guest');
  await enterLogin(queries);
  await tapText(queries, 'Sign in');
  await tapText(queries, 'Blue Moon');

  await enterField(queries, 'V0–V17', 'V99');
  await tapText(queries, 'Submit');
  expect(await queries.findByText('Use a grade from V0 to V17.')).toBeInTheDocument();
  expect(api.grade).not.toHaveBeenCalled();

  await tapText(queries, 'Post comment');
  expect(await queries.findByText('Write a note before posting.')).toBeInTheDocument();
  expect(api.comment).not.toHaveBeenCalled();
});

test('lets administrators inspect a report before moderating it', async () => {
  vi.mocked(api.login).mockResolvedValueOnce({
    token: 'admin-token',
    user: { ...account, role: 'admin' },
  });
  vi.mocked(api.adminReports).mockResolvedValueOnce([
    {
      id: 'report',
      target_type: 'route',
      target_id: route.id,
      target_label: route.name,
      route_id: route.id,
      reason: 'Unsafe landing',
    },
  ]);
  render(<App />);
  const queries = getQueriesForElement(elementTree.root!);

  await tapText(queries, 'Guest');
  await enterLogin(queries);
  await tapText(queries, 'Sign in');
  await tapText(queries, 'Admin');
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(await queries.findByText('Unsafe landing')).toBeInTheDocument();
  await tapText(queries, 'Inspect');
  expect(api.route).toHaveBeenCalledWith(route.id, 'admin-token');
});
