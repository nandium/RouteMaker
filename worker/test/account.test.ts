import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { AuthSession, Route, User } from '../../app/src/client-contract';
import { firebase } from './fake-firebase';
import {
  PASSWORD,
  api,
  count,
  flagDisabled,
  follow,
  like,
  logAscent,
  publish,
  report,
  signIn,
} from './helpers';

const destroy = (token?: string, password: unknown = PASSWORD) =>
  api('/me/delete', { token, json: { password } });
const exists = async (table: string, column: string, value: string) =>
  (await count(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, value)) > 0;

/** A leaver and a friend who have interacted in every way an account can. */
async function scenario() {
  const [leaver, friend] = [await signIn(), await signIn()];
  const mine = await publish(leaver, { name: 'Mine' });
  const theirs = await publish(friend, { name: 'Theirs' });
  // The leaver's activity on the friend's route and profile.
  await like(leaver, theirs.id);
  await logAscent(leaver, theirs.id, { sent: true, note: 'Mine to lose' });
  await follow(leaver, friend.user.id);
  // The friend's activity on the leaver's route and profile.
  await like(friend, mine.id);
  await logAscent(friend, mine.id, { sent: true, note: 'Nice' });
  await follow(friend, leaver.user.id);

  const pendingGym = await (
    await api('/gyms', {
      token: leaver.token,
      json: {
        name: 'Pending gym',
        address: '1 Road',
        country_code: 'SG',
        latitude: 1,
        longitude: 1,
      },
    })
  ).json<{ id: string }>();
  await env.DB.prepare(
    "INSERT INTO gyms(id, country_code, name, address, latitude, longitude, status, requested_by, created_at) VALUES ('kept-gym', 'SG', 'Kept', '1 Road', 1, 1, 'approved', ?, 1)"
  )
    .bind(leaver.user.id)
    .run();

  const notes = async (route: Route) =>
    (await (await api(`/routes/${route.id}/notes`)).json<{ id: string }[]>())[0].id;
  const reports = {
    filed: await report(leaver, 'route', theirs.id),
    aboutOthers: await report(friend, 'route', theirs.id),
    aboutRoute: await report(friend, 'route', mine.id),
    aboutUser: await report(friend, 'user', leaver.user.id),
    aboutOwnNote: await report(friend, 'ascent', await notes(theirs)),
    aboutNoteOnRoute: await report(leaver, 'ascent', await notes(mine)),
  };
  return { leaver, friend, mine, theirs, pendingGym: pendingGym.id, reports };
}

describe('the signed-in profile', () => {
  it('reads and updates the display name, trimmed', async () => {
    const { token, user } = await signIn();
    expect(await (await api('/me', { token })).json()).toEqual(user);

    const response = await api('/me', {
      method: 'PATCH',
      token,
      json: { display_name: '  New name  ' },
    });
    expect(response.status).toBe(200);
    expect((await response.json<User>()).display_name).toBe('New name');
    expect((await (await api('/me', { token })).json<User>()).display_name).toBe('New name');
  });

  it('rejects an invalid display name and a missing session', async () => {
    const { token } = await signIn();
    for (const display_name of ['', '   ', 5, 'x'.repeat(51)]) {
      const response = await api('/me', { method: 'PATCH', token, json: { display_name } });
      expect(response.status, String(display_name)).toBe(422);
    }
    expect((await api('/me')).status).toBe(401);
    expect((await api('/me', { token: 'garbage' })).status).toBe(401);
  });
});

