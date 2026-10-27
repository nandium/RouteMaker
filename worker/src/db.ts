/** Seconds since the epoch: what rows are stamped with. */
export const now = () => Math.floor(Date.now() / 1000);
export const newId = () => crypto.randomUUID();

/** A prepared statement with its arguments bound, for batches. */
export const stmt = (db: D1Database, sql: string, ...args: unknown[]) =>
  db.prepare(sql).bind(...args);
export const first = <T>(db: D1Database, sql: string, ...args: unknown[]) =>
  stmt(db, sql, ...args).first<T>();
export const run = (db: D1Database, sql: string, ...args: unknown[]) =>
  stmt(db, sql, ...args).run();
export async function all<T>(db: D1Database, sql: string, ...args: unknown[]) {
  return (await stmt(db, sql, ...args).all<T>()).results;
}

export const isUniqueViolation = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed');
