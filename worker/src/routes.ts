import { ROUTE_FORM, type LikeResponse, type Route } from '../../app/src/client-contract';
import { all, first, newId, now, run, stmt } from './db';
import type { Env } from './env';
import { fail, formBody, json, noContent, type Handler, type Params } from './http';
import { isBaselineJpeg } from './jpeg';
import {
  DAILY_ROUTE_LIMIT,
  DAILY_WINDOW_SECONDS,
  ID_LENGTH,
  LIST_LIMIT,
  MAX_SITE_IMAGES,
  MAX_USER_IMAGES,
  PHOTO,
  ROUTE_NAME_LENGTH,
  THUMBNAIL,
  type JpegSpec,
} from './limits';
import { resolveReportsStmt } from './reports';
import { requireUser, sessionUser, unauthenticated } from './session';
import { grade, requiredText } from './validate';

type AuthorRow = { username: string; display_name: string };

export const authorOf = (row: AuthorRow) => ({
  username: row.username,
  display_name: row.display_name,
});

// Routes with their social counts in one query; D1's Free plan allows only 50
// queries per request. Likes and ascents of disabled users are ignored; their
// routes are not listed because disabling takes those down (see disableUser).
// Public grade: the most-voted grade among sends, the easier grade on ties, the
// setter's when nobody graded. `?1` binds the viewer (NULL when anonymous);
// callers append conditions to the WHERE clause.
const ROUTES_SQL = `
  SELECT r.id, r.name, r.created_at, g.id AS gym_id, g.name AS gym_name,
    u.username, u.display_name,
    COALESCE(
      (SELECT ascents.grade FROM ascents JOIN users climber ON climber.id = ascents.user_id
        WHERE ascents.route_id = r.id AND ascents.sent = 1
          AND ascents.grade IS NOT NULL AND climber.disabled = 0
        GROUP BY ascents.grade
        ORDER BY COUNT(*) DESC, CAST(substr(ascents.grade, 2) AS INTEGER)
        LIMIT 1),
      r.owner_grade) AS public_grade,
    (SELECT COUNT(*) FROM likes JOIN users fan ON fan.id = likes.user_id
      WHERE likes.route_id = r.id AND fan.disabled = 0) AS likes,
    EXISTS (SELECT 1 FROM likes WHERE route_id = r.id AND user_id = ?1) AS liked,
    (SELECT COUNT(*) FROM ascents JOIN users climber ON climber.id = ascents.user_id
      WHERE ascents.route_id = r.id AND ascents.sent = 1 AND climber.disabled = 0) AS sends,
    mine.sent AS my_sent, mine.grade AS my_grade, mine.note AS my_note,
    mine.updated_at AS my_updated_at
  FROM routes r
  JOIN users u ON u.id = r.author_id
  JOIN gyms g ON g.id = r.gym_id
  LEFT JOIN ascents mine ON mine.route_id = r.id AND mine.user_id = ?1
  WHERE r.status = 'visible'`;

type RouteRow = AuthorRow & {
  id: string;
  name: string;
  created_at: number;
  gym_id: string;
  gym_name: string;
  public_grade: string;
  likes: number;
  liked: number;
  sends: number;
  my_sent: number | null;
  my_grade: string | null;
  my_note: string | null;
  my_updated_at: number | null;
};

const toRoute = (row: RouteRow): Route => ({
  id: row.id,
  name: row.name,
  public_grade: row.public_grade,
  likes: row.likes,
  liked: !!row.liked,
  sends: row.sends,
  my_ascent:
    row.my_sent === null
      ? null
      : {
          sent: !!row.my_sent,
          grade: row.my_grade,
          note: row.my_note,
          updated_at: row.my_updated_at!,
        },
  image_url: `/media/${row.id}`,
  thumb_url: `/media/${row.id}/thumb`,
  created_at: row.created_at,
  author: authorOf(row),
  gym: { id: row.gym_id, name: row.gym_name },
});

