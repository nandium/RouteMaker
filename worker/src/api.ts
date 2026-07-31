import {
  DEFAULT_GRADE,
  Env,
  fail,
  first,
  GRADES,
  json,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_BYTES,
} from "./shared";
import { handleAuth } from "./auth";
import { adminApi } from "./admin";
import { media, routesApi } from "./routes";
async function handleApi(req: Request, env: Env, path: string) {
  const method = req.method,
    db = env.DB;
  if (path.startsWith("/auth/") || path === "/me")
    return handleAuth(req, env, path);
  if (path.startsWith("/admin/")) return adminApi(req, env, path);
  if (path === "/health" && method === "GET") {
    try {
      const schema = await first(
        db,
        "SELECT COUNT(*) total FROM sqlite_master WHERE type='table' AND name IN ('users','sessions','gyms','routes','votes','grades','comments','follows','reports')",
      );
      if (schema?.total !== 9) return fail(503, "Database is not ready");
    } catch {
      return fail(503, "Database is not ready");
    }
    return json({ status: "ok" });
  }
  if (path === "/meta" && method === "GET")
    return json({
      grades: GRADES,
      default_grade: DEFAULT_GRADE,
      max_image_bytes: MAX_IMAGE_BYTES,
      max_image_dimension: MAX_IMAGE_DIMENSION,
    });
  return routesApi(req, env, path);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const u = new URL(req.url);
      if (u.pathname.startsWith("/media/")) {
        let key: string;
        try {
          key = decodeURIComponent(u.pathname.slice(7));
        } catch {
          return fail(400, "Invalid media path");
        }
        return media(env, key);
      }
      if (u.pathname.startsWith("/api/"))
        return await handleApi(req, env, u.pathname.slice(4));
      return fail(404, "Not found");
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return fail(500, "Internal server error");
    }
  },
};
