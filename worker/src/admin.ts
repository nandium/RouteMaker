import { Env, all, body, fail, first, json, ADMIN_LIST_LIMIT } from "./shared";
import { admin, publicUser } from "./auth";

/** Disable an account without ever disabling the final active administrator. */
async function disableUser(
  db: Env["DB"],
  userId: string,
  moderatorId: string,
  report?: { id: string; moderatorId: string },
) {
  const statements = [
    db
      .prepare(
        `UPDATE users SET disabled=1
         WHERE id=? AND disabled=0
           AND NOT (
             role='admin' AND
             (SELECT COUNT(*) FROM users WHERE role='admin' AND disabled=0) <= 1
           )
           AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)
           ${report ? "AND EXISTS (SELECT 1 FROM reports WHERE id=? AND target_type='user' AND target_id=? AND status='open')" : ""}`,
      )
      .bind(
        ...(report
          ? [userId, moderatorId, report.id, userId]
          : [userId, moderatorId]),
      ),
  ];
  if (report) {
    statements.push(
      db
        .prepare(
          `UPDATE reports SET status='resolved',resolved_by=?
           WHERE id=? AND target_type='user' AND target_id=? AND status='open'
             AND changes()=1
             AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)`,
        )
        .bind(report.moderatorId, report.id, userId, report.moderatorId),
    );
  }
  statements.push(
    db
      .prepare(
        "UPDATE routes SET status='hidden',image=NULL WHERE user_id=? AND status='visible' AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=1) AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)",
      )
      .bind(userId, userId, moderatorId),
  );
  statements.push(
    db
      .prepare(
        "DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND disabled=1) AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)",
      )
      .bind(userId, userId, moderatorId),
  );
  const results = await db.batch(statements);
  await ensureActiveAdmin(db, moderatorId);
  return {
    changed: !!results[0]?.meta?.changes,
    reportChanged: report ? !!results[1]?.meta?.changes : undefined,
  };
}
async function ensureActiveAdmin(db: Env["DB"], moderatorId: string) {
  if (
    !(await first(
      db,
      "SELECT id FROM users WHERE id=? AND role='admin' AND disabled=0",
      moderatorId,
    ))
  )
    throw fail(403, "Admin access required");
}
const REPORT_DECISIONS = ["dismiss", "hide"] as const;
const GYM_DECISIONS = ["approve", "reject"] as const;

function isReportDecision(
  value: string,
): value is (typeof REPORT_DECISIONS)[number] {
  return (REPORT_DECISIONS as readonly string[]).includes(value);
}
function isGymDecision(value: string): value is (typeof GYM_DECISIONS)[number] {
  return (GYM_DECISIONS as readonly string[]).includes(value);
}

