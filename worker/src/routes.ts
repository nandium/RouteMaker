import {
  Env,
  all,
  body,
  fail,
  formBody,
  first,
  id,
  isUniqueViolation,
  json,
  now,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_BYTES,
  DAILY_ROUTE_LIMIT,
  MAX_SITE_IMAGES,
  MAX_USER_IMAGES,
  MAX_ROUTE_NAME_LENGTH,
  MAX_GYM_NAME_LENGTH,
  MAX_GYM_ADDRESS_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  MAX_ID_LENGTH,
  MAX_PENDING_GYMS_PER_USER,
  ROUTE_WINDOW_SECONDS,
  FEED_LIMIT,
  requiredText,
  GRADES,
} from "./shared";
import { current } from "./auth";

const ROUTE_SELECT =
  "routes.id,routes.name,routes.owner_grade,users.username,users.display_name,gyms.name AS gym_name";
const routeVisibility = "routes.status='visible' AND users.disabled=0";
async function ensureActive(db: Env["DB"], userId: string) {
  if (
    !(await first(db, "SELECT id FROM users WHERE id=? AND disabled=0", userId))
  )
    throw fail(403, "Account is not available");
}
export function validateGrade(g: any) {
  if (typeof g !== "string") throw fail(422, "Invalid grade");
  const x = g.toUpperCase();
  if (!GRADES.includes(x))
    throw fail(422, `Grade must be between ${GRADES[0]} and ${GRADES.at(-1)}`);
  return x;
}
export function validateGymCoordinates(
  latitude: unknown,
  longitude: unknown,
): [number, number] {
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw fail(422, "Invalid gym details");
  return [latitude, longitude];
}
/** Validate the baseline Huffman JPEG emitted by the browser canvas. */
export function validateBaselineJpeg(raw: Uint8Array) {
  if (
    raw.length < 12 ||
    raw[0] !== 0xff ||
    raw[1] !== 0xd8 ||
    raw.at(-2) !== 0xff ||
    raw.at(-1) !== 0xd9
  )
    return false;
  const startOfFrame = 0xc0;
  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let hasFrame = false;
  let hasQuantizationTable = false;
  let hasHuffmanTable = false;
  for (let offset = 2; offset + 3 < raw.length;) {
    if (raw[offset++] !== 0xff) return false;
    while (raw[offset] === 0xff) offset++;
    const marker = raw[offset++];
    if (marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (raw[offset] << 8) | raw[offset + 1];
    if (length < 2 || offset + length > raw.length) return false;
    if (marker === 0xdb) hasQuantizationTable = true;
    if (marker === 0xc4) hasHuffmanTable = true;
    if (marker === startOfFrame) {
      if (length < 7) return false;
      const height = (raw[offset + 3] << 8) | raw[offset + 4];
      const width = (raw[offset + 5] << 8) | raw[offset + 6];
      if (
        width <= 0 ||
        height <= 0 ||
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION
      )
        return false;
      hasFrame = true;
    }
    if (frameMarkers.has(marker) && marker !== startOfFrame) return false;
    if (marker === 0xda) {
      if (length < 6 || !hasFrame || !hasQuantizationTable || !hasHuffmanTable)
        return false;
      offset += length;
      let hasScanData = false;
      while (offset + 1 < raw.length) {
        if (raw[offset] !== 0xff) {
          hasScanData = true;
          offset++;
          continue;
        }
        const next = raw[offset + 1];
        if (next === 0x00) {
          hasScanData = true;
          offset += 2;
          continue;
        }
        if (next >= 0xd0 && next <= 0xd7) {
          offset += 2;
          continue;
        }
        return next === 0xd9 && offset === raw.length - 2 && hasScanData;
      }
      return false;
    }
    offset += length;
  }
  return false;
}
async function routeRow(env: Env, rid: string) {
  const r = await first(
    env.DB,
    `SELECT ${ROUTE_SELECT} FROM routes JOIN users ON users.id=routes.user_id JOIN gyms ON gyms.id=routes.gym_id WHERE routes.id=? AND ${routeVisibility}`,
    rid,
  );
  if (!r) throw fail(404, "Route not found");
  return r;
}
async function routePayload(env: Env, r: any, viewer?: string) {
  const grades = await all(
    env.DB,
    `SELECT grades.grade FROM grades JOIN users ON users.id=grades.user_id WHERE route_id=? AND users.disabled=0`,
    r.id,
  );
  let pg = r.owner_grade;
  if (grades.length) {
    const counts = new Map<string, number>();
    for (const g of grades) counts.set(g.grade, (counts.get(g.grade) || 0) + 1);
    pg = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || GRADES.indexOf(a[0]) - GRADES.indexOf(b[0]),
    )[0][0];
  }
  const votes =
    (
      await first(
        env.DB,
        `SELECT COUNT(*) total FROM votes JOIN users ON users.id=votes.user_id WHERE route_id=? AND users.disabled=0`,
        r.id,
      )
    )?.total || 0;
  const cc =
    (
      await first(
        env.DB,
        `SELECT COUNT(*) total FROM comments JOIN users ON users.id=comments.user_id WHERE route_id=? AND hidden=0 AND users.disabled=0`,
        r.id,
      )
    )?.total || 0;
  return {
    id: r.id,
    name: r.name,
    public_grade: pg,
    votes,
    voted: !!(
      viewer &&
      (await first(
        env.DB,
        "SELECT 1 FROM votes WHERE route_id=? AND user_id=?",
        r.id,
        viewer,
      ))
    ),
    comment_count: cc,
    image_url: `/media/${r.id}`,
    author: {
      username: r.username,
      display_name: r.display_name,
    },
    gym: { name: r.gym_name },
  };
}
async function createRoute(req: Request, env: Env, user: any) {
  // formBody enforces the multipart request limit from actual stream bytes;
  // Content-Length may be omitted or inaccurate by a proxy.
  const f = await formBody(req);
  const name = requiredText(
      f.get("name"),
      1,
      MAX_ROUTE_NAME_LENGTH,
      "Route name is required",
    ),
    gym = requiredText(
      f.get("gym_id"),
      1,
      MAX_ID_LENGTH,
      "Choose an approved gym",
    ),
    grade = validateGrade(f.get("owner_grade"));
  const g = await first(
    env.DB,
    "SELECT id FROM gyms WHERE id=? AND status='approved'",
    gym,
  );
  if (!g) throw fail(422, "Choose an approved gym");
  const image = f.get("image");
  if (!(image instanceof File)) throw fail(422, "Image is required");
  if (image.size > MAX_IMAGE_BYTES)
    throw fail(413, `Image exceeds the ${MAX_IMAGE_BYTES / 1024} KiB limit`);
  if (image.type !== "image/jpeg") throw fail(415, "JPEG image required");
  const raw = new Uint8Array(await image.arrayBuffer());
  // Dimensions are checked without decoding so malformed or oversized images
  // cannot move expensive work into storage or downstream clients.
  if (!validateBaselineJpeg(raw))
    throw fail(415, "Baseline Huffman JPEG image required");
  const rid = id(),
    t = now();
  const result = await env.DB.prepare(
    `INSERT INTO routes(id,user_id,gym_id,name,owner_grade,image,status,created_at)
     SELECT ?,?,?,?,?,?,'visible',?
     WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0)
       AND (SELECT COUNT(*) FROM routes WHERE user_id=? AND created_at>?) < ?
       AND (SELECT COUNT(*) FROM routes WHERE user_id=? AND image IS NOT NULL) < ?
       AND (SELECT COUNT(*) FROM routes WHERE image IS NOT NULL) < ?`,
  )
    .bind(
      rid,
      user.id,
      gym,
      name,
      grade,
      raw.buffer as ArrayBuffer,
      t,
      user.id,
      user.id,
      t - ROUTE_WINDOW_SECONDS,
      DAILY_ROUTE_LIMIT,
      user.id,
      MAX_USER_IMAGES,
      MAX_SITE_IMAGES,
    )
    .run();
  if (!result.meta?.changes) {
    const limits = await first(
      env.DB,
      `SELECT disabled,
         (SELECT COUNT(*) FROM routes WHERE user_id=? AND created_at>?) recent,
         (SELECT COUNT(*) FROM routes WHERE user_id=? AND image IS NOT NULL) user_images,
         (SELECT COUNT(*) FROM routes WHERE image IS NOT NULL) site_images
       FROM users WHERE id=?`,
      user.id,
      t - ROUTE_WINDOW_SECONDS,
      user.id,
      user.id,
    );
    if (!limits || limits.disabled) throw fail(403, "Account is not available");
    if (limits.recent >= DAILY_ROUTE_LIMIT)
      throw fail(429, "Daily route limit reached");
    if (limits.user_images >= MAX_USER_IMAGES)
      throw fail(429, "Account photo limit reached");
    if (limits.site_images >= MAX_SITE_IMAGES)
      throw fail(507, "Site photo limit reached");
    throw fail(409, "Route could not be published");
  }
  return routePayload(env, await routeRow(env, rid), user.id);
}

