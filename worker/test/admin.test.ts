import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { AscentNote, Gym, Report, User } from '../../app/src/client-contract';
import {
  PASSWORD,
  api,
  hideInDb,
  like,
  logAscent,
  media,
  publish,
  report,
  signIn,
} from './helpers';

const admin = () => signIn({ admin: true });

const ADMIN_ENDPOINTS: [string, string, unknown?][] = [
  ['GET', '/admin/reports'],
  ['PUT', '/admin/reports/any', { decision: 'dismiss' }],
  ['GET', '/admin/gyms'],
  ['PUT', '/admin/gyms/any', { decision: 'approve' }],
  ['GET', '/admin/users'],
  ['PUT', '/admin/users/any', { disabled: true }],
];

describe('authorization', () => {
  it('requires an administrator session on every endpoint', async () => {
    const user = await signIn();
    for (const [method, path, json] of ADMIN_ENDPOINTS) {
      const anonymous = await api(path, { method, json });
      expect(anonymous.status, `${method} ${path} anonymous`).toBe(401);
      const regular = await api(path, { method, json, token: user.token });
      expect(regular.status, `${method} ${path} user`).toBe(403);
    }
  });

  it('stops honoring a demoted administrator immediately', async () => {
    const moderator = await admin();
    expect((await api('/admin/users', { token: moderator.token })).status).toBe(200);
    await env.DB.prepare("UPDATE users SET role='user' WHERE id=?").bind(moderator.user.id).run();
    expect((await api('/admin/users', { token: moderator.token })).status).toBe(403);
  });
});

const decide = (moderator: { token: string }, id: string, decision: unknown) =>
  api(`/admin/reports/${id}`, {
    method: 'PUT',
    token: moderator.token,
    json: { decision },
  });

const openReports = async (moderator: { token: string }) =>
  (await api('/admin/reports', { token: moderator.token })).json<Report[]>();

