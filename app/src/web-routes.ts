type AuthRouteName = 'login' | 'signup' | 'forgot-password';

export type AppRoute =
  | { name: 'gyms' }
  | { name: 'gym'; gymId: string }
  | { name: 'feed'; following: boolean }
  | { name: 'route'; routeId: string }
  | { name: 'profile'; username: string }
  | { name: AuthRouteName; next?: string }
  | { name: 'account' }
  | { name: 'admin' };

type WebRoute =
  | AppRoute
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
  route: (id: string) => `/routes/${encodeURIComponent(id)}`,
  profile: (username: string) => `/users/${encodeURIComponent(username)}`,
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  account: '/account',
  admin: '/admin',
  authAction: '/auth/action',
} as const;

const AUTH_NEXT_PATHS = new Set<string>([WEB_PATHS.gymMap, WEB_PATHS.newRoute, WEB_PATHS.admin]);

function isAuthNextPath(path: string) {
  return AUTH_NEXT_PATHS.has(path) || parseWebRoute(path)?.name === 'route';
}

export function loginPath(next?: string) {
  return next && isAuthNextPath(next)
    ? `${WEB_PATHS.login}?next=${encodeURIComponent(next)}`
    : WEB_PATHS.login;
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

/** Match the small public route set without coupling it to a UI renderer. */
export function parseWebRoute(pathname: string, search = ''): WebRoute | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const params = new URLSearchParams(search);
  if (path === WEB_PATHS.root || path === WEB_PATHS.gyms) return { name: 'gyms' };
  if (path === WEB_PATHS.gymMap) return { name: 'gym-map' };
  if (path === WEB_PATHS.feed())
    return { name: 'feed', following: params.get('view') === 'following' };
  if (path === WEB_PATHS.newRoute) return { name: 'new-route' };
  if (path === WEB_PATHS.login) {
    const next = params.get('next') ?? undefined;
    return {
      name: 'login',
      next: next && isAuthNextPath(next) ? next : undefined,
    };
  }
  if (path === WEB_PATHS.signup) return { name: 'signup' };
  if (path === WEB_PATHS.forgotPassword) return { name: 'forgot-password' };
  if (path === WEB_PATHS.account) return { name: 'account' };
  if (path === WEB_PATHS.admin) return { name: 'admin' };
  if (path === WEB_PATHS.authAction) {
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
