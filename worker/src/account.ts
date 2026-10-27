import { first, run, stmt } from './db';
import type { Env } from './env';
import { BAD_CREDENTIALS, deleteIdentity, signIn } from './firebase';
import { fail, json, jsonBody, noContent } from './http';
import { DISPLAY_NAME_LENGTH } from './limits';
import { type UserRow, publicUser, requireUser } from './session';
import { password, requiredText } from './validate';

export async function getMe(req: Request, env: Env) {
  return json(publicUser(await requireUser(req, env)));
}

export async function updateProfile(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const displayName = requiredText(
    (await jsonBody(req)).display_name,
    DISPLAY_NAME_LENGTH,
    'Display name is required'
  );
  await run(env.DB, 'UPDATE users SET display_name = ? WHERE id = ?', displayName, user.id);
  return json(publicUser({ ...user, display_name: displayName }));
}

/**
 * Prove the signed-in user knows their password. A wrong one is a 403, not the
 * 401 of login, so the client can tell it from an expired session.
 */
async function confirmPassword(env: Env, user: UserRow, passphrase: string) {
  const forbidden = () => fail(403, BAD_CREDENTIALS);
  const { localId, idToken } = await signIn(env, user.email, passphrase).catch((error) => {
    throw error instanceof Response && error.status === 401 ? forbidden() : error;
  });
  if (localId !== user.id) throw forbidden();
  return idToken;
}

// Deleting an account needs the password again, so a stolen session token is
// not enough. Firebase goes first; local data follows in one batch.
export async function deleteAccount(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const passphrase = password((await jsonBody(req)).password, 'Password is required');
  // Checked before Firebase is touched so a refusal leaves nothing half-done.
  if (user.role === 'admin') {
    const admins = await first<{ n: number }>(
      env.DB,
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0"
    );
    if (admins!.n <= 1) throw fail(409, 'At least one administrator must remain active');
  }
  const idToken = await confirmPassword(env, user, passphrase);
  await deleteIdentity(env, idToken);

  // Foreign keys cascade the rest: sessions, hand-offs, likes, ascents, follows,
  // and the user's routes with their photos and everyone's ascents on them.
  // Reports they filed stay, anonymized; reports about what is deleted go.
  await env.DB.batch([
    stmt(env.DB, "DELETE FROM gyms WHERE requested_by = ? AND status != 'approved'", user.id),
    stmt(env.DB, 'DELETE FROM users WHERE id = ?', user.id),
    stmt(
      env.DB,
      `DELETE FROM reports WHERE
         (target_type = 'route' AND target_id NOT IN (SELECT id FROM routes))
         OR (target_type = 'ascent' AND target_id NOT IN (SELECT id FROM ascents))
         OR (target_type = 'user' AND target_id NOT IN (SELECT id FROM users))`
    ),
  ]);
  return noContent();
}