/** A public route as `viewerId` sees it, or null. */
export async function findRoute(env: Env, id: string, viewerId: string | null) {
  const row = await first<RouteRow>(env.DB, `${ROUTES_SQL} AND r.id = ?2`, viewerId, id);
  return row && toRoute(row);
}

export async function requireRoute(env: Env, id: string, viewerId: string | null) {
  const route = await findRoute(env, id, viewerId);
  if (!route) throw fail(404, 'Route not found');
  return route;
}

export async function listRoutes(req: Request, env: Env) {
  const viewer = await sessionUser(req, env);
  const query = new URL(req.url).searchParams;
  const following = query.get('following') === 'true';
  if (following && !viewer) throw unauthenticated();
  const rows = await all<RouteRow>(
    env.DB,
    `${ROUTES_SQL}
       AND (?2 IS NULL OR r.gym_id = ?2)
       AND (?3 IS NULL OR r.author_id = ?3)
       AND (NOT ?4 OR r.author_id IN (SELECT followed_id FROM follows WHERE follower_id = ?1))
     ORDER BY r.created_at DESC LIMIT ?5`,
    viewer?.id ?? null,
    query.get('gym_id') || null,
    query.get('author_id') || null,
    following ? 1 : 0,
    LIST_LIMIT
  );
  return json(rows.map(toRoute));
}

export async function getRoute(req: Request, env: Env, { id }: Params) {
  const viewer = await sessionUser(req, env);
  return json(await requireRoute(env, id, viewer?.id ?? null));
}

/** The bytes of a multipart JPEG field, checked for size and structure. */
async function jpegUpload(form: FormData, { field, label, maxBytes, maxDimension }: JpegSpec) {
  const file = form.get(field);
  if (!(file instanceof File)) throw fail(422, `${label} is required`);
  if (file.size > maxBytes) throw fail(413, `${label} exceeds the ${maxBytes / 1024} KiB limit`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isBaselineJpeg(bytes, maxDimension))
    throw fail(415, `${label} must be a baseline JPEG up to ${maxDimension}px`);
  return bytes;
}

type NewRoute = {
  name: string;
  gymId: string;
  grade: string;
  image: Uint8Array;
  thumb: Uint8Array;
};

async function readRouteForm(form: FormData): Promise<NewRoute> {
  return {
    name: requiredText(form.get(ROUTE_FORM.name), ROUTE_NAME_LENGTH, 'Route name is required'),
    gymId: requiredText(form.get(ROUTE_FORM.gym_id), ID_LENGTH, 'Choose an approved gym'),
    grade: grade(form.get(ROUTE_FORM.owner_grade)),
    image: await jpegUpload(form, PHOTO),
    thumb: await jpegUpload(form, THUMBNAIL),
  };
}

/**
 * Publishing is capped per day, per account and per site. The caps are checked
 * inside the INSERT: a check followed by an insert would let concurrent
 * uploads from one account burst past them. False when a cap is full.
 *
 * Photos cross as hex text: D1 hands BLOBs back as JSON number arrays, and
 * parsing half a million of them takes milliseconds of the Free plan's 10 ms
 * CPU limit.
 */
async function insertWithinCaps(
  env: Env,
  id: string,
  authorId: string,
  route: NewRoute,
  timestamp: number
) {
  const inserted = await run(
    env.DB,
    `INSERT INTO routes(id, author_id, gym_id, name, owner_grade, created_at, image, thumb)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, unhex(?7), unhex(?8)
     WHERE (SELECT COUNT(*) FROM routes WHERE author_id = ?2 AND created_at > ?9) < ?10
       AND (SELECT COUNT(*) FROM routes WHERE author_id = ?2 AND image IS NOT NULL) < ?11
       AND (SELECT COUNT(*) FROM routes WHERE image IS NOT NULL) < ?12`,
    id,
    authorId,
    route.gymId,
    route.name,
    route.grade,
    timestamp,
    route.image.toHex(),
    route.thumb.toHex(),
    timestamp - DAILY_WINDOW_SECONDS,
    DAILY_ROUTE_LIMIT,
    MAX_USER_IMAGES,
    MAX_SITE_IMAGES
  );
  return inserted.meta.changes > 0;
}

