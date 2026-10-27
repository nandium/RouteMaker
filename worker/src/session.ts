import {
  HANDOFF_CODE_PATTERN,
  type AuthSession,
  type HandoffCode,
  type User,
} from '../../app/src/client-contract';
import { first, now, run, stmt } from './db';
import type { Env } from './env';
import { fail, json, jsonBody, noContent } from './http';
import { HANDOFF_TTL_SECONDS, MAX_SESSIONS_PER_USER, SESSION_TTL_SECONDS } from './limits';
import { throttleAuth } from './throttle';

export type UserRow = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: 'user' | 'admin';
  disabled: number;
  verified: number;
  created_at: number;
};

export const publicUser = (user: UserRow): User => ({
  id: user.id,
  email: user.email,
  username: user.username,
  display_name: user.display_name,
  role: user.role,
  disabled: !!user.disabled,
});

/** 256 random bits: session tokens and hand-off codes. */
const randomToken = () => crypto.getRandomValues(new Uint8Array(32)).toHex();

/** Tokens are stored hashed, so a database leak does not yield usable sessions. */
async function digest(text: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return new Uint8Array(hash).toHex();
}

function bearerToken(req: Request) {
  const header = req.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Open a session. Pruning keeps the newest sessions plus `keepHash`, so a
 * hand-off never signs out the device that issued it.
 */
export async function createSession(env: Env, user: UserRow, keepHash = ''): Promise<AuthSession> {
  const token = randomToken();
  const timestamp = now();
  // rowid grows with each insert, so it orders sessions by creation.
  await env.DB.batch([
    stmt(env.DB, 'DELETE FROM sessions WHERE expires_at <= ?', timestamp),
    stmt(
      env.DB,
      'INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)',
      await digest(token),
      user.id,
      timestamp + SESSION_TTL_SECONDS
    ),
    stmt(
      env.DB,
      `DELETE FROM sessions
       WHERE user_id = ?1 AND token_hash != ?2
         AND rowid NOT IN (SELECT rowid FROM sessions WHERE user_id = ?1 ORDER BY rowid DESC LIMIT ?3)`,
      user.id,
      keepHash,
      MAX_SESSIONS_PER_USER
    ),
  ]);
  return { token, user: publicUser(user) };
}

/** Sign out every device of a user. */
export const revokeSessionsStmt = (db: D1Database, userId: string) =>
  stmt(db, 'DELETE FROM sessions WHERE user_id = ?', userId);

/** Signing out needs no proof of identity: the token is the proof, and it is deleted. */
export async function logout(req: Request, env: Env) {
  const token = bearerToken(req);
  if (token) await run(env.DB, 'DELETE FROM sessions WHERE token_hash = ?', await digest(token));
  return noContent();
}

/** The active user whose unexpired session has this hash. */
const userOfSession = (env: Env, sessionHash: string) =>
  first<UserRow>(
    env.DB,
    `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.disabled = 0`,
    sessionHash,
    now()
  );

/** The signed-in user and the id of the session they signed in with, or null. */
async function authenticate(req: Request, env: Env) {
  const token = bearerToken(req);
  if (!token) return null;
  const sessionHash = await digest(token);
  const user = await userOfSession(env, sessionHash);
  return user && { user, sessionHash };
}

/** The 401 for anything that needs a signed-in user. */
export const unauthenticated = () => fail(401, 'Authentication required');

async function requireSession(req: Request, env: Env) {
  const session = await authenticate(req, env);
  if (!session) throw unauthenticated();
  return session;
}

/** For endpoints that also work signed out. */
export async function sessionUser(req: Request, env: Env) {
  return (await authenticate(req, env))?.user ?? null;
}

export async function requireUser(req: Request, env: Env) {
  return (await requireSession(req, env)).user;
}

export async function requireAdmin(req: Request, env: Env) {
  const user = await requireUser(req, env);
  if (user.role !== 'admin') throw fail(403, 'Admin access required');
  return user;
}

// A hand-off moves a native session into a browser. The code is the only
// credential in the redeem request, so it is 256 random bits, stored hashed,
// short-lived, and burned the first time it is presented.
export async function issueHandoff(req: Request, env: Env) {
  const { sessionHash } = await requireSession(req, env);
  const code = randomToken();
  const timestamp = now();
  // One live code per issuing session; expired codes are swept here.
  await env.DB.batch([
    stmt(
      env.DB,
      'DELETE FROM handoffs WHERE session_hash = ? OR expires_at <= ?',
      sessionHash,
      timestamp
    ),
    stmt(
      env.DB,
      'INSERT INTO handoffs(code_hash, session_hash, expires_at) VALUES (?, ?, ?)',
      await digest(code),
      sessionHash,
      timestamp + HANDOFF_TTL_SECONDS
    ),
  ]);
  return json({ code } satisfies HandoffCode);
}

export async function redeemHandoff(req: Request, env: Env) {
  await throttleAuth(req, env);
  const { code } = await jsonBody(req);
  if (typeof code !== 'string' || !HANDOFF_CODE_PATTERN.test(code))
    throw fail(422, 'Invalid hand-off code');
  const invalidCode = () => fail(401, 'Hand-off code is invalid or expired');
  // One DELETE ... RETURNING makes redemption atomic: concurrent attempts
  // cannot both succeed, and even an expired code is burned.
  const grant = await first<{ session_hash: string; expires_at: number }>(
    env.DB,
    'DELETE FROM handoffs WHERE code_hash = ? RETURNING session_hash, expires_at',
    await digest(code)
  );
  if (!grant || grant.expires_at <= now()) throw invalidCode();
  // The issuing session must still be alive and its user active.
  const user = await userOfSession(env, grant.session_hash);
  if (!user) throw invalidCode();
  return json(await createSession(env, user, grant.session_hash));
}
