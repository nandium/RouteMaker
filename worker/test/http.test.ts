import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { firebase } from './fake-firebase';
import { ORIGIN, detail, routeForm, signIn } from './helpers';

/** POST a body as a stream, so no Content-Length is sent. */
function streamed(path: string, type: string, bytes: Uint8Array, token?: string) {
  const headers = new Headers({ 'content-type': type });
  if (token) headers.set('authorization', `Bearer ${token}`);
  return exports.default.fetch(
    new Request(`${ORIGIN}/api${path}`, {
      method: 'POST',
      headers,
      duplex: 'half',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    } as RequestInit)
  );
}

const post = (path: string, type: string | undefined, body: string) =>
  exports.default.fetch(`${ORIGIN}/api${path}`, {
    method: 'POST',
    headers: type ? { 'content-type': type } : {},
    body,
  });

describe('JSON bodies', () => {
  it('are only accepted with a JSON content type, which a cross-site form cannot send', async () => {
    for (const path of ['/auth/signup', '/auth/login', '/auth/forgot']) {
      for (const type of [
        'text/plain',
        'application/x-www-form-urlencoded',
        'multipart/form-data; boundary=x',
        undefined,
      ]) {
        const response = await post(path, type, '{"email":"a@example.com","password":"climb1234"}');
        expect(response.status, `${path} ${type}`).toBe(415);
      }
    }
    expect(firebase.calls).toEqual([]);
    const withCharset = await post(
      '/auth/forgot',
      'Application/JSON; charset=utf-8',
      '{"email":"a@example.com"}'
    );
    expect(withCharset.status).toBe(200);
  });

  it('must parse to an object', async () => {
    for (const body of ['{', '[]', 'null', '"text"', '7', '']) {
      const response = await post('/auth/signup', 'application/json', body);
      expect(response.status, body).toBe(400);
    }
  });

  it('are capped by the bytes received', async () => {
    const huge = new TextEncoder().encode(JSON.stringify({ email: 'x'.repeat(70_000) }));
    expect((await streamed('/auth/signup', 'application/json', huge)).status).toBe(413);
  });
});

describe('multipart bodies', () => {
  it('are capped by the bytes received', async () => {
    const user = await signIn();
    const encoded = new Request(ORIGIN, { method: 'POST', body: routeForm() });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const padded = new Uint8Array(bytes.length + 800 * 1024);
    padded.set(bytes);
    const type = encoded.headers.get('content-type')!;
    expect((await streamed('/routes', type, padded, user.token)).status).toBe(413);
    expect((await streamed('/routes', type, bytes, user.token)).status).toBe(201);
  });

  it('that are malformed are refused like malformed JSON', async () => {
    const user = await signIn();
    const multipart = await streamed(
      '/routes',
      'multipart/form-data; boundary=missing',
      new TextEncoder().encode('not multipart'),
      user.token
    );
    const json = await post('/auth/signup', 'application/json', '{');
    expect(multipart.status).toBe(400);
    expect(json.status).toBe(400);
    expect(await detail(multipart)).toMatch(/multipart/);
    expect(await detail(json)).toMatch(/JSON/);
  });
});
