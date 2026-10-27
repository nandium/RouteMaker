import { now, stmt } from './db';
import type { Env } from './env';
import { fail } from './http';
import { AUTH_PER_CLIENT, type Throttle } from './limits';

// Rows are kept a day after their window began, far longer than any window lasts.
const KEEP_SECONDS = 24 * 60 * 60;

/**
 * Count one attempt against `key` and refuse it once more than `limit` fall in a
 * window. The count is one atomic upsert, so a burst of parallel requests cannot
 * get past the limit. The window starts at the first attempt and resets once it
 * has run out; rows long past their window are deleted along the way.
 */
export async function throttle(env: Env, key: string, { limit, windowSeconds }: Throttle) {
  const timestamp = now();
  const [, counted] = await env.DB.batch<{ count: number; window_start: number }>([
    stmt(env.DB, 'DELETE FROM throttles WHERE window_start < ?', timestamp - KEEP_SECONDS),
    stmt(
      env.DB,
      `INSERT INTO throttles(key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END,
         count = CASE WHEN window_start <= ?2 - ?3 THEN 1 ELSE count + 1 END
       RETURNING count, window_start`,
      key,
      timestamp,
      windowSeconds
    ),
  ]);
  const { count, window_start: windowStart } = counted.results[0];
  if (count <= limit) return;
  const refusal = fail(429, 'Too many attempts. Try again later.');
  refusal.headers.set('retry-after', String(Math.max(1, windowStart + windowSeconds - timestamp)));
  throw refusal;
}

/**
 * Throttle by the client's address, one bucket per `scope`. Cloudflare sets
 * cf-connecting-ip on every request and clients cannot override it; without it
 * (local development) there is nothing to key on.
 */
export async function throttleClient(req: Request, env: Env, scope: string, rule: Throttle) {
  const address = req.headers.get('cf-connecting-ip');
  if (address) await throttle(env, `${scope}:${address}`, rule);
}

/** Everything that signs in, proves a link or code, or sends mail shares one bucket per client. */
export const throttleAuth = (req: Request, env: Env) =>
  throttleClient(req, env, 'auth', AUTH_PER_CLIENT);
