import type { FollowResponse, PublicProfile } from '../../app/src/client-contract';
import { first, run } from './db';
import type { Env } from './env';
import { fail, json, type Handler, type Params } from './http';
import { requireUser, sessionUser } from './session';

/** Followers who are still active, for the user in the surrounding `users` row. */
const FOLLOWER_COUNT = `(SELECT COUNT(*) FROM follows JOIN users f ON f.id = follows.follower_id
  WHERE follows.followed_id = users.id AND f.disabled = 0)`;

type ProfileRow = Omit<PublicProfile, 'followed'> & { followed: number };

export async function getProfile(req: Request, env: Env, { username }: Params) {
  const viewer = await sessionUser(req, env);
  const row = await first<ProfileRow>(
    env.DB,
    `SELECT id, username, display_name,
       ${FOLLOWER_COUNT} AS followers,
       (SELECT COUNT(*) FROM follows JOIN users f ON f.id = follows.followed_id
         WHERE follows.follower_id = users.id AND f.disabled = 0) AS following,
       EXISTS (SELECT 1 FROM follows WHERE follower_id = ?1 AND followed_id = users.id) AS followed
     FROM users WHERE username = ?2 AND disabled = 0 AND verified = 1`,
    viewer?.id ?? null,
    username
  );
  if (!row) throw fail(404, 'User not found');
  return json({ ...row, followed: !!row.followed } satisfies PublicProfile);
}

async function setFollow(req: Request, env: Env, id: string, followed: boolean) {
  const user = await requireUser(req, env);
  if (id === user.id) throw fail(422, 'You cannot follow yourself');
  if (
    !(await first(env.DB, 'SELECT 1 FROM users WHERE id = ? AND disabled = 0 AND verified = 1', id))
  )
    throw fail(404, 'User not found');
  if (followed)
    await run(
      env.DB,
      'INSERT OR IGNORE INTO follows(follower_id, followed_id) VALUES (?, ?)',
      user.id,
      id
    );
  else
    await run(env.DB, 'DELETE FROM follows WHERE follower_id = ? AND followed_id = ?', user.id, id);
  const row = await first<{ followers: number }>(
    env.DB,
    `SELECT ${FOLLOWER_COUNT} AS followers FROM users WHERE id = ?`,
    id
  );
  return json({ followed, followers: row!.followers } satisfies FollowResponse);
}

export const followUser: Handler = (req, env, { id }) => setFollow(req, env, id, true);
export const unfollowUser: Handler = (req, env, { id }) => setFollow(req, env, id, false);