describe('report moderation', () => {
  it('lists open reports with a label, reason and details', async () => {
    const moderator = await admin();
    const author = await signIn();
    const route = await publish(author, { name: 'Labelled route' });
    await logAscent(author, route.id, { sent: true, note: 'Labelled note' });
    const [note] = await (await api(`/routes/${route.id}/notes`)).json<AscentNote[]>();
    const ids = [
      await report(author, 'route', route.id, 'inaccurate', 'Wrong grade'),
      await report(author, 'ascent', note.id, 'offensive'),
      await report(author, 'user', author.user.id, 'other'),
    ];

    const open = await openReports(moderator);
    const reports = ids.map((id) => open.find((item) => item.id === id)!);
    expect(reports.map(({ id, ...rest }) => rest)).toEqual([
      {
        target_type: 'route',
        target_id: route.id,
        target_label: 'Labelled route',
        route_id: route.id,
        reason: 'inaccurate',
        details: 'Wrong grade',
      },
      {
        target_type: 'ascent',
        target_id: note.id,
        target_label: 'Labelled note',
        route_id: route.id,
        reason: 'offensive',
        details: null,
      },
      {
        target_type: 'user',
        target_id: author.user.id,
        target_label: author.user.username,
        route_id: null,
        reason: 'other',
        details: null,
      },
    ]);
  });

  it('lists the newest reports first', async () => {
    const moderator = await admin();
    const author = await signIn();
    const reporter = await signIn();
    const ids = [];
    for (const age of [300, 100, 200]) {
      const route = await publish(author);
      const id = await report(reporter, 'route', route.id);
      await env.DB.prepare('UPDATE reports SET created_at = created_at - ? WHERE id = ?')
        .bind(age, id)
        .run();
      ids.push(id);
    }

    const listed = (await openReports(moderator)).map((item) => item.id);
    expect(listed).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('hides a route, clears its photo and resolves every report about it', async () => {
    const moderator = await admin();
    const author = await signIn();
    const [first, second] = [await signIn(), await signIn()];
    const route = await publish(author);
    const firstId = await report(first, 'route', route.id);
    const secondId = await report(second, 'route', route.id);

    const response = await decide(moderator, firstId, 'hide');
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');

    expect((await api(`/routes/${route.id}`)).status).toBe(404);
    expect((await media(route.image_url)).status).toBe(404);
    expect((await media(route.thumb_url)).status).toBe(404);
    expect(
      await env.DB.prepare('SELECT image, thumb FROM routes WHERE id=?').bind(route.id).first()
    ).toEqual({ image: null, thumb: null });
    const open = (await openReports(moderator)).map((item) => item.id);
    expect(open).not.toContain(firstId);
    expect(open).not.toContain(secondId);
    expect((await decide(moderator, firstId, 'hide')).status).toBe(404);
  });

  it('resolves a report whose route is already gone', async () => {
    const moderator = await admin();
    const author = await signIn();
    const route = await publish(author);
    const id = await report(author, 'route', route.id);
    await hideInDb(route);
    expect((await decide(moderator, id, 'hide')).status).toBe(204);
    expect((await openReports(moderator)).map((item) => item.id)).not.toContain(id);
  });

  it('clears a reported note but keeps the send and grade', async () => {
    const moderator = await admin();
    const author = await signIn();
    const climber = await signIn();
    const route = await publish(author);
    await logAscent(climber, route.id, { sent: true, grade: 'V7', note: 'Rude' });
    const [note] = await (await api(`/routes/${route.id}/notes`)).json<AscentNote[]>();
    const id = await report(author, 'ascent', note.id);
    const duplicate = await report(climber, 'ascent', note.id);

    expect((await decide(moderator, id, 'hide')).status).toBe(204);
    expect(await (await api(`/routes/${route.id}/notes`)).json()).toEqual([]);
    expect(await (await api(`/routes/${route.id}`, { token: climber.token })).json()).toMatchObject(
      {
        sends: 1,
        public_grade: 'V7',
        my_ascent: { sent: true, grade: 'V7', note: null },
      }
    );
    const open = (await openReports(moderator)).map((item) => item.id);
    expect(open).not.toContain(id);
    expect(open).not.toContain(duplicate);
  });

  it('removes a reported route through the same path as its author', async () => {
    const moderator = await admin();
    const author = await signIn();
    const route = await publish(author);
    await like(author, route.id);
    const id = await report(author, 'route', route.id);

    expect((await decide(moderator, id, 'hide')).status).toBe(204);
    const stored = await env.DB.prepare('SELECT status, resolved_by FROM reports WHERE id=?')
      .bind(id)
      .first();
    expect(stored).toEqual({
      status: 'resolved',
      resolved_by: moderator.user.id,
    });
    expect((await api(`/routes/${route.id}`)).status).toBe(404);
  });

  it('disables a reported user, revoking sessions and hiding their routes', async () => {
    const moderator = await admin();
    const offender = await signIn();
    const route = await publish(offender);
    const id = await report(moderator, 'user', offender.user.id);

    expect((await decide(moderator, id, 'hide')).status).toBe(204);
    expect((await api('/me', { token: offender.token })).status).toBe(401);
    expect((await api(`/routes/${route.id}`)).status).toBe(404);
    expect((await media(route.image_url)).status).toBe(404);
    expect(
      await env.DB.prepare('SELECT image, thumb FROM routes WHERE id=?').bind(route.id).first()
    ).toEqual({ image: null, thumb: null });
    expect((await openReports(moderator)).map((item) => item.id)).not.toContain(id);
  });

  it('will not let an administrator disable themselves through a report', async () => {
    const moderator = await admin();
    const reporter = await signIn();
    const id = await report(reporter, 'user', moderator.user.id);
    expect((await decide(moderator, id, 'hide')).status).toBe(409);
    expect((await api('/me', { token: moderator.token })).status).toBe(200);
    expect((await openReports(moderator)).map((item) => item.id)).toContain(id);
  });

  it('dismisses a report without touching its target', async () => {
    const moderator = await admin();
    const author = await signIn();
    const route = await publish(author);
    const id = await report(author, 'route', route.id);

    expect((await decide(moderator, id, 'dismiss')).status).toBe(204);
    expect((await api(`/routes/${route.id}`)).status).toBe(200);
    expect((await decide(moderator, id, 'dismiss')).status).toBe(404);
  });

  it('rejects unknown reports and decisions', async () => {
    const moderator = await admin();
    const author = await signIn();
    const id = await report(author, 'user', author.user.id);
    for (const decision of ['delete', '', 1, null, undefined]) {
      expect((await decide(moderator, id, decision)).status, String(decision)).toBe(422);
    }
    expect((await decide(moderator, 'unknown', 'hide')).status).toBe(404);
  });
});

describe('gym moderation', () => {
  const request = async (user: { token: string }, name: string) => {
    const response = await api('/gyms', {
      token: user.token,
      json: {
        name,
        address: '1 Wall Street',
        country_code: 'SG',
        latitude: 1.3,
        longitude: 103.8,
      },
    });
    return (await response.json<{ id: string }>()).id;
  };
  const decideGym = (moderator: { token: string }, id: string, decision: unknown) =>
    api(`/admin/gyms/${id}`, {
      method: 'PUT',
      token: moderator.token,
      json: { decision },
    });
  const publicGyms = async () => (await api('/gyms')).json<Gym[]>();

  it('approves a pending gym into the public list', async () => {
    const moderator = await admin();
    const user = await signIn();
    const id = await request(user, 'Approved gym');

    const pending = await (await api('/admin/gyms', { token: moderator.token })).json<Gym[]>();
    expect(pending.find((gym) => gym.id === id)).toEqual({
      id,
      name: 'Approved gym',
      address: '1 Wall Street',
      country_code: 'SG',
      latitude: 1.3,
      longitude: 103.8,
      status: 'pending',
    });

    expect((await decideGym(moderator, id, 'approve')).status).toBe(204);
    expect((await publicGyms()).some((gym) => gym.id === id)).toBe(true);
    expect((await decideGym(moderator, id, 'approve')).status).toBe(404);
  });

  it('rejects a pending gym', async () => {
    const moderator = await admin();
    const id = await request(await signIn(), 'Rejected gym');
    expect((await decideGym(moderator, id, 'reject')).status).toBe(204);
    expect((await publicGyms()).some((gym) => gym.id === id)).toBe(false);
  });

  it('rejects unknown gyms and decisions', async () => {
    const moderator = await admin();
    const id = await request(await signIn(), 'Undecided gym');
    for (const decision of ['maybe', '', 1, undefined]) {
      expect((await decideGym(moderator, id, decision)).status, String(decision)).toBe(422);
    }
    expect((await decideGym(moderator, 'unknown', 'approve')).status).toBe(404);
  });
});

describe('user moderation', () => {
  const setDisabled = (moderator: { token: string }, id: string, disabled: unknown) =>
    api(`/admin/users/${id}`, {
      method: 'PUT',
      token: moderator.token,
      json: { disabled },
    });

  it('lists accounts', async () => {
    const moderator = await admin();
    const users = await (await api('/admin/users', { token: moderator.token })).json<User[]>();
    expect(users).toContainEqual(moderator.user);
  });

  it('disables and re-enables an account', async () => {
    const moderator = await admin();
    const user = await signIn();
    const route = await publish(user);

    expect((await setDisabled(moderator, user.user.id, true)).status).toBe(204);
    expect((await setDisabled(moderator, user.user.id, true)).status).toBe(204);
    expect((await api('/me', { token: user.token })).status).toBe(401);
    expect((await api(`/routes/${route.id}`)).status).toBe(404);
    const login = await api('/auth/login', {
      json: { email: user.user.email, password: PASSWORD },
    });
    expect(login.status).toBe(403);

    expect((await setDisabled(moderator, user.user.id, false)).status).toBe(204);
    expect((await setDisabled(moderator, user.user.id, false)).status).toBe(204);
    const relogin = await api('/auth/login', {
      json: { email: user.user.email, password: PASSWORD },
    });
    expect(relogin.status).toBe(200);
    // Disabling ended the old session for good: enabling does not revive it.
    expect((await api('/me', { token: user.token })).status).toBe(401);
    // The photo was deleted when the account was disabled, so the route stays hidden.
    expect((await api(`/routes/${route.id}`)).status).toBe(404);
  });

  it('validates the request and refuses self-disable', async () => {
    const moderator = await admin();
    const user = await signIn();
    for (const disabled of ['true', 1, null, undefined]) {
      expect((await setDisabled(moderator, user.user.id, disabled)).status, String(disabled)).toBe(
        422
      );
    }
    expect((await setDisabled(moderator, 'unknown', true)).status).toBe(404);
    expect((await setDisabled(moderator, 'unknown', false)).status).toBe(404);
    expect((await setDisabled(moderator, moderator.user.id, true)).status).toBe(409);
    expect((await api('/me', { token: moderator.token })).status).toBe(200);
  });

  it('can disable another administrator', async () => {
    const [first, second] = [await admin(), await admin()];
    expect((await setDisabled(first, second.user.id, true)).status).toBe(204);
    expect((await api('/me', { token: second.token })).status).toBe(401);
  });
});
