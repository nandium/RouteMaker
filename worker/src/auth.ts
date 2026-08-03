import {
  MAX_ACTIVE_SESSIONS_PER_USER,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_OOB_CODE_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_EMAIL_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  SESSION_TTL_SECONDS,
  Env,
  body,
  digest,
  fail,
  first,
  isUniqueViolation,
  json,
  noContent,
  now,
  requiredText,
} from "./shared";

const FIREBASE_API = "https://identitytoolkit.googleapis.com/v1";
type FirebaseOperation =
  "signup" | "login" | "lookup" | "verify-email" | "forgot" | "action";

function requireFirebase(env: Env) {
  const key = env.FIREBASE_API_KEY?.trim();
  if (!key) throw fail(503, "Firebase Authentication is not configured");
  return key;
}

function firebaseFailure(code: string, operation: FirebaseOperation): Response {
  if (
    operation === "login" &&
    [
      "EMAIL_NOT_FOUND",
      "INVALID_PASSWORD",
      "INVALID_LOGIN_CREDENTIALS",
    ].includes(code)
  )
    return fail(401, "Email or password is incorrect");
  if (operation === "login" && code === "USER_DISABLED")
    return fail(403, "Account is not available");
  if (operation === "signup" && code === "EMAIL_EXISTS")
    return fail(409, "Email or username is already registered");
  if (
    operation === "signup" &&
    ["INVALID_EMAIL", "WEAK_PASSWORD"].includes(code)
  )
    return fail(422, "Invalid signup details");
  if (
    operation === "action" &&
    ["EXPIRED_OOB_CODE", "INVALID_OOB_CODE", "WEAK_PASSWORD"].some((value) =>
      code.startsWith(value),
    )
  )
    return fail(422, "This email link is invalid or expired");
  return fail(503, "Firebase Authentication is unavailable");
}

async function firebaseRequest(
  env: Env,
  endpoint: string,
  payload: Record<string, unknown>,
  operation: FirebaseOperation,
) {
  const key = requireFirebase(env);
  let response: Response;
  try {
    response = await fetch(
      `${FIREBASE_API}/${endpoint}?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    throw fail(503, "Firebase Authentication is unavailable");
  }
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // A successful Firebase response normally has JSON, but the caller will
    // produce a clear unavailable response if required fields are missing.
  }
  if (response.ok) return data || {};
  const code = String(data?.error?.message || "");
  // Firebase intentionally returns EMAIL_NOT_FOUND for password reset so the
  // API can keep the forgot-password response non-enumerating.
  if (
    operation === "forgot" &&
    ["EMAIL_NOT_FOUND", "INVALID_EMAIL"].includes(code)
  )
    return null;
  throw firebaseFailure(code, operation);
}

async function rollbackFirebaseAccount(env: Env, idToken: string | undefined) {
  const key = env.FIREBASE_API_KEY?.trim();
  if (!idToken || !key) return;
  try {
    await fetch(
      `${FIREBASE_API}/accounts:delete?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
  } catch {
    // Best effort: the original signup failure is still returned to the user.
  }
}

function opaqueToken() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  ).replaceAll("=", "");
}

function validSignup(b: any) {
  const email = requiredText(
    b?.email,
    MIN_EMAIL_LENGTH,
    MAX_EMAIL_LENGTH,
    "Invalid signup details",
  ).toLowerCase();
  const username = requiredText(
    b?.username,
    MIN_USERNAME_LENGTH,
    MAX_USERNAME_LENGTH,
    "Invalid signup details",
  );
  const displayName = requiredText(
    b?.display_name,
    1,
    MAX_DISPLAY_NAME_LENGTH,
    "Invalid signup details",
  );
  if (typeof b?.password !== "string")
    throw fail(422, "Invalid signup details");
  const password = b.password;
  if (
    email.length < MIN_EMAIL_LENGTH ||
    email.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^[A-Za-z0-9_-]+$/.test(username) ||
    username.length < MIN_USERNAME_LENGTH ||
    username.length > MAX_USERNAME_LENGTH ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  )
    throw fail(422, "Invalid signup details");
  return { email, username, displayName, password };
}

