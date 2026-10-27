import { MAX_JSON_BYTES, MAX_UPLOAD_BYTES } from './limits';
import type { Env } from './env';

export type Params = Record<string, string>;
export type Handler = (req: Request, env: Env, params: Params) => Response | Promise<Response>;

const NO_STORE = { 'cache-control': 'no-store' };

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: NO_STORE });
/** Throw it: the router unwraps thrown Responses. */
export const fail = (status: number, detail: string) => json({ detail }, status);
export const noContent = () => new Response(null, { status: 204, headers: NO_STORE });

/** Content-Length can be absent or wrong, so count the bytes that arrive. */
async function readBounded(req: Request, limit: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req.body ?? []) {
    total += chunk.byteLength;
    if (total > limit) throw fail(413, 'Request body exceeds limit');
    chunks.push(chunk);
  }
  return new Blob(chunks);
}

/**
 * The request's JSON object. Only a JSON content type is accepted, which a
 * cross-site HTML form cannot send. Anything unparseable is a 400, like a
 * malformed multipart body.
 */
export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw fail(415, 'Content-Type must be application/json');
  const text = await (await readBounded(req, MAX_JSON_BYTES)).text();
  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Reported below with the other malformed bodies.
  }
  throw fail(400, 'Request body must be a JSON object');
}

export async function formBody(req: Request): Promise<FormData> {
  const bytes = await readBounded(req, MAX_UPLOAD_BYTES);
  try {
    const headers = { 'content-type': req.headers.get('content-type') ?? '' };
    return await new Response(bytes, { headers }).formData();
  } catch {
    throw fail(400, 'Request body must be multipart form data');
  }
}
