import { expect, test, vi } from 'vitest';

import { ApiError, errorMessage, fetchJson } from '../http.js';

const respond = (status: number, body?: unknown, parses = true) =>
  vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (!parses) throw new SyntaxError('Unexpected token <');
      return body;
    },
  }));

test('sends a bearer token and a JSON body', async () => {
  const fetcher = respond(200, { ok: true });

  await fetchJson(fetcher, '/api/x', { method: 'POST', token: 'abc', json: { a: 1 } });

  expect(fetcher).toHaveBeenCalledWith('/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc' },
    body: '{"a":1}',
  });
});

test('sends no credentials or content type for plain reads', async () => {
  const fetcher = respond(200, []);

  await fetchJson(fetcher, '/api/x');

  expect(fetcher).toHaveBeenCalledWith('/api/x', { headers: {} });
});

test('passes a non-JSON body through untouched', async () => {
  const fetcher = respond(200, {});
  const body = new FormData();

  await fetchJson(fetcher, '/api/x', { method: 'POST', body });

  expect(fetcher.mock.calls[0][1]).toMatchObject({ body, headers: {} });
});

test('resolves 204 without reading a body', async () => {
  const fetcher = respond(204, undefined, false);

  await expect(fetchJson(fetcher, '/api/x')).resolves.toBeUndefined();
});

test('resolves a literal null body', async () => {
  await expect(fetchJson(respond(200, null), '/api/x')).resolves.toBeNull();
});

test('rejects with the server detail and status', async () => {
  const error = await fetchJson(respond(409, { detail: 'Already taken' }), '/api/x').catch(
    (e) => e
  );

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ message: 'Already taken', status: 409 });
});

test('falls back to the status when the error body is not JSON', async () => {
  await expect(fetchJson(respond(502, undefined, false), '/api/x')).rejects.toMatchObject({
    message: 'Request failed (502)',
    status: 502,
  });
});

test('rejects a successful response that is not JSON', async () => {
  await expect(fetchJson(respond(200, undefined, false), '/api/x')).rejects.toMatchObject({
    message: 'Unexpected response',
  });
});

test('describes any thrown value', () => {
  expect(errorMessage(new Error('offline'))).toBe('offline');
  expect(errorMessage('boom')).toBe('Something went wrong');
});
