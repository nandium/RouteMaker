import { env, exports } from 'cloudflare:workers';
import { expect, vi } from 'vitest';
import {
  ROUTE_FORM,
  type AscentInput,
  type AuthSession,
  type CreatedResponse,
  type ReportReason,
  type ReportTarget,
  type Route,
} from '../../app/src/client-contract';
import { firebase } from './fake-firebase';
import { JPEG } from './fixture';

export const ORIGIN = 'https://routemaker.test';
export const PASSWORD = 'climb1234';
/** The gym seeded by the migration. */
export const GYM = 'boulder-plus';

type Options = {
  method?: string;
  token?: string;
  json?: unknown;
  form?: FormData;
  /** The client address Cloudflare would report; without one nothing is throttled per client. */
  ip?: string;
};

/** Call the Worker under /api; a JSON or form body defaults the method to POST. */
export function api(path: string, options: Options = {}) {
  const headers = new Headers();
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  if (options.ip) headers.set('cf-connecting-ip', options.ip);
  if (options.json !== undefined) headers.set('content-type', 'application/json');
  const hasBody = options.json !== undefined || options.form !== undefined;
  return exports.default.fetch(`${ORIGIN}/api${path}`, {
    method: options.method ?? (hasBody ? 'POST' : 'GET'),
    headers,
    body: options.form ?? JSON.stringify(options.json),
  });
}

export const media = (path: string) => exports.default.fetch(ORIGIN + path);

/** The `detail` of an error response. */
export const detail = async (response: Response) =>
  (await response.json<{ detail: string }>()).detail;

export const uniqueId = () => crypto.randomUUID().slice(0, 8);

export const signupBody = (id = uniqueId()) => ({
  email: `${id}@example.com`,
  username: `u${id}`,
  display_name: `User ${id}`,
  password: PASSWORD,
});

/** Sign up, verify the email, and log in. */
export async function signIn({ admin = false } = {}): Promise<AuthSession> {
  const body = signupBody();
  expect((await api('/auth/signup', { json: body })).status).toBe(201);
  firebase.verify(body.email);
  const login = await api('/auth/login', {
    json: { email: body.email, password: PASSWORD },
  });
  expect(login.status).toBe(200);
  const session = await login.json<AuthSession>();
  if (!admin) return session;
  await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(session.user.id).run();
  return { ...session, user: { ...session.user, role: 'admin' } };
}

/** Sign up without verifying the email or logging in; returns the new account. */
export async function signUpOnly() {
  const body = signupBody();
  expect((await api('/auth/signup', { json: body })).status).toBe(201);
  const row = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email)
    .first<{ id: string }>();
  return { ...body, id: row!.id };
}

/** Fields of the route form; null leaves one out. */
export type RouteFields = Partial<Record<keyof typeof ROUTE_FORM, string | Uint8Array | null>>;

export function routeForm(fields: RouteFields = {}) {
  const values: RouteFields = {
    name: 'Arete',
    gym_id: GYM,
    owner_grade: 'V4',
    image: JPEG,
    thumbnail: JPEG,
    ...fields,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    form.set(
      ROUTE_FORM[key as keyof typeof ROUTE_FORM],
      typeof value === 'string'
        ? value
        : new File([value as Uint8Array<ArrayBuffer>], 'wall.jpg', { type: 'image/jpeg' })
    );
  }
  return form;
}

export function publishResponse(session: AuthSession, fields?: RouteFields) {
  return api('/routes', { token: session.token, form: routeForm(fields) });
}

export async function publish(session: AuthSession, fields?: RouteFields) {
  const response = await publishResponse(session, fields);
  expect(response.status).toBe(201);
  return response.json<Route>();
}

export const like = (user: AuthSession, routeId: string, liked = true) =>
  api(`/routes/${routeId}/like`, { method: liked ? 'PUT' : 'DELETE', token: user.token });

export const follow = (user: AuthSession, userId: string, followed = true) =>
  api(`/users/${userId}/follow`, { method: followed ? 'PUT' : 'DELETE', token: user.token });

/** Log an ascent; `input` is sent as given, so tests can send invalid ones. */
export const logAscent = (user: AuthSession, routeId: string, input: AscentInput | unknown) =>
  api(`/routes/${routeId}/ascent`, { method: 'PUT', token: user.token, json: input });

export const removeAscent = (user: AuthSession, routeId: string) =>
  api(`/routes/${routeId}/ascent`, { method: 'DELETE', token: user.token });

export const reportResponse = (
  reporter: AuthSession,
  target_type: ReportTarget | string,
  target_id: string,
  reason: ReportReason | string = 'spam',
  details?: string
) => api('/reports', { token: reporter.token, json: { target_type, target_id, reason, details } });

/** File a report that must be accepted; returns its id. */
export async function report(
  reporter: AuthSession,
  target_type: ReportTarget,
  target_id: string,
  reason: ReportReason = 'spam',
  details?: string
) {
  const response = await reportResponse(reporter, target_type, target_id, reason, details);
  expect(response.status).toBe(201);
  return (await response.json<CreatedResponse>()).id;
}

/** Insert photo routes directly; `ageSeconds` keeps them outside the daily publish window. */
export async function seedRoutes(
  authorId: string,
  count: number,
  { ageSeconds = 0, gymId = GYM } = {}
) {
  const created = Math.floor(Date.now() / 1000) - ageSeconds;
  const insert = env.DB.prepare(
    "INSERT INTO routes(id, author_id, gym_id, name, owner_grade, created_at, image, thumb) VALUES (?, ?, ?, ?, 'V4', ?, x'ff', x'ff')"
  );
  await env.DB.batch(
    Array.from({ length: count }, (_, i) =>
      insert.bind(crypto.randomUUID(), authorId, gymId, `Seed ${i}`, created - i)
    )
  );
}

/** Insert an approved gym. */
export async function insertGym(id: string, name = 'Test gym') {
  await env.DB.prepare(
    "INSERT INTO gyms(id, country_code, name, address, latitude, longitude, status, created_at) VALUES (?, 'SG', ?, '1 Test Road', 1.3, 103.8, 'approved', 1)"
  )
    .bind(id, name)
    .run();
}

/** Disable an account as an administrator would: routes down, sessions ended. */
export async function disable(user: AuthSession) {
  const moderator = await signIn({ admin: true });
  const response = await api(`/admin/users/${user.user.id}`, {
    method: 'PUT',
    token: moderator.token,
    json: { disabled: true },
  });
  expect(response.status).toBe(204);
}

/** Set only the disabled flag, leaving routes and sessions as they were. */
export const flagDisabled = (user: AuthSession) =>
  env.DB.prepare('UPDATE users SET disabled = 1 WHERE id = ?').bind(user.user.id).run();

/** Take a route down directly in the database, as moderation would. */
export const hideInDb = (route: Route) =>
  env.DB.prepare("UPDATE routes SET status = 'hidden', image = NULL, thumb = NULL WHERE id = ?")
    .bind(route.id)
    .run();

export async function count(sql: string, ...args: unknown[]) {
  return (await env.DB.prepare(sql)
    .bind(...args)
    .first<number>('n'))!;
}

/** How many D1 statements `action` prepares. */
export async function countQueries(action: () => Promise<unknown>) {
  const prepare = vi.spyOn(env.DB, 'prepare');
  try {
    await action();
    return prepare.mock.calls.length;
  } finally {
    prepare.mockRestore();
  }
}
