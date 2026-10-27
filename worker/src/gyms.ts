import type { CreatedResponse, GymListing } from '../../app/src/client-contract';
import { all, newId, now, run } from './db';
import type { Env } from './env';
import { fail, json, jsonBody } from './http';
import { GYM_ADDRESS_LENGTH, GYM_NAME_LENGTH, MAX_PENDING_GYMS_PER_USER } from './limits';
import { requireUser } from './session';
import { coordinates, requiredText } from './validate';

export const GYM_COLUMNS = 'id, country_code, name, address, latitude, longitude, status';

export async function listGyms(_req: Request, env: Env) {
  const gyms = await all<GymListing>(
    env.DB,
    `SELECT ${GYM_COLUMNS},
       (SELECT COUNT(*) FROM routes WHERE gym_id = gyms.id AND status = 'visible') AS route_count
     FROM gyms WHERE status = 'approved' ORDER BY name`
  );
  // The one list that is the same for everyone and changes slowly: let browsers reuse it.
  const response = json(gyms);
  response.headers.set('cache-control', 'public, max-age=300');
  return response;
}

export async function requestGym(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const input = await jsonBody(req);
  const invalid = 'Invalid gym details';
  const name = requiredText(input.name, GYM_NAME_LENGTH, invalid);
  const address = requiredText(input.address, GYM_ADDRESS_LENGTH, invalid);
  const country = requiredText(input.country_code, [2, 2], invalid).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw fail(422, invalid);
  const { latitude, longitude } = coordinates(input.latitude, input.longitude, invalid);

  // The cap is checked inside the INSERT so concurrent requests cannot exceed it.
  const id = newId();
  const inserted = await run(
    env.DB,
    `INSERT INTO gyms(id, country_code, name, address, latitude, longitude, status, requested_by, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8
     WHERE (SELECT COUNT(*) FROM gyms WHERE requested_by = ?7 AND status = 'pending') < ?9`,
    id,
    country,
    name,
    address,
    latitude,
    longitude,
    user.id,
    now(),
    MAX_PENDING_GYMS_PER_USER
  );
  if (!inserted.meta.changes) throw fail(429, 'Pending gym limit reached');
  return json({ id } satisfies CreatedResponse, 201);
}
