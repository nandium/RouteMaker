import { vi } from 'vitest';

import {
  API_PATHS,
  type AscentInput,
  type AscentNote,
  type AuthMessage,
  type AuthSession,
  type CreatedResponse,
  type FollowResponse,
  type Gym,
  type GymListing,
  type HandoffCode,
  type LikeResponse,
  type MapLocation,
  type PublicProfile,
  type Report,
  type ReportInput,
  type Route,
  type User,
} from '../../../client-contract.js';
import { ApiError } from '../../../http.js';

export const NOW = 1_700_000_000;

export const gym: GymListing = {
  id: 'central',
  name: 'Central Bloc',
  address: '1 Test Street',
  country_code: 'SG',
  latitude: 1.3,
  longitude: 103.8,
  status: 'approved',
  route_count: 2,
};
export const account: User = {
  id: 'maya',
  email: 'maya@example.com',
  username: 'maya',
  display_name: 'Maya Tan',
  role: 'user',
  disabled: false,
};
export const route: Route = {
  id: 'blue',
  name: 'Blue Moon',
  public_grade: 'V4',
  likes: 18,
  liked: false,
  sends: 3,
  my_ascent: null,
  image_url: '/media/blue',
  thumb_url: '/media/blue/thumb',
  created_at: NOW - 3600,
  author: { username: account.username, display_name: account.display_name },
  gym: { id: gym.id, name: gym.name },
};
export const profile: PublicProfile = {
  id: account.id,
  username: account.username,
  display_name: account.display_name,
  followers: 2,
  following: 3,
  followed: false,
};
export const note: AscentNote = {
  id: 'note',
  author: { username: 'leon', display_name: 'Leon' },
  sent: true,
  grade: 'V5',
  note: 'Friendly finish',
  updated_at: NOW - 7200,
};

/** A request as the fake server received it. `param` is the id the path carried, if any. */
export type Received<Body> = {
  method: string;
  param: string;
  query: URLSearchParams;
  body: Body;
  token: string | null;
};

type Endpoint<Response, Body> = {
  /** Every method the app calls at this path; the handler is told which one it got. */
  methods: string[];
  /** The contract's path with a marker where its id goes. */
  template: string;
  readonly types?: [Response, Body];
};

const ID = 'ID';

/** Paths come from the contract, so renaming one there breaks this table, not just the app. */
function endpoint<Response, Body = undefined>(
  methods: string | string[],
  path: string | ((id: string) => string)
): Endpoint<Response, Body> {
  return { methods: [methods].flat(), template: typeof path === 'string' ? path : path(ID) };
}

type Credentials = { email: string; password: string };
type Decision<Value extends string> = { decision: Value };

/** Every endpoint the app may call, with the types it sends and receives. */
export const endpoints = {
  gyms: endpoint<GymListing[]>('GET', API_PATHS.gyms),
  location: endpoint<MapLocation | null>('GET', API_PATHS.location),
  routes: endpoint<Route[]>('GET', API_PATHS.routes),
  route: endpoint<Route>('GET', API_PATHS.route),
  removeRoute: endpoint<void>('DELETE', API_PATHS.route),
  notes: endpoint<AscentNote[]>('GET', API_PATHS.notes),
  like: endpoint<LikeResponse>(['PUT', 'DELETE'], API_PATHS.like),
  logAscent: endpoint<Route, AscentInput>('PUT', API_PATHS.ascent),
  removeAscent: endpoint<Route>('DELETE', API_PATHS.ascent),
  signup: endpoint<AuthMessage, Credentials & { username: string; display_name: string }>(
    'POST',
    API_PATHS.auth.signup
  ),
  login: endpoint<AuthSession, Credentials>('POST', API_PATHS.auth.login),
  logout: endpoint<void>('POST', API_PATHS.auth.logout),
  forgot: endpoint<AuthMessage, { email: string }>('POST', API_PATHS.auth.forgot),
  handoff: endpoint<HandoffCode>('POST', API_PATHS.auth.handoff),
  me: endpoint<User>('GET', API_PATHS.me),
  updateProfile: endpoint<User, { display_name: string }>('PATCH', API_PATHS.me),
  deleteAccount: endpoint<void, { password: string }>('POST', API_PATHS.deleteAccount),
  profile: endpoint<PublicProfile>('GET', API_PATHS.profile),
  follow: endpoint<FollowResponse>(['PUT', 'DELETE'], API_PATHS.follow),
  report: endpoint<CreatedResponse, ReportInput>('POST', API_PATHS.report),
  adminReports: endpoint<Report[]>('GET', API_PATHS.admin.reports),
  moderateReport: endpoint<unknown, Decision<'hide' | 'dismiss'>>('PUT', API_PATHS.admin.report),
  adminGyms: endpoint<Gym[]>('GET', API_PATHS.admin.gyms),
  moderateGym: endpoint<unknown, Decision<'approve' | 'reject'>>('PUT', API_PATHS.admin.gym),
  adminUsers: endpoint<User[]>('GET', API_PATHS.admin.users),
  setUserDisabled: endpoint<unknown, { disabled: boolean }>('PUT', API_PATHS.admin.user),
};

