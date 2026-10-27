import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { AuthSession } from '../../app/src/client-contract';
import { firebase, resetCode, verifyCode } from './fake-firebase';
import { PASSWORD, api, count, flagDisabled, signIn, signupBody } from './helpers';

const login = (email: string, password = PASSWORD) =>
  api('/auth/login', { json: { email, password } });

describe('signup and login', () => {
  it('requires a verified email before a session is issued', async () => {
    const body = signupBody();
    const signup = await api('/auth/signup', { json: body });
    expect(signup.status).toBe(201);

    expect((await login(body.email)).status).toBe(403);
    expect((await login(body.email, 'wrong-password')).status).toBe(401);

    const verify = await api('/auth/verify', { json: { oob_code: verifyCode(body.email) } });
    expect(verify.status).toBe(200);

    const session = await (await login(body.email)).json<AuthSession>();
    expect(session.user).toMatchObject({
      email: body.email,
      username: body.username,
      role: 'user',
      disabled: false,
    });
    const me = await api('/me', { token: session.token });
    expect(await me.json()).toEqual(session.user);
  });

  it('normalizes the email and rejects invalid signup details', async () => {
    const invalid = [
      { email: 'not-an-email' },
      { password: 'short' },
      { username: 'no spaces' },
      { username: 'ab' },
      { display_name: '' },
      { display_name: 7 },
    ];
    for (const override of invalid) {
      const response = await api('/auth/signup', { json: { ...signupBody(), ...override } });
      expect(response.status, JSON.stringify(override)).toBe(422);
    }
    expect(firebase.calls).toEqual([]);

    const body = signupBody();
    const upper = { ...body, email: ` ${body.email.toUpperCase()} ` };
    expect((await api('/auth/signup', { json: upper })).status).toBe(201);
    expect(firebase.accounts.has(body.email)).toBe(true);
  });

  it('rejects a taken email or username without creating a Firebase account', async () => {
    const first = signupBody();
    await api('/auth/signup', { json: first });
    const calls = firebase.calls.length;

    const sameEmail = await api('/auth/signup', { json: { ...signupBody(), email: first.email } });
    expect(sameEmail.status).toBe(409);
    const other = signupBody();
    const sameUsername = await api('/auth/signup', {
      json: { ...other, username: first.username.toUpperCase() },
    });
    expect(sameUsername.status).toBe(409);

    expect(firebase.calls.length).toBe(calls);
    expect(firebase.accounts.has(other.email)).toBe(false);
  });

  it('undoes signup when it loses a race for the name', async () => {
    const body = signupBody();
    firebase.beforeNext('accounts:signUp', () =>
      env.DB.prepare(
        "INSERT INTO users(id, email, username, display_name, created_at) VALUES ('rival', 'rival@example.com', ?, 'Rival', 1)"
      )
        .bind(body.username)
        .run()
    );

    expect((await api('/auth/signup', { json: body })).status).toBe(409);
    expect(firebase.accounts.has(body.email)).toBe(false);
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE email = ?', body.email)).toBe(0);
  });

  it('rolls back the profile and Firebase account when the verification mail fails', async () => {
    const body = signupBody();
    firebase.failNext('accounts:sendOobCode', 'QUOTA_EXCEEDED');

    expect((await api('/auth/signup', { json: body })).status).toBe(503);
    expect(firebase.accounts.has(body.email)).toBe(false);
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE email = ?', body.email)).toBe(0);
  });

  it('refuses names that would pass for the site or its staff', async () => {
    const reserved = [
      'admin',
      'Administrator',
      'ROUTEMAKER',
      'support',
      'help',
      'Moderator',
      'mod',
      'staff',
      'Official',
      'root',
      'system',
      'security',
    ];
    for (const username of reserved) {
      const response = await api('/auth/signup', { json: { ...signupBody(), username } });
      expect(response.status, username).toBe(422);
    }
    expect(firebase.calls).toEqual([]);
    for (const username of ['admin1', 'mod_squad', 'the-root']) {
      const response = await api('/auth/signup', { json: { ...signupBody(), username } });
      expect(response.status, username).toBe(201);
    }
  });

  it('marks the account verified at its first login, not before', async () => {
    const body = signupBody();
    await api('/auth/signup', { json: body });
    const verified = () =>
      env.DB.prepare('SELECT verified FROM users WHERE email = ?')
        .bind(body.email)
        .first('verified');
    expect(await verified()).toBe(0);

    expect((await login(body.email)).status).toBe(403);
    expect(await verified()).toBe(0);

    firebase.verify(body.email);
    expect((await login(body.email)).status).toBe(200);
    expect(await verified()).toBe(1);
    expect((await login(body.email)).status).toBe(200);
    expect(await verified()).toBe(1);
  });

  it('rejects a malformed login without asking Firebase', async () => {
    for (const json of [
      {},
      { email: 'nope', password: PASSWORD },
      { email: 'a@b.co', password: 'x' },
    ]) {
      expect((await api('/auth/login', { json })).status, JSON.stringify(json)).toBe(422);
    }
    expect(firebase.calls).toEqual([]);
  });

  it('never grants the administrator role at signup', async () => {
    const body = { ...signupBody(), email: 'root@routemaker.test' };
    await api('/auth/signup', { json: body });
    firebase.verify(body.email);
    const session = await (await login(body.email)).json<AuthSession>();
    expect(session.user.role).toBe('user');
  });

  it('refuses a disabled account', async () => {
    const session = await signIn();
    await flagDisabled(session);
    expect((await login(session.user.email)).status).toBe(403);
    expect((await api('/me', { token: session.token })).status).toBe(401);
  });

  it('maps Firebase failures to useful statuses', async () => {
    const session = await signIn();
    const cases: [string, number][] = [
      ['TOO_MANY_ATTEMPTS_TRY_LATER : Access disabled', 429],
      ['USER_DISABLED', 403],
      ['OPERATION_NOT_ALLOWED', 503],
    ];
    for (const [message, status] of cases) {
      firebase.failNext('accounts:signInWithPassword', message);
      expect((await login(session.user.email)).status, message).toBe(status);
    }
  });
});

