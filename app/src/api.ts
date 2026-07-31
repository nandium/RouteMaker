export type { Comment, Gym, PublicProfile, Report, Route, User } from './client-contract.js';
import { API_PATHS } from './client-contract.js';
import type {
  AuthSession,
  AuthMessage,
  Comment,
  FollowResponse,
  GradeResponse,
  Gym,
  PublicProfile,
  Report,
  Route,
  User,
  VoteResponse,
} from './client-contract.js';

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

type RouteFilters = {
  gymId?: string;
  authorId?: string;
  following?: boolean;
};

const configuredApiBaseUrl = lynx.__globalProps?.apiBaseUrl ?? '';
export const apiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const fetcher =
    lynx.__globalProps?.webHost && typeof globalThis.fetch === 'function'
      ? globalThis.fetch
      : lynx.fetch;
  const response = await fetcher(`${apiBaseUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    let failure: { detail?: string } = {};
    try {
      failure = (await response.json()) as { detail?: string };
    } catch {
      // Edge proxies may return HTML; retain the useful HTTP status below.
    }
    throw new ApiError(failure.detail ?? `Request failed (${response.status})`, response.status);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  imageUrl(path: string) {
    return `${apiBaseUrl}${path}`;
  },
  gyms() {
    return request<Gym[]>(API_PATHS.gyms);
  },
  routes(token: string | null, filters: RouteFilters = {}) {
    const values: string[] = [];
    if (filters.gymId) values.push(`gym_id=${encodeURIComponent(filters.gymId)}`);
    if (filters.authorId) values.push(`author_id=${encodeURIComponent(filters.authorId)}`);
    if (filters.following) values.push('following=true');
    return request<Route[]>(`${API_PATHS.routes}${values.length ? `?${values.join('&')}` : ''}`, {
      token,
    });
  },
  route(id: string, token: string | null) {
    return request<Route>(API_PATHS.route(id), { token });
  },
  comments(routeId: string) {
    return request<Comment[]>(API_PATHS.comments(routeId));
  },
  signup(data: { email: string; username: string; display_name: string; password: string }) {
    return request<AuthMessage>(API_PATHS.auth.signup, {
      method: 'POST',
      body: data,
    });
  },
  login(email: string, password: string) {
    return request<AuthSession>(API_PATHS.auth.login, {
      method: 'POST',
      body: { email, password },
    });
  },
  logout(token: string) {
    return request(API_PATHS.auth.logout, { method: 'POST', token });
  },
  me(token: string) {
    return request<User>(API_PATHS.me, { token });
  },
  forgot(email: string) {
    return request<AuthMessage>(API_PATHS.auth.forgot, {
      method: 'POST',
      body: { email },
    });
  },
  updateProfile(token: string, display_name: string) {
    return request<User>(API_PATHS.me, { method: 'PATCH', token, body: { display_name } });
  },
  profile(username: string, token: string | null) {
    return request<PublicProfile>(API_PATHS.profile(username), { token });
  },
  vote(token: string, routeId: string, active: boolean) {
    return request<VoteResponse>(API_PATHS.vote(routeId), {
      method: 'POST',
      token,
      body: { active },
    });
  },
  grade(token: string, routeId: string, grade: string) {
    return request<GradeResponse>(API_PATHS.grade(routeId), {
      method: 'PUT',
      token,
      body: { grade },
    });
  },
  comment(token: string, routeId: string, body: string) {
    return request<Comment>(API_PATHS.comments(routeId), {
      method: 'POST',
      token,
      body: { body },
    });
  },
  follow(token: string, userId: string, active: boolean) {
    return request<FollowResponse>(API_PATHS.follow(userId), {
      method: 'POST',
      token,
      body: { active },
    });
  },
  report(token: string, routeId: string, reason: string) {
    return request(API_PATHS.report, {
      method: 'POST',
      token,
      body: { target_type: 'route', target_id: routeId, reason },
    });
  },
  adminReports(token: string) {
    return request<Report[]>(API_PATHS.admin.reports, {
      token,
    });
  },
  adminGyms(token: string) {
    return request<Gym[]>(API_PATHS.admin.gyms, { token });
  },
  moderateReport(token: string, id: string, decision: 'hide' | 'dismiss') {
    return request(API_PATHS.admin.report(id), { method: 'PUT', token, body: { decision } });
  },
  moderateGym(token: string, id: string, decision: 'approve' | 'reject') {
    return request(API_PATHS.admin.gym(id), { method: 'PUT', token, body: { decision } });
  },
  adminUsers(token: string) {
    return request<User[]>(API_PATHS.admin.users, { token });
  },
  setUserDisabled(token: string, id: string, disabled: boolean) {
    return request(API_PATHS.admin.userDisabled(id, disabled), {
      method: 'PUT',
      token,
    });
  },
};
