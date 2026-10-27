const AUTH_PAGES = ['login', 'signup', 'forgot-password'] as const;
export type AuthPageName = (typeof AUTH_PAGES)[number];

/** A screen of the Lynx app. */
export type Page =
  | { name: 'gyms' }
  | { name: 'gym'; gymId: string }
  | { name: 'feed'; following: boolean }
  | { name: 'route'; routeId: string }
  | { name: 'profile'; username: string }
  | { name: AuthPageName; next?: string }
  | { name: 'account' }
  | { name: 'admin' };

type AuthPage = Extract<Page, { name: AuthPageName }>;

/** The sign-in, sign-up and password-reset pages, which share one form. */
export const isAuthPage = (page: Page): page is AuthPage =>
  (AUTH_PAGES as readonly string[]).includes(page.name);

type WebPage =
  | Page
  | { name: 'gym-map' }
  | { name: 'new-route' }
  | {
      name: 'auth-action';
      mode: 'verifyEmail' | 'resetPassword';
      oobCode: string;
    };

export const WEB_PATHS = {
  root: '/',
  gyms: '/gyms',
  gymMap: '/gyms/map',
  gym: (id: string) => `/gyms/${encodeURIComponent(id)}`,
  feed: (following = false) => `/feed${following ? '?view=following' : ''}`,
  newRoute: '/routes/new',
  newRouteAt: (gymId: string) => `/routes/new?gym=${encodeURIComponent(gymId)}`,
  route: (id: string) => `/routes/${encodeURIComponent(id)}`,
  profile: (username: string) => `/users/${encodeURIComponent(username)}`,
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  account: '/account',
  admin: '/admin',
  authAction: '/auth/action',
} as const;

/** The only destinations that may follow a sign-in, so `next` can never redirect elsewhere. */
function loginNext(next: string) {
  // `next` is a path with an optional query (/routes/new?gym=g1); the query is not part of the path.
  const queryStart = next.indexOf('?');
  const page =
    queryStart < 0
      ? parseWebPage(next)
      : parseWebPage(next.slice(0, queryStart), next.slice(queryStart));
  switch (page?.name) {
    case 'gym-map':
    case 'new-route':
    case 'admin':
    case 'route':
    case 'profile':
      return page;
    default:
      return null;
  }
}

export function loginPath(next?: string) {
  return next && loginNext(next)
    ? `${WEB_PATHS.login}?next=${encodeURIComponent(next)}`
    : WEB_PATHS.login;
}

/** Where to go after signing in: `next` when it is allowed, else the feed. */
export function loginDestination(next?: string) {
  return (next && loginNext(next)) || ({ name: 'feed', following: false } satisfies Page);
}

/** The URL for a page; the inverse of `parseWebPage`. */
export function pathOf(page: Page): string {
  switch (page.name) {
    case 'gyms':
      return WEB_PATHS.gyms;
    case 'gym':
      return WEB_PATHS.gym(page.gymId);
    case 'feed':
      return WEB_PATHS.feed(page.following);
    case 'route':
      return WEB_PATHS.route(page.routeId);
    case 'profile':
      return WEB_PATHS.profile(page.username);
    case 'login':
      return loginPath(page.next);
    case 'signup':
      return WEB_PATHS.signup;
    case 'forgot-password':
      return WEB_PATHS.forgotPassword;
    case 'account':
      return WEB_PATHS.account;
    case 'admin':
      return WEB_PATHS.admin;
  }
}

function segment(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return null;
  const value = pathname.slice(prefix.length);
  if (!value || value.includes('/')) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseWebPage(pathname: string, search = ''): WebPage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  // The Lynx runtime has no URLSearchParams; path-only callers must not need one.
  const query = () => new URLSearchParams(search);
  if (path === WEB_PATHS.root || path === WEB_PATHS.gyms) return { name: 'gyms' };
  if (path === WEB_PATHS.gymMap) return { name: 'gym-map' };
  if (path === WEB_PATHS.feed())
    return { name: 'feed', following: query().get('view') === 'following' };
  if (path === WEB_PATHS.newRoute) return { name: 'new-route' };
  if (path === WEB_PATHS.login) {
    const next = query().get('next') ?? undefined;
    return { name: 'login', next: next && loginNext(next) ? next : undefined };
  }
  if (path === WEB_PATHS.signup) return { name: 'signup' };
  if (path === WEB_PATHS.forgotPassword) return { name: 'forgot-password' };
  if (path === WEB_PATHS.account) return { name: 'account' };
  if (path === WEB_PATHS.admin) return { name: 'admin' };
  if (path === WEB_PATHS.authAction) {
    const params = query();
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    return oobCode && (mode === 'verifyEmail' || mode === 'resetPassword')
      ? { name: 'auth-action', mode, oobCode }
      : null;
  }
  const gymId = segment(path, `${WEB_PATHS.gyms}/`);
  if (gymId) return { name: 'gym', gymId };
  const routeId = segment(path, '/routes/');
  if (routeId) return { name: 'route', routeId };
  const username = segment(path, '/users/');
  if (username) return { name: 'profile', username };
  return null;
}