export async function handleAuth(req: Request, env: Env, path: string) {
  const method = req.method;
  const db = env.DB;
  if (path === "/auth/signup" && method === "POST") {
    requireFirebase(env);
    const b = await body(req);
    const { email, username, displayName, password } = validSignup(b);
    const account = await firebaseRequest(
      env,
      "accounts:signUp",
      { email, password, returnSecureToken: true },
      "signup",
    );
    const localId = String(account?.localId || "");
    const idToken = String(account?.idToken || "");
    if (!localId || !idToken)
      throw fail(503, "Firebase Authentication is unavailable");
    const role =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.trim().toLowerCase()
        ? "admin"
        : "user";
    try {
      await db
        .prepare(
          "INSERT INTO users(id,email,username,display_name,role,created_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(localId, email, username, displayName, role, now())
        .run();
    } catch (error) {
      await rollbackFirebaseAccount(env, idToken);
      if (!isUniqueViolation(error)) throw error;
      throw fail(409, "Email or username is already registered");
    }
    try {
      await firebaseRequest(
        env,
        "accounts:sendOobCode",
        { requestType: "VERIFY_EMAIL", idToken },
        "verify-email",
      );
    } catch (e) {
      await db.prepare("DELETE FROM users WHERE id=?").bind(localId).run();
      await rollbackFirebaseAccount(env, idToken);
      throw e;
    }
    return json({ message: "Check your email to verify the account" }, 201);
  }
  if (path === "/auth/login" && method === "POST") {
    requireFirebase(env);
    const b = await body(req);
    if (typeof b?.email !== "string" || typeof b?.password !== "string")
      throw fail(401, "Email or password is incorrect");
    const email = b.email.trim().toLowerCase();
    const password = b.password;
    if (
      email.length < MIN_EMAIL_LENGTH ||
      email.length > MAX_EMAIL_LENGTH ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    )
      throw fail(401, "Email or password is incorrect");
    const account = await firebaseRequest(
      env,
      "accounts:signInWithPassword",
      { email, password, returnSecureToken: true },
      "login",
    );
    const idToken = String(account?.idToken || "");
    if (!idToken) throw fail(503, "Firebase Authentication is unavailable");
    const lookup = await firebaseRequest(
      env,
      "accounts:lookup",
      { idToken },
      "lookup",
    );
    const firebaseUser = lookup?.users?.[0];
    if (!firebaseUser?.emailVerified)
      throw fail(403, "Email address is not verified");
    const localId = String(firebaseUser.localId || account?.localId || "");
    if (!localId) throw fail(503, "Firebase Authentication is unavailable");
    const u = await first(db, "SELECT * FROM users WHERE id=?", localId);
    if (!u) throw fail(503, "Profile is not available");
    if (u.disabled) throw fail(403, "Account is not available");
    const raw = opaqueToken();
    const timestamp = now();
    // Auth traffic is an existing cleanup point: remove expired rows before
    // adding a session, then retain only a small active-session window.
    await db
      .prepare("DELETE FROM sessions WHERE expires_at<=?")
      .bind(timestamp)
      .run();
    await db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .bind(await digest(raw), localId, timestamp + SESSION_TTL_SECONDS)
      .run();
    await db
      .prepare(
        "DELETE FROM sessions WHERE user_id=? AND rowid NOT IN (SELECT rowid FROM sessions WHERE user_id=? ORDER BY rowid DESC LIMIT ?)",
      )
      .bind(localId, localId, MAX_ACTIVE_SESSIONS_PER_USER)
      .run();
    return json({ token: raw, user: publicUser(u) });
  }
  if (path === "/auth/logout" && method === "POST") {
    await current(req, env);
    const h = req.headers.get("authorization")!;
    await db
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(await digest(h.slice(7)))
      .run();
    return noContent();
  }
  if (path === "/auth/forgot" && method === "POST") {
    requireFirebase(env);
    const b = await body(req);
    if (typeof b?.email !== "string") throw fail(422, "Invalid email");
    const email = b.email.trim().toLowerCase();
    if (
      email.length < MIN_EMAIL_LENGTH ||
      email.length > MAX_EMAIL_LENGTH ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      throw fail(422, "Invalid email");
    await firebaseRequest(
      env,
      "accounts:sendOobCode",
      { requestType: "PASSWORD_RESET", email },
      "forgot",
    );
    return json({
      message: "If that account exists, a reset email will be sent",
    });
  }
  if (path === "/auth/verify" && method === "POST") {
    const b = await body(req);
    if (typeof b?.oob_code !== "string")
      throw fail(422, "Invalid verification link");
    const oobCode = b.oob_code;
    if (!oobCode || oobCode.length > MAX_OOB_CODE_LENGTH)
      throw fail(422, "Invalid verification link");
    const account = await firebaseRequest(
      env,
      "accounts:update",
      { oobCode },
      "action",
    );
    if (!account?.localId)
      throw fail(422, "This email link is invalid or expired");
    return json({ message: "Email verified. You can now sign in." });
  }
  if (path === "/auth/reset" && method === "POST") {
    const b = await body(req);
    if (typeof b?.oob_code !== "string" || typeof b?.password !== "string")
      throw fail(422, "Invalid password reset");
    const oobCode = b.oob_code;
    const password = b.password;
    if (
      !oobCode ||
      oobCode.length > MAX_OOB_CODE_LENGTH ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    )
      throw fail(422, "Invalid password reset");
    const account = await firebaseRequest(
      env,
      "accounts:resetPassword",
      { oobCode, newPassword: password },
      "action",
    );
    const email = String(account?.email || "").toLowerCase();
    if (!email) throw fail(422, "This email link is invalid or expired");
    // Revocation belongs here, after possession of the email link is proven.
    await db
      .prepare(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email=? COLLATE NOCASE)",
      )
      .bind(email)
      .run();
    return json({
      message: "Password changed. Sign in with your new password.",
    });
  }
  if (path === "/me") {
    const u = await current(req, env);
    if (method === "GET") return json(publicUser(u));
    if (method === "PATCH") {
      const b = await body(req);
      const n = requiredText(
        b?.display_name,
        1,
        MAX_DISPLAY_NAME_LENGTH,
        "Display name is required",
      );
      await db
        .prepare("UPDATE users SET display_name=? WHERE id=? AND disabled=0")
        .bind(n, u.id)
        .run();
      const active = await first(
        db,
        "SELECT id FROM users WHERE id=? AND disabled=0",
        u.id,
      );
      if (!active) throw fail(403, "Account is not available");
      const profile = await first(
        db,
        "SELECT * FROM users WHERE id=? AND disabled=0",
        u.id,
      );
      if (!profile) throw fail(403, "Account is not available");
      return json(publicUser(profile));
    }
  }

  return fail(404, "Not found");
}

export function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    display_name: u.display_name,
    role: u.role,
    disabled: !!u.disabled,
  };
}

export async function current(req: Request, env: Env, required = true) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) {
    if (required) throw fail(401, "Authentication required");
    return null;
  }
  const u = await first(
    env.DB,
    "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?",
    await digest(h.slice(7)),
    now(),
  );
  if (!u || u.disabled) {
    if (required) throw fail(401, "Session is invalid");
    return null;
  }
  return u;
}

export async function admin(req: Request, env: Env) {
  const u = await current(req, env);
  if (u.role !== "admin") throw fail(403, "Admin access required");
  return u;
}