type Endpoints = typeof endpoints;
type Handler<Name extends keyof Endpoints> =
  Endpoints[Name] extends Endpoint<infer Response, infer Body>
    ? (received: Received<Body>) => Response | Promise<Response>
    : never;
export type Handlers = { [Name in keyof Endpoints]: Handler<Name> };

const defaults: Handlers = {
  gyms: () => [gym],
  location: () => null,
  routes: () => [route],
  route: () => route,
  removeRoute: () => undefined,
  notes: () => [note],
  like: ({ method }) => ({
    liked: method === 'PUT',
    likes: route.likes + (method === 'PUT' ? 1 : 0),
  }),
  logAscent: ({ body }) => ({
    ...route,
    sends: route.sends + (body.sent ? 1 : 0),
    my_ascent: {
      sent: body.sent,
      grade: body.grade ?? null,
      note: body.note ?? null,
      updated_at: NOW,
    },
  }),
  removeAscent: () => route,
  signup: () => ({ message: 'Check your email to verify the account' }),
  login: () => ({ token: 'test-token', user: account }),
  logout: () => undefined,
  forgot: () => ({ message: 'If that account exists, a reset email will be sent' }),
  handoff: () => ({ code: 'a'.repeat(64) }),
  me: () => account,
  updateProfile: ({ body }) => ({ ...account, display_name: body.display_name }),
  deleteAccount: () => undefined,
  profile: () => profile,
  follow: ({ method }) => ({
    followed: method === 'PUT',
    followers: profile.followers + (method === 'PUT' ? 1 : 0),
  }),
  report: () => ({ id: 'report' }),
  adminReports: () => [],
  moderateReport: () => ({}),
  adminGyms: () => [],
  moderateGym: () => ({}),
  adminUsers: () => [],
  setUserDisabled: () => ({}),
};

const compile = (template: string) => new RegExp(`^${template.replace(ID, '([^/]+)')}$`);

/**
 * Replaces the app's transport with an in-memory API. `overrides` change what named endpoints
 * answer; a handler that throws ApiError answers with that status.
 */
export function fakeApi(overrides: Partial<Handlers> = {}) {
  const handlers: Handlers = { ...defaults, ...overrides };
  const names = Object.keys(endpoints) as (keyof Endpoints)[];
  const calls: { name: keyof Endpoints; received: Received<any> }[] = [];

  (lynx as any).fetch = vi.fn(
    async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      const { pathname, searchParams } = new URL(url, 'http://app.test');
      const method = init.method ?? 'GET';
      const path = pathname.replace(/^\/api/, '');
      const matches = (name: keyof Endpoints) =>
        endpoints[name].methods.includes(method) && compile(endpoints[name].template).test(path);
      const name = names.find(matches);
      if (!name) throw new Error(`Unhandled request: ${method} ${path}`);
      const received: Received<any> = {
        method,
        param: decodeURIComponent(compile(endpoints[name].template).exec(path)![1] ?? ''),
        query: searchParams,
        body: init.body ? JSON.parse(init.body as string) : undefined,
        token: init.headers.Authorization?.replace('Bearer ', '') ?? null,
      };
      calls.push({ name, received });
      try {
        const body = await (handlers[name] as (received: Received<any>) => unknown)(received);
        return { ok: true, status: body === undefined ? 204 : 200, json: async () => body };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return { ok: false, status: error.status, json: async () => ({ detail: error.message }) };
      }
    }
  );

  return {
    /** What the named endpoint received, oldest first. */
    to: <Name extends keyof Endpoints>(name: Name) =>
      calls.filter((call) => call.name === name).map((call) => call.received) as Received<
        Endpoints[Name] extends Endpoint<any, infer Body> ? Body : never
      >[],
  };
}