describe('password reset', () => {
  it('answers /auth/forgot the same for unknown accounts', async () => {
    const known = await signIn();
    const forgot = (email: string) => api('/auth/forgot', { json: { email } });
    const [a, b] = await Promise.all([forgot(known.user.email), forgot('nobody@example.com')]);
    expect(a.status).toBe(200);
    expect(await b.json()).toEqual(await a.json());
    expect((await forgot('not-an-email')).status).toBe(422);
  });

  it('revokes sessions only after the emailed code is used', async () => {
    const session = await signIn();
    const { email } = session.user;
    await api('/auth/forgot', { json: { email } });
    expect((await api('/me', { token: session.token })).status).toBe(200);

    const reset = await api('/auth/reset', {
      json: { oob_code: resetCode(email), password: 'new-climb-1234' },
    });
    expect(reset.status).toBe(200);
    expect((await api('/me', { token: session.token })).status).toBe(401);
    expect((await login(email)).status).toBe(401);
    expect((await login(email, 'new-climb-1234')).status).toBe(200);
  });

  it('rejects bad codes and passwords', async () => {
    const bad = await api('/auth/reset', {
      json: { oob_code: 'reset:nobody@example.com', password: PASSWORD },
    });
    expect(bad.status).toBe(422);
    expect((await api('/auth/verify', { json: { oob_code: 'junk' } })).status).toBe(422);
    const short = await api('/auth/reset', { json: { oob_code: 'reset:x', password: 'short' } });
    expect(short.status).toBe(422);
    expect((await api('/auth/verify', { json: {} })).status).toBe(422);
  });

  it('reports a weak password as such, not as an expired link', async () => {
    const { user } = await signIn();
    firebase.failNext(
      'accounts:resetPassword',
      'WEAK_PASSWORD : Password should be at least 6 characters'
    );
    const response = await api('/auth/reset', {
      json: { oob_code: resetCode(user.email), password: PASSWORD },
    });
    expect(response.status).toBe(422);
    expect((await response.json<{ detail: string }>()).detail).not.toMatch(/link/i);
  });
});
