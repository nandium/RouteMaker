import type { D1Database } from "@cloudflare/workers-types";
export type DB = D1Database;
export interface Env {
  DB: DB;
  FIREBASE_API_KEY?: string;
  ADMIN_EMAIL?: string;
}

export const GRADES = Array.from({ length: 18 }, (_, i) => `V${i}`);
export const DEFAULT_GRADE = "V4";
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_IMAGE_DIMENSION = 1600;
// Multipart field headers need bounded room beyond the encoded image itself.
export const MAX_UPLOAD_REQUEST_BYTES = MAX_IMAGE_BYTES + 256 * 1024;
export const MAX_JSON_REQUEST_BYTES = 64 * 1024;
export const DAILY_ROUTE_LIMIT = 3;
export const ROUTE_WINDOW_SECONDS = 24 * 60 * 60;
export const FEED_LIMIT = 30;
export const MAX_USER_IMAGES = 20;
export const MIN_EMAIL_LENGTH = 3;
export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_ROUTE_NAME_LENGTH = 80;
export const MAX_GYM_NAME_LENGTH = 100;
export const MAX_GYM_ADDRESS_LENGTH = 200;
export const MAX_COMMENT_LENGTH = 500;
export const MAX_REPORT_REASON_LENGTH = 500;
export const MAX_ID_LENGTH = 200;
export const MAX_OOB_CODE_LENGTH = 2048;
export const MAX_PENDING_GYMS_PER_USER = 5;
export const MAX_ACTIVE_SESSIONS_PER_USER = 5;
export const SESSION_TTL_SECONDS = 30 * 86400;
export const ADMIN_LIST_LIMIT = 100;
// 200 × 512 KiB gives route photos a hard 100 MiB ceiling.
export const MAX_SITE_IMAGES = 200;
export const now = () => Math.floor(Date.now() / 1000);
export const id = () => crypto.randomUUID();
export const json = (
  data: any,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
export const noContent = () => new Response(null, { status: 204 });
export const fail = (status: number, detail: string) =>
  json({ detail }, status);
/** Validate bounded text without coercing non-string JSON/FormData values. */
export function requiredText(
  value: unknown,
  min: number,
  max: number,
  detail: string,
): string {
  if (typeof value !== "string") throw fail(422, detail);
  const text = value.trim();
  if (text.length < min || text.length > max) throw fail(422, detail);
  return text;
}
export const isUniqueViolation = (error: unknown) =>
  error instanceof Error && error.message.includes("UNIQUE constraint failed");
export async function digest(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
/** Read a request body while enforcing the actual bytes received. */
async function readBoundedBody(
  req: Request,
  limit: number,
): Promise<Uint8Array> {
  // Content-Length is advisory only. The stream is always consumed and
  // bounded so missing or inaccurate proxy headers cannot bypass the limit.
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value;
      total += chunk.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw fail(413, "Request body exceeds limit");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
export async function body(req: Request): Promise<any> {
  const raw = await readBoundedBody(req, MAX_JSON_REQUEST_BYTES);
  if (!raw.byteLength) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
}
export async function formBody(req: Request): Promise<FormData> {
  const raw = await readBoundedBody(req, MAX_UPLOAD_REQUEST_BYTES);
  try {
    const headers = new Headers(req.headers);
    // Reparse the bytes with a truthful length; the incoming header may be
    // absent or stale after a proxy has streamed the request.
    headers.delete("content-length");
    return await new Request(req.url, {
      method: req.method,
      headers,
      body: raw as unknown as BodyInit,
    }).formData();
  } catch {
    throw fail(400, "Invalid multipart form data");
  }
}
export async function first(db: DB, sql: string, ...args: any[]) {
  return (await db
    .prepare(sql)
    .bind(...args)
    .first()) as any;
}
export async function all(db: DB, sql: string, ...args: any[]) {
  return ((
    await db
      .prepare(sql)
      .bind(...args)
      .all()
  ).results || []) as any[];
}
