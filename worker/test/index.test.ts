import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { API_PATHS } from '../../app/src/client-contract';
import { ORIGIN, api, detail, media, publish, signIn } from './helpers';

describe('routing', () => {
  it('reports health', async () => {
    const response = await api('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('answers an unknown path with a JSON 404', async () => {
    for (const path of ['/nope', '/routes/a/b/c', '/routes/x/ascent/y']) {
      const response = await api(path);
      expect(response.status, path).toBe(404);
      expect(await detail(response)).toBe('Not found');
    }
    expect((await exports.default.fetch(`${ORIGIN}/elsewhere`)).status).toBe(404);
  });

  it('answers a known path with the wrong method with a 405 listing the right ones', async () => {
    const cases: [string, string, string][] = [
      ['POST', '/health', 'GET'],
      ['PUT', '/me', 'GET, PATCH'],
      ['GET', '/auth/login', 'POST'],
      ['PATCH', '/routes/x/ascent', 'PUT, DELETE'],
      ['POST', '/users/x/follow', 'PUT, DELETE'],
    ];
    for (const [method, path, allow] of cases) {
      const response = await api(path, { method });
      expect(response.status, `${method} ${path}`).toBe(405);
      expect(response.headers.get('allow'), `${method} ${path}`).toBe(allow);
    }
  });

  it('never lets personal or changing API responses be cached', async () => {
    const user = await signIn();
    for (const response of [
      await api('/health'),
      await api('/routes'),
      await api('/me', { token: user.token }),
      await api('/me'),
      await api('/nope'),
    ]) {
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('hardens every API and image response, and only those', async () => {
    const route = await publish(await signIn());
    const hardened = {
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-origin',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'strict-transport-security': 'max-age=31536000',
    };
    const responses = [
      await api('/health'),
      await api('/me'),
      await api('/nope'),
      await api('/health', { method: 'POST' }),
      await api('/auth/logout', { method: 'POST' }),
      await media(route.image_url),
      await media(route.thumb_url),
      await media('/media/unknown'),
    ];
    for (const response of responses) {
      const headers = Object.keys(hardened).map((name) => [name, response.headers.get(name)]);
      expect(Object.fromEntries(headers)).toEqual(hardened);
    }
    // The page is not JSON: it keeps the headers of the site's own configuration.
    const page = await exports.default.fetch(`${ORIGIN}/routes/${route.id}`);
    expect(page.headers.get('content-security-policy')).toBeNull();
  });

  // A path or method the contract builds but the Worker lacks would fall through to the
  // router's own "Not found" (or "Method not allowed"): the two have drifted apart.
  it('has a handler for every endpoint in the client contract', async () => {
    const endpoints: [string, string][] = [
      ['GET', API_PATHS.gyms],
      ['GET', API_PATHS.location],
      ['GET', API_PATHS.places('abc', 1, 1)],
      ['GET', API_PATHS.routes],
      ['POST', API_PATHS.routes],
      ['GET', API_PATHS.route('x')],
      ['DELETE', API_PATHS.route('x')],
      ['PUT', API_PATHS.like('x')],
      ['DELETE', API_PATHS.like('x')],
      ['PUT', API_PATHS.ascent('x')],
      ['DELETE', API_PATHS.ascent('x')],
      ['GET', API_PATHS.notes('x')],
      ['POST', API_PATHS.gyms],
      ['POST', API_PATHS.auth.signup],
      ['POST', API_PATHS.auth.login],
      ['POST', API_PATHS.auth.logout],
      ['POST', API_PATHS.auth.forgot],
      ['POST', API_PATHS.auth.verify],
      ['POST', API_PATHS.auth.reset],
      ['POST', API_PATHS.auth.handoff],
      ['POST', API_PATHS.auth.redeemHandoff],
      ['GET', API_PATHS.me],
      ['PATCH', API_PATHS.me],
      ['POST', API_PATHS.deleteAccount],
      ['GET', API_PATHS.profile('x')],
      ['PUT', API_PATHS.follow('x')],
      ['DELETE', API_PATHS.follow('x')],
      ['POST', API_PATHS.report],
      ['GET', API_PATHS.admin.reports],
      ['PUT', API_PATHS.admin.report('x')],
      ['GET', API_PATHS.admin.gyms],
      ['PUT', API_PATHS.admin.gym('x')],
      ['GET', API_PATHS.admin.users],
      ['PUT', API_PATHS.admin.user('x')],
    ];
    for (const [method, path] of endpoints) {
      const response = await api(path, { method });
      const message = response.headers.get('content-type')?.includes('json')
        ? await detail(response).catch(() => '')
        : '';
      expect(response.status, `${method} ${path}`).not.toBe(405);
      expect(message, `${method} ${path}`).not.toBe('Not found');
    }
  });
});