export async function adminApi(req: Request, env: Env, path: string) {
  const db = env.DB,
    method = req.method;
  if (!path.startsWith("/admin/")) return fail(404, "Not found");
  const moderator = await admin(req, env);
  if (path === "/admin/reports" && method === "GET") {
    const rows = await all(
      db,
      `SELECT reports.*,CASE target_type WHEN 'route' THEN (SELECT name FROM routes WHERE id=target_id) WHEN 'comment' THEN (SELECT body FROM comments WHERE id=target_id) WHEN 'user' THEN (SELECT username FROM users WHERE id=target_id) END target_label,CASE target_type WHEN 'route' THEN target_id WHEN 'comment' THEN (SELECT route_id FROM comments WHERE id=target_id) END route_id FROM reports WHERE status='open' ORDER BY created_at LIMIT ?`,
      ADMIN_LIST_LIMIT,
    );
    return json(rows);
  }
  const rm = path.match(/^\/admin\/reports\/([^/]+)$/);
  if (rm && method === "PUT") {
    const b = await body(req),
      decision = b?.decision;
    if (typeof decision !== "string")
      throw fail(422, "Decision must be dismiss or hide");
    if (!isReportDecision(decision))
      throw fail(422, "Decision must be dismiss or hide");
    const report = await first(
      db,
      "SELECT * FROM reports WHERE id=? AND status='open'",
      rm[1],
    );
    if (!report) throw fail(409, "Report is no longer open");
    await ensureActiveAdmin(db, moderator.id);
    if (decision === "dismiss") {
      const result = await db.batch([
        db
          .prepare(
            "UPDATE reports SET status='dismissed',resolved_by=? WHERE id=? AND status='open' AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)",
          )
          .bind(moderator.id, rm[1], moderator.id),
      ]);
      if (!result[0]?.meta?.changes) {
        await ensureActiveAdmin(db, moderator.id);
        throw fail(409, "Report is no longer open");
      }
      return json({ id: rm[1], status: "dismissed" });
    }

    let result: any[];
    if (report.target_type === "route") {
      const target = await first(
        db,
        "SELECT id FROM routes WHERE id=?",
        report.target_id,
      );
      if (!target) throw fail(409, "Reported route is no longer available");
      result = await db.batch([
        db
          .prepare(
            `UPDATE routes SET status='hidden',image=NULL
             WHERE id=? AND status='visible'
               AND EXISTS (SELECT 1 FROM users WHERE users.id=routes.user_id AND users.disabled=0)
               AND EXISTS (SELECT 1 FROM reports WHERE id=? AND target_type='route' AND target_id=? AND status='open')
               AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)`,
          )
          .bind(report.target_id, rm[1], report.target_id, moderator.id),
        db
          .prepare(
            `UPDATE reports SET status='resolved',resolved_by=?
             WHERE id=? AND target_type='route' AND target_id=? AND status='open' AND changes()=1
               AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)`,
          )
          .bind(moderator.id, rm[1], report.target_id, moderator.id),
      ]);
    } else if (report.target_type === "comment") {
      result = await db.batch([
        db
          .prepare(
            `UPDATE comments SET hidden=1
             WHERE id=? AND hidden=0
               AND EXISTS (SELECT 1 FROM users WHERE users.id=comments.user_id AND users.disabled=0)
               AND EXISTS (SELECT 1 FROM routes JOIN users owner ON owner.id=routes.user_id
                           WHERE routes.id=comments.route_id AND routes.status='visible'
                             AND owner.disabled=0)
               AND EXISTS (SELECT 1 FROM reports WHERE id=? AND target_type='comment' AND target_id=? AND status='open')
               AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)`,
          )
          .bind(report.target_id, rm[1], report.target_id, moderator.id),
        db
          .prepare(
            `UPDATE reports SET status='resolved',resolved_by=?
             WHERE id=? AND target_type='comment' AND target_id=? AND status='open' AND changes()=1
               AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)`,
          )
          .bind(moderator.id, rm[1], report.target_id, moderator.id),
      ]);
    } else {
      const target = await first(
        db,
        "SELECT * FROM users WHERE id=?",
        report.target_id,
      );
      await ensureActiveAdmin(db, moderator.id);
      if (!target) throw fail(409, "Reported user is no longer available");
      if (target.disabled)
        throw fail(409, "Reported user is no longer available");
      if (target.id === moderator.id)
        throw fail(409, "At least one administrator must remain active");
      const disabled = await disableUser(db, report.target_id, moderator.id, {
        id: rm[1],
        moderatorId: moderator.id,
      });
      if (!disabled.changed || !disabled.reportChanged)
        throw fail(409, "Reported user is no longer available");
      return json({ id: rm[1], status: "resolved" });
    }
    if (!result[0]?.meta?.changes || !result[1]?.meta?.changes) {
      await ensureActiveAdmin(db, moderator.id);
      throw fail(409, `Reported ${report.target_type} is no longer available`);
    }
    return json({
      id: rm[1],
      status: "resolved",
    });
  }
  if (path === "/admin/gyms" && method === "GET")
    return json(
      await all(
        db,
        "SELECT * FROM gyms WHERE status='pending' ORDER BY created_at LIMIT ?",
        ADMIN_LIST_LIMIT,
      ),
    );
  const gm = path.match(/^\/admin\/gyms\/([^/]+)$/);
  if (gm && method === "PUT") {
    const b = await body(req),
      d = b?.decision;
    if (typeof d !== "string")
      throw fail(422, "Decision must be approve or reject");
    if (!isGymDecision(d))
      throw fail(422, "Decision must be approve or reject");
    const r = await db
      .prepare(
        "UPDATE gyms SET status=? WHERE id=? AND status='pending' AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)",
      )
      .bind(d === "approve" ? "approved" : "rejected", gm[1], moderator.id)
      .run();
    if (!r.meta?.changes) {
      await ensureActiveAdmin(db, moderator.id);
      throw fail(404, "Pending gym not found");
    }
    return json({
      id: gm[1],
      status: d === "approve" ? "approved" : "rejected",
    });
  }
  if (path === "/admin/users" && method === "GET")
    return json(
      (await all(db, "SELECT * FROM users ORDER BY created_at")).map(
        publicUser,
      ),
    );
  const um = path.match(/^\/admin\/users\/([^/]+)\/disabled$/);
  if (um && method === "PUT") {
    const values = new URL(req.url).searchParams.getAll("disabled");
    const disabledValue = values.length === 1 ? values[0] : null;
    if (disabledValue !== "true" && disabledValue !== "false")
      throw fail(422, "disabled must be true or false");
    const disabled = disabledValue === "true";
    const target = await first(db, "SELECT * FROM users WHERE id=?", um[1]);
    await ensureActiveAdmin(db, moderator.id);
    if (!target) throw fail(404, "User not found");
    if (disabled) {
      if (target.disabled) return json({ id: um[1], disabled: true });
      if (target.id === moderator.id)
        throw fail(409, "At least one administrator must remain active");
      const result = await disableUser(db, um[1], moderator.id);
      if (!result.changed) {
        await ensureActiveAdmin(db, moderator.id);
        throw fail(409, "At least one administrator must remain active");
      }
    } else {
      const r = await db
        .prepare(
          "UPDATE users SET disabled=0 WHERE id=? AND disabled=1 AND EXISTS (SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0)",
        )
        .bind(um[1], moderator.id)
        .run();
      if (!r.meta?.changes) {
        await ensureActiveAdmin(db, moderator.id);
        throw fail(404, "User not found");
      }
    }
    return json({ id: um[1], disabled });
  }
  return fail(404, "Not found");
}
