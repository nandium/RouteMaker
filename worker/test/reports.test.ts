import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { REPORT_REASONS, type AscentNote } from '../../app/src/client-contract';
import {
  PASSWORD,
  api,
  count,
  hideInDb,
  logAscent,
  publish,
  report,
  reportResponse,
  seedRoutes,
  signIn,
  signUpOnly,
} from './helpers';
import { firebase } from './fake-firebase';

/** An author with a route and a noted ascent, and someone to report them. */
async function setup() {
  const [author, reporter] = [await signIn(), await signIn()];
  const route = await publish(author);
  await logAscent(author, route.id, { sent: true, note: 'Rude' });
  const [note] = await (await api(`/routes/${route.id}/notes`)).json<AscentNote[]>();
  return { author, reporter, route, note };
}

describe('filing a report', () => {
  it('accepts one report per target, with a reason and optional details', async () => {
    const { author, reporter, route, note } = await setup();
    const targets = [
      ['route', route.id],
      ['ascent', note.id],
      ['user', author.user.id],
    ] as const;
    for (const [type, targetId] of targets) {
      const first = await reportResponse(reporter, type, targetId, 'spam');
      expect(first.status, type).toBe(201);
      expect(await first.json()).toEqual({ id: expect.any(String) });
      expect(
        (await reportResponse(reporter, type, targetId, 'other')).status,
        `${type} again`
      ).toBe(409);
    }
    const stored = await env.DB.prepare('SELECT reason, details FROM reports WHERE target_id = ?')
      .bind(route.id)
      .first();
    expect(stored).toEqual({ reason: 'spam', details: null });
  });

  it('stores the details text, trimmed', async () => {
    const { reporter, route } = await setup();
    const id = await report(reporter, 'route', route.id, 'inaccurate', '  Wrong gym  ');
    const stored = await env.DB.prepare('SELECT details FROM reports WHERE id = ?')
      .bind(id)
      .first('details');
    expect(stored).toBe('Wrong gym');
  });

  it('accepts every published reason and nothing else', async () => {
    const { reporter, route } = await setup();
    for (const reason of REPORT_REASONS) {
      const other = await publish(await signIn());
      expect((await reportResponse(reporter, 'route', other.id, reason)).status, reason).toBe(201);
    }
    for (const reason of ['', 'rude', 'SPAM', 3, null]) {
      const response = await reportResponse(reporter, 'route', route.id, reason as string);
      expect(response.status, String(reason)).toBe(422);
    }
  });

  it('rejects unknown targets and invalid reports', async () => {
    const { reporter, route } = await setup();
    const send = (json: object) =>
      api('/reports', {
        token: reporter.token,
        json: { target_type: 'route', target_id: route.id, reason: 'spam', ...json },
      });
    expect((await send({ reason: undefined })).status).toBe(422);
    expect((await send({ target_id: 'unknown' })).status).toBe(404);
    expect((await send({ target_type: 'user', target_id: 'unknown' })).status).toBe(404);
    expect((await send({ target_type: 'ascent', target_id: 'unknown' })).status).toBe(404);
    expect((await send({ target_type: 'comment' })).status).toBe(422);
    expect((await send({ target_id: 5 })).status).toBe(422);
    expect((await send({ details: 5 })).status).toBe(422);
    expect((await send({ details: 'x'.repeat(501) })).status).toBe(422);
    expect((await send({ details: '😀'.repeat(500) })).status).toBe(201);
    const anonymous = await api('/reports', {
      json: { target_type: 'route', target_id: route.id, reason: 'spam' },
    });
    expect(anonymous.status).toBe(401);
  });

  it('does not accept reports about hidden content or empty notes', async () => {
    const { author, reporter, route, note } = await setup();
    await logAscent(author, route.id, { sent: true });
    expect((await reportResponse(reporter, 'ascent', note.id)).status).toBe(404);

    await hideInDb(route);
    expect((await reportResponse(reporter, 'route', route.id)).status).toBe(404);
  });
});

describe('the open reports of one reporter', () => {
  /** Ids of `n` visible routes to report, written by someone else. */
  async function routesToReport(n: number) {
    const author = await signIn();
    await seedRoutes(author.user.id, n);
    const rows = await env.DB.prepare('SELECT id FROM routes ORDER BY name').all<{ id: string }>();
    return rows.results.map((row) => row.id);
  }

  it('are capped at twenty, and resolved ones stop counting', async () => {
    const reporter = await signIn();
    const routes = await routesToReport(22);
    for (const id of routes.slice(0, 20)) {
      expect((await reportResponse(reporter, 'route', id)).status).toBe(201);
    }

    const refused = await reportResponse(reporter, 'route', routes[20]);
    expect(refused.status).toBe(429);
    expect((await refused.json<{ detail: string }>()).detail).toMatch(/too many open reports/i);

    await env.DB.prepare("UPDATE reports SET status = 'dismissed' WHERE target_id = ?")
      .bind(routes[0])
      .run();
    expect((await reportResponse(reporter, 'route', routes[20])).status).toBe(201);
    expect((await reportResponse(reporter, 'route', routes[21])).status).toBe(429);
    // Another reporter has their own allowance.
    expect((await reportResponse(await signIn(), 'route', routes[21])).status).toBe(201);
  });

  it('stay capped when filed at the same moment', async () => {
    const reporter = await signIn();
    const routes = await routesToReport(30);
    const responses = await Promise.all(routes.map((id) => reportResponse(reporter, 'route', id)));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(20);
    expect(statuses.filter((status) => status === 429)).toHaveLength(10);
    expect(await count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'")).toBe(20);
  });
});

describe('reporting an account whose email is not verified yet', () => {
  it('finds nothing until its first login', async () => {
    const newcomer = await signUpOnly();
    const reporter = await signIn();
    expect((await reportResponse(reporter, 'user', newcomer.id)).status).toBe(404);

    firebase.verify(newcomer.email);
    await api('/auth/login', { json: { email: newcomer.email, password: PASSWORD } });
    expect((await reportResponse(reporter, 'user', newcomer.id)).status).toBe(201);
  });
});
