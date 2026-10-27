import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { AuthSession, HandoffCode } from '../../app/src/client-contract';
import { PASSWORD, api, count, flagDisabled, signIn } from './helpers';

const login = async (user: AuthSession) => {
  const response = await api('/auth/login', {
    json: { email: user.user.email, password: PASSWORD },
  });
  expect(response.status).toBe(200);
  return response.json<AuthSession>();
};
const works = async (token: string) => (await api('/me', { token })).status === 200;

describe('sessions', () => {
  it('keeps only the newest sessions per user', async () => {
    const first = await signIn();
    const tokens = [first.token];
    for (let i = 0; i < 5; i++) tokens.push((await login(first)).token);
    expect(await Promise.all(tokens.map(works))).toEqual([false, true, true, true, true, true]);
  });

  it('rejects expired and malformed tokens', async () => {
    const session = await signIn();
    expect(await works(session.token)).toBe(true);
    await env.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    expect(await works(session.token)).toBe(false);
    expect(await works('garbage')).toBe(false);
    expect((await api('/me')).status).toBe(401);
  });

  it('sweeps expired sessions on the next login', async () => {
    const session = await signIn();
    await env.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    await login(session);
    expect(await count('SELECT COUNT(*) AS n FROM sessions')).toBe(1);
  });
});

describe('signing out', () => {
  it('revokes the token, and tolerates a missing or unknown one', async () => {
    const session = await signIn();
    expect((await api('/auth/logout', { method: 'POST', token: session.token })).status).toBe(204);
    expect(await works(session.token)).toBe(false);
    expect((await api('/auth/logout', { method: 'POST', token: 'garbage' })).status).toBe(204);
    expect((await api('/auth/logout', { method: 'POST' })).status).toBe(204);
  });
});

const issue = async (session: AuthSession) => {
  const response = await api('/auth/handoff', { method: 'POST', token: session.token });
  expect(response.status).toBe(200);
  return (await response.json<HandoffCode>()).code;
};
const redeem = (code: unknown) => api('/auth/handoff/redeem', { json: { code } });
const liveCodes = (user: AuthSession) =>
  count(
    `SELECT COUNT(*) AS n FROM handoffs
     JOIN sessions ON sessions.token_hash = handoffs.session_hash WHERE sessions.user_id = ?`,
    user.user.id
  );

describe('issuing a hand-off code', () => {
  it('returns 256 random bits and stores only their hash', async () => {
    const native = await signIn();
    const code = await issue(native);
    expect(code).toMatch(/^[0-9a-f]{64}$/);
    expect(await issue(native)).not.toBe(code);

    const stored = await env.DB.prepare('SELECT code_hash, expires_at FROM handoffs').all<{
      code_hash: string;
      expires_at: number;
    }>();
    expect(stored.results).toHaveLength(1);
    expect(stored.results[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.results[0].code_hash).not.toBe(code);
    const ttl = stored.results[0].expires_at - Date.now() / 1000;
    expect(ttl).toBeGreaterThan(110);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('needs a valid session', async () => {
    expect((await api('/auth/handoff', { method: 'POST' })).status).toBe(401);
    expect((await api('/auth/handoff', { method: 'POST', token: 'garbage' })).status).toBe(401);
  });

  it('keeps one live code per issuing session', async () => {
    const native = await signIn();
    const first = await issue(native);
    const second = await issue(native);
    expect((await redeem(first)).status).toBe(401);
    expect((await redeem(second)).status).toBe(200);
  });

  it('sweeps expired codes of other sessions', async () => {
    const [a, b] = [await signIn(), await signIn()];
    await issue(a);
    await env.DB.prepare('UPDATE handoffs SET expires_at = 1').run();
    await issue(b);
    expect(await liveCodes(a)).toBe(0);
  });
});

describe('redeeming a hand-off code', () => {
  it('opens a separate session for the same user', async () => {
    const native = await signIn();
    const response = await redeem(await issue(native));
    expect(response.status).toBe(200);
    const web = await response.json<AuthSession>();

    expect(web.user).toEqual(native.user);
    expect(web.token).not.toBe(native.token);
    expect(web.token).toMatch(/^[0-9a-f]{64}$/);
    expect(await works(web.token)).toBe(true);
    expect(await works(native.token)).toBe(true);

    // Signing out of the browser leaves the app signed in.
    await api('/auth/logout', { method: 'POST', token: web.token });
    expect(await works(web.token)).toBe(false);
    expect(await works(native.token)).toBe(true);
  });

  it('works exactly once', async () => {
    const native = await signIn();
    const code = await issue(native);
    expect((await redeem(code)).status).toBe(200);
    expect((await redeem(code)).status).toBe(401);
  });

  it('works for only one of several simultaneous attempts', async () => {
    const native = await signIn();
    const code = await issue(native);
    const statuses = (await Promise.all(Array.from({ length: 6 }, () => redeem(code)))).map(
      (response) => response.status
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(
      await count('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', native.user.id)
    ).toBe(2);
  });

  it('expires after two minutes and burns the expired code', async () => {
    const native = await signIn();
    const code = await issue(native);
    await env.DB.prepare('UPDATE handoffs SET expires_at = ?')
      .bind(Math.floor(Date.now() / 1000) - 1)
      .run();
    expect((await redeem(code)).status).toBe(401);
    expect(await liveCodes(native)).toBe(0);
  });

  it('rejects forged, foreign and malformed codes', async () => {
    const native = await signIn();
    await issue(native);
    expect((await redeem('ab'.repeat(32))).status).toBe(401);
    // A stored hash is not a code: it must not redeem itself.
    const hash = await env.DB.prepare('SELECT code_hash FROM handoffs').first<string>('code_hash');
    expect((await redeem(hash)).status).toBe(401);

    const malformed = ['', 'abc', 'AB'.repeat(32), 'g'.repeat(64), 'a'.repeat(65), 5, null, []];
    for (const code of malformed) expect((await redeem(code)).status, String(code)).toBe(422);
    expect((await api('/auth/handoff/redeem', { json: {} })).status).toBe(422);
    expect(await liveCodes(native)).toBe(1);
  });

  it('does not need, and ignores, a bearer token', async () => {
    const [owner, other] = [await signIn(), await signIn()];
    const code = await issue(owner);
    const response = await api('/auth/handoff/redeem', { token: other.token, json: { code } });
    expect((await response.json<AuthSession>()).user.id).toBe(owner.user.id);
  });

  it('dies with the issuing session', async () => {
    const native = await signIn();
    const code = await issue(native);
    await api('/auth/logout', { method: 'POST', token: native.token });
    expect((await redeem(code)).status).toBe(401);
    expect(await count('SELECT COUNT(*) AS n FROM handoffs')).toBe(0);
  });

  it('is refused for a disabled account', async () => {
    const native = await signIn();
    const code = await issue(native);
    await flagDisabled(native);
    expect((await redeem(code)).status).toBe(401);
  });

  it('never evicts the issuing session when it is the oldest at the cap', async () => {
    const native = await signIn();
    const others = [];
    for (let i = 0; i < 4; i++) others.push(await login(native));
    // Five sessions, the app's the oldest: a plain login would evict it.
    const web = await (await redeem(await issue(native))).json<AuthSession>();

    expect(await works(native.token)).toBe(true);
    expect(await works(web.token)).toBe(true);
    for (const session of others) expect(await works(session.token)).toBe(true);
  });
});
