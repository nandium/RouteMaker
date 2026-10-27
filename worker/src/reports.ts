import {
  REPORT_REASONS,
  type CreatedResponse,
  type ReportTarget,
} from '../../app/src/client-contract';
import { first, isUniqueViolation, newId, now, run, stmt } from './db';
import type { Env } from './env';
import { fail, json, jsonBody } from './http';
import { ID_LENGTH, MAX_OPEN_REPORTS_PER_USER, REPORT_DETAILS_LENGTH } from './limits';
import { requireUser } from './session';
import { oneOf, optionalText, requiredText } from './validate';

/** Resolve every open report about one piece of content. */
export const resolveReportsStmt = (
  db: D1Database,
  type: ReportTarget,
  targetId: string,
  actorId: string
) =>
  stmt(
    db,
    "UPDATE reports SET status = 'resolved', resolved_by = ? WHERE target_type = ? AND target_id = ? AND status = 'open'",
    actorId,
    type,
    targetId
  );

// What a report may point at: public content only.
const TARGETS = {
  route: "SELECT 1 FROM routes WHERE id = ? AND status = 'visible'",
  ascent: `SELECT 1 FROM ascents
    JOIN users ON users.id = ascents.user_id
    JOIN routes ON routes.id = ascents.route_id
    WHERE ascents.id = ? AND ascents.note IS NOT NULL AND users.disabled = 0
      AND routes.status = 'visible'`,
  user: 'SELECT 1 FROM users WHERE id = ? AND disabled = 0 AND verified = 1',
} satisfies Record<ReportTarget, string>;

export async function createReport(req: Request, env: Env) {
  const user = await requireUser(req, env);
  const input = await jsonBody(req);
  const invalid = 'Invalid report';
  const type = oneOf(input.target_type, Object.keys(TARGETS) as ReportTarget[], invalid);
  const reason = oneOf(input.reason, REPORT_REASONS, invalid);
  const targetId = requiredText(input.target_id, ID_LENGTH, invalid);
  const details = optionalText(input.details, REPORT_DETAILS_LENGTH, invalid);
  if (!(await first(env.DB, TARGETS[type], targetId)))
    throw fail(404, 'Reported content not found');

  // The cap is checked inside the INSERT so parallel requests cannot exceed it.
  const id = newId();
  try {
    const inserted = await run(
      env.DB,
      `INSERT INTO reports(id, target_type, target_id, reporter_id, reason, details, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE (SELECT COUNT(*) FROM reports WHERE reporter_id = ?4 AND status = 'open') < ?8`,
      id,
      type,
      targetId,
      user.id,
      reason,
      details,
      now(),
      MAX_OPEN_REPORTS_PER_USER
    );
    if (!inserted.meta.changes)
      throw fail(429, 'You have too many open reports. Wait for a moderator to review them.');
  } catch (error) {
    if (isUniqueViolation(error)) throw fail(409, 'You already reported this content');
    throw error;
  }
  return json({ id } satisfies CreatedResponse, 201);
}
