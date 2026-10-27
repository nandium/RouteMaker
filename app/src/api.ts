import { API_PATHS } from './client-contract.js';
import type {
  AscentInput,
  AscentNote,
  AuthMessage,
  AuthSession,
  FollowResponse,
  Gym,
  GymListing,
  HandoffCode,
  LikeResponse,
  MapLocation,
  PublicProfile,
  Report,
  ReportInput,
  Route,
  User,
} from './client-contract.js';
import { hostProps } from './host.js';
import { type FetchJsonInit, fetchJson } from './http.js';

type RouteFilters = { gymId?: string; authorId?: string; following?: boolean };

export const absoluteUrl = (path: string) =>
  `${(hostProps().apiBaseUrl ?? '').replace(/\/+$/, '')}${path}`;

// The web host runs the bundle where the browser's fetch is the one that works.
const fetcher = () =>
  hostProps().webHost && typeof globalThis.fetch === 'function' ? globalThis.fetch : lynx.fetch;

function request<T>(path: string, init?: FetchJsonInit) {
  'background only';
  return fetchJson<T>(fetcher(), absoluteUrl(`/api${path}`), init);
}

const send = (method: string, token: string, json?: unknown) => ({ method, token, json });

export const api = {
  gyms: () => request<GymListing[]>(API_PATHS.gyms),
  location: () => request<MapLocation | null>(API_PATHS.location),
  routes(token: string | null, { gymId, authorId, following }: RouteFilters = {}) {
    const query = Object.entries({
      gym_id: gymId,
      author_id: authorId,
      following: following && 'true',
    })
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
      .join('&');
    return request<Route[]>(`${API_PATHS.routes}${query && `?${query}`}`, { token });
  },
  route: (token: string | null, id: string) => request<Route>(API_PATHS.route(id), { token }),
  removeRoute: (token: string, id: string) =>
    request<void>(API_PATHS.route(id), send('DELETE', token)),
  notes: (id: string) => request<AscentNote[]>(API_PATHS.notes(id)),
  like: (token: string, id: string, liked: boolean) =>
    request<LikeResponse>(API_PATHS.like(id), send(liked ? 'PUT' : 'DELETE', token)),
  logAscent: (token: string, id: string, ascent: AscentInput) =>
    request<Route>(API_PATHS.ascent(id), send('PUT', token, ascent)),
  removeAscent: (token: string, id: string) =>
    request<Route>(API_PATHS.ascent(id), send('DELETE', token)),
  signup: (data: { email: string; username: string; display_name: string; password: string }) =>
    request<AuthMessage>(API_PATHS.auth.signup, { method: 'POST', json: data }),
  login: (email: string, password: string) =>
    request<AuthSession>(API_PATHS.auth.login, { method: 'POST', json: { email, password } }),
  logout: (token: string) => request<void>(API_PATHS.auth.logout, send('POST', token)),
  forgot: (email: string) =>
    request<AuthMessage>(API_PATHS.auth.forgot, { method: 'POST', json: { email } }),
  /** A one-time code that signs a browser in as this session's account. */
  handoff: (token: string) => request<HandoffCode>(API_PATHS.auth.handoff, send('POST', token)),
  me: (token: string) => request<User>(API_PATHS.me, { token }),
  updateProfile: (token: string, display_name: string) =>
    request<User>(API_PATHS.me, send('PATCH', token, { display_name })),
  deleteAccount: (token: string, password: string) =>
    request<void>(API_PATHS.deleteAccount, send('POST', token, { password })),
  profile: (token: string | null, username: string) =>
    request<PublicProfile>(API_PATHS.profile(username), { token }),
  follow: (token: string, userId: string, followed: boolean) =>
    request<FollowResponse>(API_PATHS.follow(userId), send(followed ? 'PUT' : 'DELETE', token)),
  report: (token: string, input: ReportInput) =>
    request<void>(API_PATHS.report, send('POST', token, input)),
  adminReports: (token: string) => request<Report[]>(API_PATHS.admin.reports, { token }),
  adminGyms: (token: string) => request<Gym[]>(API_PATHS.admin.gyms, { token }),
  adminUsers: (token: string) => request<User[]>(API_PATHS.admin.users, { token }),
  moderateReport: (token: string, id: string, decision: 'hide' | 'dismiss') =>
    request<void>(API_PATHS.admin.report(id), send('PUT', token, { decision })),
  moderateGym: (token: string, id: string, decision: 'approve' | 'reject') =>
    request<void>(API_PATHS.admin.gym(id), send('PUT', token, { decision })),
  setUserDisabled: (token: string, id: string, disabled: boolean) =>
    request<void>(API_PATHS.admin.user(id), send('PUT', token, { disabled })),
};
