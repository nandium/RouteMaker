import type { Gym, Report, User } from '../../app/src/client-contract';
import { all, first, run, stmt } from './db';
import type { Env } from './env';
import { fail, json, jsonBody, noContent, type Params } from './http';
import { GYM_COLUMNS } from './gyms';
import { LIST_LIMIT } from './limits';
import { resolveReportsStmt } from './reports';
import { hideRoute } from './routes';
import { type UserRow, publicUser, requireAdmin, revokeSessionsStmt } from './session';
import { flag, oneOf } from './validate';

export async function listReports(req: Request, env: Env) {
  await requireAdmin(req, env);
  return json(
    await all<Report>(
      env.DB,
      `SELECT id, target_type, target_id, reason, details,
         CASE target_type
           WHEN 'route' THEN (SELECT name FROM routes WHERE id = reports.target_id)
           WHEN 'ascent' THEN (SELECT note FROM ascents WHERE id = reports.target_id)
           ELSE (SELECT username FROM users WHERE id = reports.target_id)
         END AS target_label,
         CASE target_type
           WHEN 'route' THEN target_id
           WHEN 'ascent' THEN (SELECT route_id FROM ascents WHERE id = reports.target_id)
         END AS route_id
       FROM reports WHERE status = 'open' ORDER BY created_at DESC LIMIT ?`,
      LIST_LIMIT
    )
  );
}

export async function moderateReport(req: Request, env: Env, { id }: Params) {
  const admin = await requireAdmin(req, env);
  const { decision } = await jsonBody(req);
  const action = oneOf(decision, ['dismiss', 'hide'], 'Decision must be dismiss or hide');
  const report = await first<Pick<Report, 'target_type' | 'target_id'>>(
    env.DB,
    "SELECT target_type, target_id FROM reports WHERE id = ? AND status = 'open'",
    id
  );
  if (!report) throw fail(404, 'Open report not found');

  if (action === 'dismiss') {
    await run(
      env.DB,
      "UPDATE reports SET status = 'dismissed', resolved_by = ? WHERE id = ? AND status = 'open'",
      admin.id,
      id
    );
    return noContent();
  }
  // Acting on content that is already hidden still resolves the report, so
  // duplicate reports never get stuck open.
  const { target_type: type, target_id: targetId } = report;
  const resolve = resolveReportsStmt(env.DB, type, targetId, admin.id);
  if (type === 'route') {
    await hideRoute(env.DB, targetId, admin.id);
  } else if (type === 'ascent') {
    // The send and grade stay; only the reported text goes.
    await env.DB.batch([
      stmt(env.DB, 'UPDATE ascents SET note = NULL WHERE id = ?', targetId),
      resolve,
    ]);
  } else {
    await disableUser(env, targetId, admin.id, [resolve]);
  }
  return noContent();
}

/**
 * Disable an account. Hiding its routes and deleting their photos is what
 * takes its content off the site, so reads need no check of a route's author;
 * its sessions end too. Its likes and ascents stay, because enabling the
 * account restores them, so reads skip those of disabled users instead.
 * Administrators cannot disable themselves, so one always remains.
 */
async function disableUser(
  env: Env,
  userId: string,
  adminId: string,
  alongside: D1PreparedStatement[] = []
) {
  if (userId === adminId) throw fail(409, 'You cannot disable your own account');
  const [disabled] = await env.DB.batch([
    stmt(env.DB, 'UPDATE users SET disabled = 1 WHERE id = ?', userId),
    stmt(
      env.DB,
      "UPDATE routes SET status = 'hidden', image = NULL, thumb = NULL WHERE author_id = ? AND status = 'visible'",
      userId
    ),
    revokeSessionsStmt(env.DB, userId),
    ...alongside,
  ]);
  if (!disabled.meta.changes) throw fail(404, 'User not found');
}

export async function listPendingGyms(req: Request, env: Env) {
  await requireAdmin(req, env);
  return json(
    await all<Gym>(
      env.DB,
      `SELECT ${GYM_COLUMNS} FROM gyms WHERE status = 'pending' ORDER BY created_at LIMIT ?`,
      LIST_LIMIT
    )
  );
}

export async function moderateGym(req: Request, env: Env, { id }: Params) {
  await requireAdmin(req, env);
  const { decision } = await jsonBody(req);
  const action = oneOf(decision, ['approve', 'reject'], 'Decision must be approve or reject');
  const updated = await run(
    env.DB,
    "UPDATE gyms SET status = ? WHERE id = ? AND status = 'pending'",
    action === 'approve' ? 'approved' : 'rejected',
    id
  );
  if (!updated.meta.changes) throw fail(404, 'Pending gym not found');
  return noContent();
}

export async function listUsers(req: Request, env: Env) {
  await requireAdmin(req, env);
  const users = await all<UserRow>(
    env.DB,
    'SELECT * FROM users ORDER BY created_at LIMIT ?',
    LIST_LIMIT
  );
  return json(users.map(publicUser) satisfies User[]);
}

export async function setUserDisabled(req: Request, env: Env, { id }: Params) {
  const admin = await requireAdmin(req, env);
  const disabled = flag((await jsonBody(req)).disabled, 'disabled must be true or false');
  if (disabled) {
    await disableUser(env, id, admin.id);
  } else {
    const enabled = await run(env.DB, 'UPDATE users SET disabled = 0 WHERE id = ?', id);
    if (!enabled.meta.changes) throw fail(404, 'User not found');
  }
  return noContent();
}
