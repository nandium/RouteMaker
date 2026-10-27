import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { firebase } from './fake-firebase';
import { api, count, detail, signIn, signupBody } from './helpers';

const forgot = (email: string, ip?: string) => api('/auth/forgot', { json: { email }, ip });
const mailSent = () => firebase.calls.filter((call) => call === 'accounts:sendOobCode').length;

describe('mail to one address', () => {
  it('is limited to three an hour, counting signups and password resets together', async () => {
    const body = signupBody();
    expect((await api('/auth/signup', { json: body })).status).toBe(201);
    expect((await forgot(body.email)).status).toBe(200);
    expect((await forgot(body.email)).status).toBe(200);

    const refused = await forgot(body.email);
    expect(refused.status).toBe(429);
    expect(await detail(refused)).toBe('Too many attempts. Try again later.');
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(3500);
    expect(mailSent()).toBe(3);
    // The same address is refused for signup too, and in any letter case.
    expect((await api('/auth/signup', { json: body })).status).toBe(429);
    expect((await forgot(body.email.toUpperCase())).status).toBe(429);
    // Other addresses are unaffected.
    expect((await forgot('other@example.com')).status).toBe(200);
  });

  it('holds when requests arrive together', async () => {
    const responses = await Promise.all(
      Array.from({ length: 100 }, () => forgot('victim@example.com'))
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(97);
    expect(mailSent()).toBe(3);
  });

  it('starts over when the hour is up', async () => {
    for (let i = 0; i < 3; i++) await forgot('again@example.com');
    expect((await forgot('again@example.com')).status).toBe(429);

    await env.DB.prepare('UPDATE throttles SET window_start = window_start - 3601').run();

    expect((await forgot('again@example.com')).status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT count FROM throttles WHERE key = 'mail:again@example.com'"
    ).first<{ count: number }>();
    expect(row!.count).toBe(1);
  });

  it('is counted even when the signup is refused for another reason', async () => {
    const body = signupBody();
    await api('/auth/signup', { json: body });
    for (let i = 0; i < 2; i++) {
      expect((await api('/auth/signup', { json: body })).status).toBe(409);
    }
    expect((await api('/auth/signup', { json: body })).status).toBe(429);
  });
});

describe('attempts from one client address', () => {
  const ip = '203.0.113.7';

  it('are limited to twenty a minute across everything that signs in or proves a code', async () => {
    const attempts = [
      (n: number) =>
        api('/auth/login', { json: { email: `a${n}@example.com`, password: 'climb1234' }, ip }),
      (n: number) =>
        api('/auth/signup', { json: { email: `b${n}@example.com`, password: 'x' }, ip }),
      (n: number) => api('/auth/forgot', { json: { email: `c${n}@example.com` }, ip }),
      (n: number) => api('/auth/verify', { json: { oob_code: `verify:d${n}@example.com` }, ip }),
      (n: number) =>
        api('/auth/reset', {
          json: { oob_code: `reset:e${n}@example.com`, password: 'climb1234' },
          ip,
        }),
      (n: number) =>
        api('/auth/handoff/redeem', { json: { code: 'ab'.repeat(32) }, ip, token: `${n}` }),
    ];
    for (let n = 0; n < 20; n++) {
      const response = await attempts[n % attempts.length](n);
      expect(response.status, `attempt ${n}`).not.toBe(429);
    }
    for (const attempt of attempts) expect((await attempt(99)).status).toBe(429);

    // Another address, and requests with no address at all, are not affected.
    const other = await api('/auth/login', {
      json: { email: 'z@example.com', password: 'climb1234' },
      ip: '203.0.113.8',
    });
    expect(other.status).not.toBe(429);
    for (let n = 0; n < 25; n++) {
      const anonymous = await api('/auth/verify', {
        json: { oob_code: `verify:f${n}@example.com` },
      });
      expect(anonymous.status).not.toBe(429);
    }
  });

  it('are not limited for signed-in use', async () => {
    const user = await signIn();
    for (let n = 0; n < 25; n++) {
      expect((await api('/me', { token: user.token, ip })).status).toBe(200);
    }
  });

  it('counts a burst exactly', async () => {
    const responses = await Promise.all(
      Array.from({ length: 60 }, () =>
        api('/auth/login', { json: { email: 'a@example.com', password: 'climb1234' }, ip })
      )
    );
    const refused = responses.filter((response) => response.status === 429);
    expect(refused).toHaveLength(40);
    expect(firebase.calls.filter((call) => call === 'accounts:signInWithPassword')).toHaveLength(
      20
    );
  });
});

describe('place search', () => {
  const search = (ip: string) => api('/places?q=Singapore&lat=1.35&lon=103.8', { ip });

  it('is limited to thirty a minute per client, apart from sign-in attempts', async () => {
    const ip = '198.51.100.9';
    for (let n = 0; n < 30; n++) {
      // A provider outage is a 502; either way the attempt was let through.
      expect((await search(ip)).status, `search ${n}`).not.toBe(429);
    }
    expect((await search(ip)).status).toBe(429);
    expect((await search('198.51.100.10')).status).not.toBe(429);
    const login = await api('/auth/login', {
      json: { email: 'a@example.com', password: 'climb1234' },
      ip,
    });
    expect(login.status).not.toBe(429);
  });
});

describe('the counters', () => {
  it('are cleaned up once long past', async () => {
    await env.DB.prepare("INSERT INTO throttles(key, window_start, count) VALUES ('old', ?, 1)")
      .bind(Math.floor(Date.now() / 1000) - 2 * 86400)
      .run();
    await forgot('anyone@example.com');
    expect(await count("SELECT COUNT(*) AS n FROM throttles WHERE key = 'old'")).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM throttles')).toBe(1);
  });
});
