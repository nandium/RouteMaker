import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  MAX_THUMBNAIL_BYTES,
  type LikeResponse,
  type Route,
} from '../../app/src/client-contract';
import { JPEG, jpegOfLength, jpegOfSize } from './fixture';
import {
  GYM,
  api,
  count,
  countQueries,
  detail,
  disable,
  follow,
  hideInDb,
  insertGym,
  like,
  media,
  publish,
  publishResponse,
  seedRoutes,
  signIn,
} from './helpers';

const bytes = async (response: Response) => new Uint8Array(await response.arrayBuffer());

describe('publishing a route', () => {
  it('returns the route and serves its photo and thumbnail', async () => {
    const author = await signIn();
    const thumbnail = jpegOfSize(2, 2);
    const route = await publish(author, { name: ' Arete ', owner_grade: 'v4', thumbnail });

    expect(route).toMatchObject({
      name: 'Arete',
      public_grade: 'V4',
      likes: 0,
      liked: false,
      sends: 0,
      my_ascent: null,
      author: { username: author.user.username },
      gym: { id: GYM, name: 'Boulder+ Aperia' },
    });
    expect(route.image_url).toBe(`/media/${route.id}`);
    expect(route.thumb_url).toBe(`/media/${route.id}/thumb`);
    expect(Math.abs(route.created_at - Date.now() / 1000)).toBeLessThan(10);

    const image = await media(route.image_url);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    expect(image.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await bytes(image)).toEqual(JPEG);

    const thumb = await media(route.thumb_url);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(thumb.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await bytes(thumb)).toEqual(thumbnail);
  });

  it('stores photos byte for byte, whatever the bytes are', async () => {
    const author = await signIn();
    // Every byte value, so any text or sign handling on the way in would show.
    const photo = jpegOfLength(MAX_IMAGE_BYTES);
    for (let i = 0; i < 256; i++) photo[1000 + i] = i;
    const route = await publish(author, { image: photo });
    expect(await bytes(await media(route.image_url))).toEqual(photo);
  });

  it('requires a session', async () => {
    expect((await api('/routes', { form: new FormData() })).status).toBe(401);
  });

  it('rejects invalid input', async () => {
    const author = await signIn();
    const cases: [string, Parameters<typeof publishResponse>[1], number][] = [
      ['blank name', { name: '  ' }, 422],
      ['long name', { name: 'x'.repeat(81) }, 422],
      ['bad grade', { owner_grade: 'V18' }, 422],
      ['missing grade', { owner_grade: null }, 422],
      ['unknown gym', { gym_id: 'nowhere' }, 422],
      ['missing image', { image: null }, 422],
      ['missing thumbnail', { thumbnail: null }, 422],
      ['image not a jpeg', { image: new Uint8Array([1, 2, 3]) }, 415],
      ['thumbnail not a jpeg', { thumbnail: new Uint8Array([1, 2]) }, 415],
      ['image too large', { image: jpegOfLength(MAX_IMAGE_BYTES + 1) }, 413],
      ['image too wide', { image: jpegOfSize(1601, 10) }, 415],
      ['thumbnail too large', { thumbnail: jpegOfLength(MAX_THUMBNAIL_BYTES + 1) }, 413],
      ['thumbnail too tall', { thumbnail: jpegOfSize(10, 641) }, 415],
    ];
    for (const [label, fields, status] of cases) {
      expect((await publishResponse(author, fields)).status, label).toBe(status);
    }
    const largest = await publishResponse(author, {
      image: jpegOfLength(MAX_IMAGE_BYTES),
      thumbnail: jpegOfSize(640, 640),
    });
    expect(largest.status).toBe(201);
  });

  it('rejects a gym that is not approved', async () => {
    const author = await signIn();
    await env.DB.prepare(
      "INSERT INTO gyms(id, country_code, name, address, latitude, longitude, status, created_at) VALUES ('pending-gym', 'SG', 'Pending', '1 Road', 1, 1, 'pending', 1)"
    ).run();
    const response = await publishResponse(author, { gym_id: 'pending-gym' });
    expect(response.status).toBe(422);
  });

  it('allows three routes per day', async () => {
    const author = await signIn();
    for (let i = 0; i < 3; i++) await publish(author);
    const fourth = await publishResponse(author);
    expect(fourth.status).toBe(429);
    expect(await detail(fourth)).toMatch(/daily/i);
  });

  it('holds the caps when uploads arrive together', async () => {
    const author = await signIn();
    const responses = await Promise.all(Array.from({ length: 6 }, () => publishResponse(author)));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(3);
  });

  it('caps photos per account', async () => {
    const author = await signIn();
    await seedRoutes(author.user.id, 20, { ageSeconds: 3 * 86400 });
    const response = await publishResponse(author);
    expect(response.status).toBe(429);
    expect(await detail(response)).toMatch(/photo/i);
  });

  it('caps photos across the site', async () => {
    const [author, filler] = [await signIn(), await signIn()];
    await seedRoutes(filler.user.id, 200, { ageSeconds: 3 * 86400 });
    expect((await publishResponse(author)).status).toBe(507);
  });
});

