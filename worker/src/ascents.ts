import type { AscentNote } from '../../app/src/client-contract';
import { all, newId, now, run } from './db';
import type { Env } from './env';
import { json, jsonBody, type Params } from './http';
import { LIST_LIMIT, NOTE_LENGTH } from './limits';
import { authorOf, requireRoute } from './routes';
import { requireUser } from './session';
import { flag, grade, optionalText } from './validate';

/** Create or replace the signed-in climber's ascent; omitted fields are cleared. */
export async function logAscent(req: Request, env: Env, { id }: Params) {
  const user = await requireUser(req, env);
  const input = await jsonBody(req);
  const sent = flag(input.sent, 'sent must be true or false');
  const ascentGrade = input.grade === undefined || input.grade === null ? null : grade(input.grade);
  const note = optionalText(input.note, NOTE_LENGTH, 'Invalid note');
  await requireRoute(env, id, user.id);
  await run(
    env.DB,
    `INSERT INTO ascents(id, route_id, user_id, sent, grade, note, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(route_id, user_id) DO UPDATE SET
       sent = excluded.sent, grade = excluded.grade, note = excluded.note,
       updated_at = excluded.updated_at`,
    newId(),
    id,
    user.id,
    sent ? 1 : 0,
    ascentGrade,
    note,
    now()
  );
  return json(await requireRoute(env, id, user.id));
}

export async function removeAscent(req: Request, env: Env, { id }: Params) {
  const user = await requireUser(req, env);
  await requireRoute(env, id, user.id);
  await run(env.DB, 'DELETE FROM ascents WHERE route_id = ? AND user_id = ?', id, user.id);
  return json(await requireRoute(env, id, user.id));
}

export async function listNotes(_req: Request, env: Env, { id }: Params) {
  await requireRoute(env, id, null);
  const rows = await all<{
    id: string;
    sent: number;
    grade: string | null;
    note: string;
    updated_at: number;
    username: string;
    display_name: string;
  }>(
    env.DB,
    `SELECT ascents.id, ascents.sent, ascents.grade, ascents.note, ascents.updated_at,
       users.username, users.display_name
     FROM ascents JOIN users ON users.id = ascents.user_id
     WHERE ascents.route_id = ? AND ascents.note IS NOT NULL AND users.disabled = 0
     ORDER BY ascents.updated_at DESC LIMIT ?`,
    id,
    LIST_LIMIT
  );
  return json(
    rows.map((row): AscentNote => ({
      id: row.id,
      author: authorOf(row),
      sent: !!row.sent,
      grade: row.grade,
      note: row.note,
      updated_at: row.updated_at,
    }))
  );
}