/** Which cap refused an upload. */
async function capReached(env: Env, authorId: string, timestamp: number) {
  const usage = await first<{ recent: number; mine: number }>(
    env.DB,
    `SELECT (SELECT COUNT(*) FROM routes WHERE author_id = ?1 AND created_at > ?2) AS recent,
            (SELECT COUNT(*) FROM routes WHERE author_id = ?1 AND image IS NOT NULL) AS mine`,
    authorId,
    timestamp - DAILY_WINDOW_SECONDS
  );
  if (usage!.recent >= DAILY_ROUTE_LIMIT) return fail(429, 'Daily route limit reached');
  if (usage!.mine >= MAX_USER_IMAGES) return fail(429, 'Account photo limit reached');
  // Neither of the author's caps is full, so the site's is.
  return fail(507, 'Site photo limit reached');
}

export async function createRoute(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const route = await readRouteForm(await formBody(req));
  if (
    !(await first(env.DB, "SELECT 1 FROM gyms WHERE id = ? AND status = 'approved'", route.gymId))
  )
    throw fail(422, 'Choose an approved gym');

  const id = newId();
  const timestamp = now();
  if (!(await insertWithinCaps(env, id, user.id, route, timestamp)))
    throw await capReached(env, user.id, timestamp);
  return json(await requireRoute(env, id, user.id), 201);
}

/**
 * Take a route down: its photo and thumbnail are deleted and its open reports
 * resolved, together. Idempotent. Used by authors, admins and moderation.
 */
export async function hideRoute(db: D1Database, routeId: string, actorId: string) {
  await db.batch([
    stmt(
      db,
      "UPDATE routes SET status = 'hidden', image = NULL, thumb = NULL WHERE id = ?",
      routeId
    ),
    resolveReportsStmt(db, 'route', routeId, actorId),
  ]);
}

export async function removeRoute(req: Request, env: Env, { id }: Params) {
  const user = await requireUser(req, env);
  const route = await first<{ author_id: string }>(
    env.DB,
    "SELECT author_id FROM routes WHERE id = ? AND status = 'visible'",
    id
  );
  if (!route) throw fail(404, 'Route not found');
  if (route.author_id !== user.id && user.role !== 'admin')
    throw fail(403, 'Only the author or an administrator can remove a route');
  await hideRoute(env.DB, id, user.id);
  return noContent();
}

async function setLike(req: Request, env: Env, id: string, liked: boolean) {
  const user = await requireUser(req, env);
  await requireRoute(env, id, user.id);
  if (liked)
    await run(env.DB, 'INSERT OR IGNORE INTO likes(route_id, user_id) VALUES (?, ?)', id, user.id);
  else await run(env.DB, 'DELETE FROM likes WHERE route_id = ? AND user_id = ?', id, user.id);
  const { likes } = await requireRoute(env, id, user.id);
  return json({ liked, likes } satisfies LikeResponse);
}

export const likeRoute: Handler = (req, env, { id }) => setLike(req, env, id, true);
export const unlikeRoute: Handler = (req, env, { id }) => setLike(req, env, id, false);

/** Hidden routes lose their photos, but browsers keep copies; keep the window short. */
const MEDIA_CACHE = 'private, max-age=3600';

const mediaHandler =
  (column: 'image' | 'thumb'): Handler =>
  async (_req, env, { id }) => {
    const row = await first<{ data: string }>(
      env.DB,
      // Hex text, not a BLOB: see insertWithinCaps.
      `SELECT hex(${column}) AS data FROM routes WHERE id = ? AND status = 'visible'`,
      id
    );
    if (!row) throw fail(404, 'Image not found');
    return new Response(Uint8Array.fromHex(row.data), {
      headers: { 'content-type': 'image/jpeg', 'cache-control': MEDIA_CACHE },
    });
  };

export const getImage = mediaHandler('image');
export const getThumbnail = mediaHandler('thumb');