describe('reading routes', () => {
  it("lists a gym's routes newest first, with the viewer's like", async () => {
    const [author, viewer] = [await signIn(), await signIn()];
    const older = await publish(author, { name: 'Older' });
    const newer = await publish(author, { name: 'Newer' });
    await env.DB.prepare('UPDATE routes SET created_at = created_at - 10 WHERE id = ?')
      .bind(older.id)
      .run();
    await like(viewer, newer.id);

    const anonymous = await (await api(`/routes?gym_id=${GYM}`)).json<Route[]>();
    expect(anonymous.map((route) => route.name)).toEqual(['Newer', 'Older']);
    expect(anonymous[0]).toMatchObject({ likes: 1, liked: false });
    expect(anonymous[0].created_at).toBeGreaterThan(anonymous[1].created_at);

    const asViewer = await (
      await api(`/routes?gym_id=${GYM}`, { token: viewer.token })
    ).json<Route[]>();
    expect(asViewer[0]).toMatchObject({ likes: 1, liked: true });
    expect(asViewer[1]).toMatchObject({ likes: 0, liked: false });
  });

  it('returns at most the 100 newest routes', async () => {
    const author = await signIn();
    await seedRoutes(author.user.id, 105);
    const routes = await (await api('/routes')).json<Route[]>();
    expect(routes).toHaveLength(100);
    expect(routes[0].name).toBe('Seed 0');
    expect(routes.map((route) => route.name)).not.toContain('Seed 100');
  });

  it('filters by gym, by author and by who the viewer follows', async () => {
    const [a, b, viewer] = [await signIn(), await signIn(), await signIn()];
    await insertGym('other-gym');
    await publish(a, { name: 'From A' });
    await publish(b, { name: 'From B' });
    await publish(b, { name: 'Elsewhere', gym_id: 'other-gym' });
    await follow(viewer, a.user.id);

    const names = async (query: string, token?: string) =>
      (await (await api(`/routes?${query}`, { token })).json<Route[]>())
        .map((route) => route.name)
        .sort();
    expect(await names('')).toEqual(['Elsewhere', 'From A', 'From B']);
    expect(await names('gym_id=other-gym')).toEqual(['Elsewhere']);
    expect(await names(`author_id=${b.user.id}`)).toEqual(['Elsewhere', 'From B']);
    expect(await names(`gym_id=${GYM}&author_id=${b.user.id}`)).toEqual(['From B']);
    expect(await names('following=true', viewer.token)).toEqual(['From A']);
    expect((await api('/routes?following=true')).status).toBe(401);
  });

  it('answers a list or a detail with as many queries for 100 routes as for one', async () => {
    const [author, filler, viewer] = [await signIn(), await signIn(), await signIn()];
    const route = await publish(author);
    const list = () => api('/routes', { token: viewer.token });
    const one = () => api(`/routes/${route.id}`, { token: viewer.token });
    const [listOne, detailOne] = [await countQueries(list), await countQueries(one)];

    await seedRoutes(filler.user.id, 99, { ageSeconds: 3 * 86400 });
    expect(await (await list()).json<Route[]>()).toHaveLength(100);

    // D1's Free plan allows 50 queries per request, however long the list.
    expect(await countQueries(list)).toBe(listOne);
    expect(await countQueries(one)).toBe(detailOne);
  });

  it("takes down a disabled author's routes", async () => {
    const author = await signIn();
    const route = await publish(author);
    expect((await api(`/routes/${route.id}`)).status).toBe(200);

    await disable(author);

    expect((await api(`/routes/${route.id}`)).status).toBe(404);
    expect((await media(route.image_url)).status).toBe(404);
    expect((await media(route.thumb_url)).status).toBe(404);
    expect(await (await api(`/routes?author_id=${author.user.id}`)).json()).toEqual([]);
  });

  it('hides unpublished and unknown routes', async () => {
    const route = await publish(await signIn());
    await hideInDb(route);
    expect((await api(`/routes/${route.id}`)).status).toBe(404);
    expect((await media(route.image_url)).status).toBe(404);
    expect((await api('/routes/unknown')).status).toBe(404);
    expect((await media('/media/unknown/thumb')).status).toBe(404);
  });
});