describe('deleting an account', () => {
  it('ends the account, its Firebase identity and its sessions', async () => {
    const { leaver } = await scenario();
    const second = await (
      await api('/auth/login', { json: { email: leaver.user.email, password: PASSWORD } })
    ).json<AuthSession>();

    expect((await destroy(leaver.token)).status).toBe(204);

    expect(firebase.accounts.has(leaver.user.email)).toBe(false);
    expect(firebase.calls.slice(-2)).toEqual(['accounts:signInWithPassword', 'accounts:delete']);
    expect((await api('/me', { token: leaver.token })).status).toBe(401);
    expect((await api('/me', { token: second.token })).status).toBe(401);
    expect(await exists('users', 'id', leaver.user.id)).toBe(false);
    expect(await exists('sessions', 'user_id', leaver.user.id)).toBe(false);
  });

  it('deletes their routes, photos, and what others did on them', async () => {
    const { leaver, mine } = await scenario();
    await destroy(leaver.token);

    expect((await api(`/routes/${mine.id}`)).status).toBe(404);
    expect(await exists('routes', 'id', mine.id)).toBe(false);
    expect(await exists('likes', 'route_id', mine.id)).toBe(false);
    expect(await exists('ascents', 'route_id', mine.id)).toBe(false);
  });

  it('deletes their activity on other climbers’ content', async () => {
    const { leaver, theirs } = await scenario();
    await destroy(leaver.token);

    expect(await exists('likes', 'user_id', leaver.user.id)).toBe(false);
    expect(await exists('ascents', 'user_id', leaver.user.id)).toBe(false);
    expect(await exists('follows', 'follower_id', leaver.user.id)).toBe(false);
    expect(await exists('follows', 'followed_id', leaver.user.id)).toBe(false);
    expect(await (await api(`/routes/${theirs.id}`)).json()).toMatchObject({ likes: 0, sends: 0 });
  });

  it('removes pending gym requests and keeps approved ones', async () => {
    const { leaver, pendingGym } = await scenario();
    await destroy(leaver.token);

    expect(await exists('gyms', 'id', pendingGym)).toBe(false);
    const kept = await env.DB.prepare(
      "SELECT requested_by FROM gyms WHERE id = 'kept-gym'"
    ).first();
    expect(kept).toEqual({ requested_by: null });
  });

  it('keeps the reports they filed, anonymized, and drops reports about what is deleted', async () => {
    const { leaver, reports } = await scenario();
    await destroy(leaver.token);

    const filed = await env.DB.prepare('SELECT reporter_id, status FROM reports WHERE id = ?')
      .bind(reports.filed)
      .first();
    expect(filed).toEqual({ reporter_id: null, status: 'open' });
    expect(await exists('reports', 'id', reports.aboutOthers)).toBe(true);
    for (const id of [
      reports.aboutRoute,
      reports.aboutUser,
      reports.aboutOwnNote,
      reports.aboutNoteOnRoute,
    ])
      expect(await exists('reports', 'id', id)).toBe(false);
  });

  it('leaves other accounts untouched', async () => {
    const { leaver, friend, theirs } = await scenario();
    await destroy(leaver.token);

    expect(await exists('users', 'id', friend.user.id)).toBe(true);
    expect((await api(`/routes/${theirs.id}`)).status).toBe(200);
    const login = await api('/auth/login', {
      json: { email: friend.user.email, password: PASSWORD },
    });
    expect(login.status).toBe(200);
  });

  it('keeps the account when the password is wrong', async () => {
    const user = await signIn();
    const route = await publish(user);

    expect((await destroy(user.token, 'not-my-password')).status).toBe(403);
    expect(firebase.accounts.has(user.user.email)).toBe(true);
    expect((await api('/me', { token: user.token })).status).toBe(200);
    expect((await api(`/routes/${route.id}`)).status).toBe(200);
  });

  it('tells a wrong password (403) from an expired session (401)', async () => {
    const user = await signIn();
    expect((await destroy(user.token, 'not-my-password')).status).toBe(403);
    await env.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    expect((await destroy(user.token)).status).toBe(401);
  });

  it("will not accept another account's password with this session", async () => {
    const [victim, attacker] = [await signIn(), await signIn()];
    firebase.accounts.get(attacker.user.email)!.password = 'attacker-secret-1';

    expect((await destroy(victim.token, 'attacker-secret-1')).status).toBe(403);
    expect(await exists('users', 'id', victim.user.id)).toBe(true);
  });

  it("refuses a Firebase identity that is not this account's", async () => {
    const user = await signIn();
    firebase.accounts.get(user.user.email)!.localId = 'someone-else';
    const calls = firebase.calls.length;

    expect((await destroy(user.token)).status).toBe(403);
    expect(firebase.calls.slice(calls)).toEqual(['accounts:signInWithPassword']);
    expect(await exists('users', 'id', user.user.id)).toBe(true);
  });

  it('needs a session and a valid password', async () => {
    const user = await signIn();
    const calls = firebase.calls.length;
    expect((await destroy()).status).toBe(401);
    expect((await destroy('garbage')).status).toBe(401);
    for (const password of ['', 'short', 12345678, null, 'x'.repeat(129)]) {
      expect((await destroy(user.token, password)).status, String(password)).toBe(422);
    }
    expect((await api('/me/delete', { method: 'POST', token: user.token })).status).toBe(415);
    expect(firebase.calls.length).toBe(calls);
    expect(await exists('users', 'id', user.user.id)).toBe(true);
  });

  it('deletes nothing when Firebase is throttled', async () => {
    const user = await signIn();
    firebase.failNext('accounts:signInWithPassword', 'TOO_MANY_ATTEMPTS_TRY_LATER : slow down');
    expect((await destroy(user.token)).status).toBe(429);
    expect(await exists('users', 'id', user.user.id)).toBe(true);
  });

  it('deletes nothing when Firebase fails to delete', async () => {
    const user = await signIn();
    const route = await publish(user);
    firebase.failNext('accounts:delete', 'OPERATION_NOT_ALLOWED');
    expect((await destroy(user.token)).status).toBe(503);
    expect(await exists('users', 'id', user.user.id)).toBe(true);
    expect((await api(`/routes/${route.id}`)).status).toBe(200);
  });
});

describe('deleting an administrator account', () => {
  it('is refused for the last active administrator', async () => {
    const sole = await signIn({ admin: true });
    const calls = firebase.calls.length;

    expect((await destroy(sole.token)).status).toBe(409);
    expect(firebase.calls.length).toBe(calls);
    expect(firebase.accounts.has(sole.user.email)).toBe(true);
    expect((await api('/me', { token: sole.token })).status).toBe(200);
  });

  it('is allowed while another administrator is active', async () => {
    const [first, second] = [await signIn({ admin: true }), await signIn({ admin: true })];
    expect((await destroy(first.token)).status).toBe(204);
    expect((await destroy(second.token)).status).toBe(409);
  });

  it('does not count a disabled administrator as a spare', async () => {
    const [active, disabled] = [await signIn({ admin: true }), await signIn({ admin: true })];
    await flagDisabled(disabled);
    expect((await destroy(active.token)).status).toBe(409);
  });
});
