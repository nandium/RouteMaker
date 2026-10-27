import type { AuthMessage } from '../../app/src/client-contract';
import { first, isUniqueViolation, now, run } from './db';
import type { Env } from './env';
import {
  ACCOUNT_UNAVAILABLE,
  ALREADY_REGISTERED,
  confirmEmail,
  deleteIdentity,
  isEmailVerified,
  resetPassword as resetFirebasePassword,
  sendPasswordReset,
  sendVerification,
  signIn,
  signUp,
} from './firebase';
import { fail, json, jsonBody } from './http';
import { DISPLAY_NAME_LENGTH, MAIL_PER_ADDRESS } from './limits';
import { type UserRow, createSession, revokeSessionsStmt } from './session';
import { throttle, throttleAuth } from './throttle';
import { emailAddress, oobCode, password, requiredText, username } from './validate';

const INVALID_SIGNUP = 'Invalid signup details';
const INVALID_LOGIN = 'Enter your email and password';
const INVALID_LINK = 'Invalid email link';

export async function signup(req: Request, env: Env) {
  await throttleAuth(req, env);
  const input = await jsonBody(req);
  const email = emailAddress(input.email, INVALID_SIGNUP);
  const passphrase = password(input.password, INVALID_SIGNUP);
  const name = username(input.username, INVALID_SIGNUP);
  const displayName = requiredText(input.display_name, DISPLAY_NAME_LENGTH, INVALID_SIGNUP);
  // Counted before anything else is checked, so retrying a taken address still costs an attempt.
  await throttle(env, `mail:${email}`, MAIL_PER_ADDRESS);

  // Checked first so a taken name never creates and deletes a Firebase identity.
  if (await first(env.DB, 'SELECT 1 FROM users WHERE email = ? OR username = ?', email, name))
    throw fail(409, ALREADY_REGISTERED);
  const { localId, idToken } = await signUp(env, email, passphrase);
  try {
    await run(
      env.DB,
      "INSERT INTO users(id, email, username, display_name, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
      localId,
      email,
      name,
      displayName,
      now()
    );
    await sendVerification(env, idToken);
  } catch (error) {
    // Undo both halves; this also covers losing a race on the check above.
    await run(env.DB, 'DELETE FROM users WHERE id = ?', localId);
    await deleteIdentity(env, idToken).catch(() => undefined);
    throw isUniqueViolation(error) ? fail(409, ALREADY_REGISTERED) : error;
  }
  return json({ message: 'Check your email to verify the account' } satisfies AuthMessage, 201);
}

export async function login(req: Request, env: Env) {
  await throttleAuth(req, env);
  const input = await jsonBody(req);
  const email = emailAddress(input.email, INVALID_LOGIN);
  const passphrase = password(input.password, INVALID_LOGIN);

  const { localId, idToken } = await signIn(env, email, passphrase);
  if (!(await isEmailVerified(env, idToken))) throw fail(403, 'Email address is not verified');
  const user = await first<UserRow>(env.DB, 'SELECT * FROM users WHERE id = ?', localId);
  if (!user) throw fail(503, 'Profile is not available');
  if (user.disabled) throw fail(403, ACCOUNT_UNAVAILABLE);
  // The email is verified, so the account may now appear on the site.
  if (!user.verified) await run(env.DB, 'UPDATE users SET verified = 1 WHERE id = ?', user.id);
  return json(await createSession(env, user));
}

export async function forgotPassword(req: Request, env: Env) {
  await throttleAuth(req, env);
  const email = emailAddress((await jsonBody(req)).email, 'Invalid email');
  await throttle(env, `mail:${email}`, MAIL_PER_ADDRESS);
  await sendPasswordReset(env, email);
  return json({
    message: 'If that account exists, a reset email will be sent',
  } satisfies AuthMessage);
}

export async function verifyEmail(req: Request, env: Env) {
  await throttleAuth(req, env);
  await confirmEmail(env, oobCode((await jsonBody(req)).oob_code, INVALID_LINK));
  return json({ message: 'Email verified. You can now sign in.' } satisfies AuthMessage);
}

export async function resetPassword(req: Request, env: Env) {
  await throttleAuth(req, env);
  const input = await jsonBody(req);
  const code = oobCode(input.oob_code, INVALID_LINK);
  const newPassword = password(input.password, 'Invalid password');
  const email = await resetFirebasePassword(env, code, newPassword);
  // Sessions end only once the emailed code proves ownership; revoking when
  // mail is requested would let anyone log an account out.
  const user = await first<{ id: string }>(env.DB, 'SELECT id FROM users WHERE email = ?', email);
  if (user) await revokeSessionsStmt(env.DB, user.id).run();
  return json({
    message: 'Password changed. Sign in with your new password.',
  } satisfies AuthMessage);
}