describe('removing a route', () => {
  const remove = (id: string, token?: string) => api(`/routes/${id}`, { method: 'DELETE', token });

  it('lets the author take down their own route', async () => {
    const [author, reporter] = [await signIn(), await signIn()];
    const route = await publish(author);
    const report = await api('/reports', {
      token: reporter.token,
      json: { target_type: 'route', target_id: route.id, reason: 'spam' },
    });
    const { id: reportId } = await report.json<{ id: string }>();

    expect((await remove(route.id, author.token)).status).toBe(204);

    expect((await api(`/routes/${route.id}`)).status).toBe(404);
    expect((await media(route.image_url)).status).toBe(404);
    expect((await media(route.thumb_url)).status).toBe(404);
    const stored = await env.DB.prepare('SELECT status, image, thumb FROM routes WHERE id = ?')
      .bind(route.id)
      .first();
    expect(stored).toEqual({ status: 'hidden', image: null, thumb: null });
    const resolved = await env.DB.prepare('SELECT status, resolved_by FROM reports WHERE id = ?')
      .bind(reportId)
      .first();
    expect(resolved).toEqual({ status: 'resolved', resolved_by: author.user.id });
    expect((await remove(route.id, author.token)).status).toBe(404);
  });

  it("lets an administrator remove anyone's route", async () => {
    const moderator = await signIn({ admin: true });
    const route = await publish(await signIn());
    expect((await remove(route.id, moderator.token)).status).toBe(204);
    expect((await api(`/routes/${route.id}`)).status).toBe(404);
  });

  it('refuses everyone else', async () => {
    const [author, stranger] = [await signIn(), await signIn()];
    const route = await publish(author);

    expect((await remove(route.id, stranger.token)).status).toBe(403);
    expect((await remove(route.id)).status).toBe(401);
    expect((await remove('unknown', author.token)).status).toBe(404);
    expect((await api(`/routes/${route.id}`)).status).toBe(200);
    expect((await media(route.thumb_url)).status).toBe(200);
  });

  it('frees the photo quota but not the daily quota', async () => {
    const author = await signIn();
    for (let i = 0; i < 3; i++) {
      expect((await remove((await publish(author)).id, author.token)).status).toBe(204);
    }
    expect(await count('SELECT COUNT(*) AS n FROM routes WHERE image IS NOT NULL')).toBe(0);
    expect((await publishResponse(author)).status).toBe(429);
  });
});

describe('likes', () => {
  it('likes and unlikes idempotently', async () => {
    const [author, fan] = [await signIn(), await signIn()];
    const route = await publish(author);
    const toggle = async (user: typeof fan, liked: boolean) => {
      const response = await like(user, route.id, liked);
      expect(response.status).toBe(200);
      return response.json<LikeResponse>();
    };

    expect(await toggle(fan, true)).toEqual({ liked: true, likes: 1 });
    expect(await toggle(fan, true)).toEqual({ liked: true, likes: 1 });
    expect(await toggle(author, true)).toEqual({ liked: true, likes: 2 });
    expect(await toggle(fan, false)).toEqual({ liked: false, likes: 1 });
    expect(await toggle(fan, false)).toEqual({ liked: false, likes: 1 });
  });

  it('needs a session and a visible route', async () => {
    const user = await signIn();
    const route = await publish(user);
    expect((await api(`/routes/${route.id}/like`, { method: 'PUT' })).status).toBe(401);
    for (const liked of [true, false]) {
      expect((await like(user, 'unknown', liked)).status, String(liked)).toBe(404);
    }
  });

  it('ignores likes from disabled accounts', async () => {
    const [author, fan] = [await signIn(), await signIn()];
    const route = await publish(author);
    await like(fan, route.id);
    await disable(fan);
    expect((await (await api(`/routes/${route.id}`)).json<Route>()).likes).toBe(0);
  });
});