export async function routesApi(req: Request, env: Env, path: string) {
  const method = req.method,
    db = env.DB;
  if (path === "/reports" && method === "POST") {
    const u = await current(req, env),
      b = await body(req),
      typ = b?.target_type,
      tid = b?.target_id,
      reason = b?.reason;
    if (
      typeof typ !== "string" ||
      typeof tid !== "string" ||
      !tid.trim() ||
      !["route", "comment", "user"].includes(typ) ||
      typeof reason !== "string"
    )
      throw fail(422, "Invalid report");
    const cleanReason = requiredText(
      reason,
      3,
      MAX_REPORT_REASON_LENGTH,
      "Invalid report",
    );
    const targetId = requiredText(tid, 1, MAX_ID_LENGTH, "Invalid report");
    const valid =
      typ === "route"
        ? await first(
            db,
            `SELECT routes.id FROM routes JOIN users ON users.id=routes.user_id WHERE routes.id=? AND ${routeVisibility}`,
            targetId,
          )
        : typ === "comment"
          ? await first(
              db,
              "SELECT comments.id FROM comments JOIN routes ON routes.id=comments.route_id JOIN users ON users.id=comments.user_id JOIN users owner ON owner.id=routes.user_id WHERE comments.id=? AND comments.hidden=0 AND users.disabled=0 AND routes.status='visible' AND owner.disabled=0",
              targetId,
            )
          : await first(
              db,
              "SELECT id FROM users WHERE id=? AND disabled=0",
              targetId,
            );
    if (!valid) throw fail(404, "Reported content not found");
    const rid = id();
    try {
      const values = [rid, typ, targetId, u.id, cleanReason, now(), u.id];
      const result =
        typ === "route"
          ? await db
              .prepare(
                "INSERT INTO reports(id,target_type,target_id,user_id,reason,status,resolved_by,created_at) SELECT ?,?,?,?,?, 'open',NULL,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM routes JOIN users owner ON owner.id=routes.user_id WHERE routes.id=? AND routes.status='visible' AND owner.disabled=0)",
              )
              .bind(...values, targetId)
              .run()
          : typ === "comment"
            ? await db
                .prepare(
                  "INSERT INTO reports(id,target_type,target_id,user_id,reason,status,resolved_by,created_at) SELECT ?,?,?,?,?, 'open',NULL,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM comments JOIN users ON users.id=comments.user_id JOIN routes ON routes.id=comments.route_id JOIN users owner ON owner.id=routes.user_id WHERE comments.id=? AND comments.hidden=0 AND users.disabled=0 AND routes.status='visible' AND owner.disabled=0)",
                )
                .bind(...values, targetId)
                .run()
            : await db
                .prepare(
                  "INSERT INTO reports(id,target_type,target_id,user_id,reason,status,resolved_by,created_at) SELECT ?,?,?,?,?, 'open',NULL,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0)",
                )
                .bind(...values, targetId)
                .run();
      if (!result.meta?.changes) {
        await ensureActive(db, u.id);
        throw fail(409, "Reported content is no longer available");
      }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw fail(409, "You already reported this content");
    }
    return json({ id: rid, status: "open" }, 201);
  }
  if (path === "/gyms" && method === "GET") {
    return json(
      await all(
        db,
        "SELECT id,country_code,name,address,latitude,longitude,status FROM gyms WHERE status='approved' ORDER BY name",
      ),
    );
  }
  if (path === "/gyms" && method === "POST") {
    const u = await current(req, env),
      b = await body(req);
    if (!b || typeof b !== "object" || Array.isArray(b))
      throw fail(422, "Invalid gym details");
    const n = requiredText(
        b?.name,
        2,
        MAX_GYM_NAME_LENGTH,
        "Invalid gym details",
      ),
      a = requiredText(
        b?.address,
        3,
        MAX_GYM_ADDRESS_LENGTH,
        "Invalid gym details",
      ),
      countryCode = requiredText(b?.country_code, 2, 2, "Invalid gym details"),
      cc = countryCode.toUpperCase(),
      latitude = b?.latitude,
      longitude = b?.longitude;
    const [validatedLatitude, validatedLongitude] = validateGymCoordinates(
      latitude,
      longitude,
    );
    if (!/^[A-Z]{2}$/.test(cc)) throw fail(422, "Invalid gym details");
    const gid = id();
    const result = await db
      .prepare(
        "INSERT INTO gyms(id,country_code,name,address,latitude,longitude,status,requested_by,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND (SELECT COUNT(*) FROM gyms WHERE requested_by=? AND status='pending') < ?",
      )
      .bind(
        gid,
        cc,
        n,
        a,
        validatedLatitude,
        validatedLongitude,
        "pending",
        u.id,
        now(),
        u.id,
        u.id,
        MAX_PENDING_GYMS_PER_USER,
      )
      .run();
    if (!result.meta?.changes) {
      await ensureActive(db, u.id);
      throw fail(429, "Pending gym limit reached");
    }
    return json({ id: gid, status: "pending" }, 201);
  }
  if (path === "/routes" && method === "GET") {
    const u = await current(req, env, false),
      url = new URL(req.url),
      clauses = [routeVisibility],
      args: any[] = [];
    if (url.searchParams.get("gym_id")) {
      clauses.push("routes.gym_id=?");
      args.push(url.searchParams.get("gym_id"));
    }
    if (url.searchParams.get("author_id")) {
      clauses.push("routes.user_id=?");
      args.push(url.searchParams.get("author_id"));
    }
    if (url.searchParams.get("following") === "true") {
      if (!u) throw fail(401, "Authentication required");
      clauses.push(
        "routes.user_id IN (SELECT followed_id FROM follows WHERE follower_id=?)",
      );
      args.push(u.id);
    }
    const rows = await all(
      db,
      `SELECT ${ROUTE_SELECT} FROM routes JOIN users ON users.id=routes.user_id JOIN gyms ON gyms.id=routes.gym_id WHERE ${clauses.join(" AND ")} ORDER BY routes.created_at DESC LIMIT ?`,
      ...args,
      FEED_LIMIT,
    );
    return json(
      await Promise.all(rows.map((r) => routePayload(env, r, u?.id))),
    );
  }
  if (path === "/routes" && method === "POST") {
    return json(await createRoute(req, env, await current(req, env)), 201);
  }
  const m = path.match(/^\/routes\/([^/]+)(?:\/(vote|grade|comments))?$/);
  if (m) {
    const rid = m[1],
      sub = m[2];
    if (!sub && method === "GET") {
      const u = await current(req, env, false);
      return json(await routePayload(env, await routeRow(env, rid), u?.id));
    }
    if (sub === "vote" && method === "POST") {
      const u = await current(req, env),
        b = await body(req);
      if (typeof b?.active !== "boolean")
        throw fail(422, "Vote active state is required");
      await routeRow(env, rid);
      if (b.active)
        await db
          .prepare(
            "INSERT OR IGNORE INTO votes(route_id,user_id) SELECT ?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM routes r JOIN users owner ON owner.id=r.user_id WHERE r.id=? AND r.status='visible' AND owner.disabled=0)",
          )
          .bind(rid, u.id, u.id, rid)
          .run();
      else
        await db
          .prepare(
            "DELETE FROM votes WHERE route_id=? AND user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0)",
          )
          .bind(rid, u.id, u.id)
          .run();
      await ensureActive(db, u.id);
      await routeRow(env, rid);
      const c = await first(
        db,
        "SELECT COUNT(*) total FROM votes JOIN users ON users.id=votes.user_id WHERE route_id=? AND users.disabled=0",
        rid,
      );
      return json({ voted: b.active, votes: c?.total || 0 });
    }
    if (sub === "grade" && method === "PUT") {
      const u = await current(req, env),
        b = await body(req);
      await routeRow(env, rid);
      const g = validateGrade(b?.grade);
      await db
        .prepare(
          "INSERT INTO grades(route_id,user_id,grade) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM routes r JOIN users owner ON owner.id=r.user_id WHERE r.id=? AND r.status='visible' AND owner.disabled=0) ON CONFLICT(route_id,user_id) DO UPDATE SET grade=excluded.grade",
        )
        .bind(rid, u.id, g, u.id, rid)
        .run();
      await ensureActive(db, u.id);
      const p = await routePayload(env, await routeRow(env, rid), u.id);
      return json({ public_grade: p.public_grade });
    }
    if (sub === "comments" && method === "GET") {
      await routeRow(env, rid);
      const rs = await all(
        db,
        "SELECT comments.*,users.username,users.display_name FROM comments JOIN users ON users.id=comments.user_id WHERE route_id=? AND hidden=0 AND users.disabled=0 ORDER BY comments.created_at",
        rid,
      );
      return json(
        rs.map((x) => ({
          id: x.id,
          body: x.body,
          author: {
            username: x.username,
            display_name: x.display_name,
          },
        })),
      );
    }
    if (sub === "comments" && method === "POST") {
      const u = await current(req, env),
        b = await body(req),
        text = requiredText(
          b?.body,
          1,
          MAX_COMMENT_LENGTH,
          "Comment is required",
        );
      await routeRow(env, rid);
      const cid = id();
      const createdAt = now();
      try {
        const result = await db
          .prepare(
            "INSERT INTO comments(id,route_id,user_id,body,hidden,created_at) SELECT ?,?,?,?,0,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM routes r JOIN users owner ON owner.id=r.user_id WHERE r.id=? AND r.status='visible' AND owner.disabled=0)",
          )
          .bind(cid, rid, u.id, text, createdAt, u.id, rid)
          .run();
        if (!result.meta?.changes) {
          await ensureActive(db, u.id);
          throw fail(409, "Comment could not be created");
        }
        await ensureActive(db, u.id);
        await routeRow(env, rid);
      } catch (error) {
        if (error instanceof Response) throw error;
        if (!isUniqueViolation(error)) throw error;
        throw fail(409, "You already commented on this route");
      }
      return json(
        {
          id: cid,
          body: text,
          author: {
            username: u.username,
            display_name: u.display_name,
          },
        },
        201,
      );
    }
  }
  const pf = path.match(/^\/users\/([^/]+)$/);
  if (pf && method === "GET") {
    const u = await current(req, env, false),
      target = await first(
        db,
        "SELECT * FROM users WHERE username=? COLLATE NOCASE AND disabled=0",
        (() => {
          try {
            return decodeURIComponent(pf[1]);
          } catch {
            throw fail(400, "Invalid user path");
          }
        })(),
      );
    if (!target) throw fail(404, "User not found");
    const followers = await first(
        db,
        "SELECT COUNT(*) total FROM follows JOIN users f ON f.id=follows.follower_id WHERE followed_id=? AND f.disabled=0",
        target.id,
      ),
      following = await first(
        db,
        "SELECT COUNT(*) total FROM follows JOIN users f ON f.id=follows.followed_id WHERE follower_id=? AND f.disabled=0",
        target.id,
      );
    return json({
      id: target.id,
      username: target.username,
      display_name: target.display_name,
      followers: followers?.total || 0,
      following: following?.total || 0,
      followed: !!(
        u &&
        (await first(
          db,
          "SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?",
          u.id,
          target.id,
        ))
      ),
    });
  }
  const ff = path.match(/^\/users\/([^/]+)\/follow$/);
  if (ff && method === "POST") {
    const u = await current(req, env),
      b = await body(req),
      uid = ff[1];
    if (typeof b?.active !== "boolean")
      throw fail(422, "Follow active state is required");
    if (uid === u.id) throw fail(422, "You cannot follow yourself");
    if (
      !(await first(db, "SELECT id FROM users WHERE id=? AND disabled=0", uid))
    )
      throw fail(404, "User not found");
    if (b.active)
      await db
        .prepare(
          "INSERT OR IGNORE INTO follows(follower_id,followed_id,created_at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0)",
        )
        .bind(u.id, uid, now(), u.id, uid)
        .run();
    else
      await db
        .prepare(
          "DELETE FROM follows WHERE follower_id=? AND followed_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0) AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=0)",
        )
        .bind(u.id, uid, u.id, uid)
        .run();
    await ensureActive(db, u.id);
    return json({
      followed: !!(await first(
        db,
        "SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?",
        u.id,
        uid,
      )),
    });
  }

  return fail(404, "Not found");
}
export async function media(env: Env, routeId: string) {
  const r = await first(
    env.DB,
    `SELECT routes.image FROM routes JOIN users ON users.id=routes.user_id WHERE routes.id=? AND ${routeVisibility}`,
    routeId,
  );
  if (!r?.image) return fail(404, "Not found");
  return new Response(Uint8Array.from(r.image as number[]), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store",
    },
  });
}
