import type { Env } from './env';
import { fail } from './http';

// The Firebase Identity Toolkit REST calls the Worker makes, as typed functions.
// Firebase owns passwords, verification mail and reset mail; the Worker owns profiles and sessions.

const API = 'https://identitytoolkit.googleapis.com/v1';
const UNAVAILABLE = 'Firebase Authentication is unavailable';
const BAD_LINK = 'This email link is invalid or expired';
export const BAD_CREDENTIALS = 'Email or password is incorrect';
export const ACCOUNT_UNAVAILABLE = 'Account is not available';
export const ALREADY_REGISTERED = 'Email or username is already registered';

// Firebase error codes by meaning; unlisted codes are outages or setup errors.
const ERRORS: Record<string, [status: number, detail: string]> = {
  INVALID_LOGIN_CREDENTIALS: [401, BAD_CREDENTIALS],
  EMAIL_NOT_FOUND: [401, BAD_CREDENTIALS],
  INVALID_PASSWORD: [401, BAD_CREDENTIALS],
  USER_DISABLED: [403, ACCOUNT_UNAVAILABLE],
  EMAIL_EXISTS: [409, ALREADY_REGISTERED],
  INVALID_EMAIL: [422, 'Invalid email'],
  WEAK_PASSWORD: [422, 'Password is too weak'],
  EXPIRED_OOB_CODE: [422, BAD_LINK],
  INVALID_OOB_CODE: [422, BAD_LINK],
  TOO_MANY_ATTEMPTS_TRY_LATER: [429, 'Too many attempts, try again later'],
};

type FirebaseReply = {
  localId?: string;
  idToken?: string;
  email?: string;
  users?: { emailVerified?: boolean }[];
  error?: { message?: string };
};

/** POST to Identity Toolkit. Errors whose code is in `ignore` yield an empty response. */
async function call(
  env: Env,
  endpoint: string,
  payload: Record<string, unknown>,
  ignore: string[] = []
): Promise<FirebaseReply> {
  const key = env.FIREBASE_API_KEY?.trim();
  if (!key) throw fail(503, 'Firebase Authentication is not configured');
  const response = await fetch(`${API}/${endpoint}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    throw fail(503, UNAVAILABLE);
  });
  const data = await response.json<FirebaseReply>().catch((): FirebaseReply => ({}));
  if (response.ok) return data;
  // Some codes carry a detail suffix: "WEAK_PASSWORD : Password should be ...".
  const code = String(data.error?.message ?? '').split(' : ')[0];
  if (ignore.includes(code)) return {};
  const known = ERRORS[code];
  if (!known) console.error('firebase', endpoint, code);
  const [status, detail] = known ?? [503, UNAVAILABLE];
  throw fail(status, detail);
}

/** A Firebase account: its id (also the Worker's user id) and a token to act on it. */
type Identity = { localId: string; idToken: string };

function identityOf({ localId, idToken }: FirebaseReply): Identity {
  if (!localId || !idToken) throw fail(503, UNAVAILABLE);
  return { localId, idToken };
}

export async function signUp(env: Env, email: string, password: string) {
  const response = await call(env, 'accounts:signUp', { email, password, returnSecureToken: true });
  return identityOf(response);
}

export async function signIn(env: Env, email: string, password: string) {
  const response = await call(env, 'accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  return identityOf(response);
}

export async function isEmailVerified(env: Env, idToken: string) {
  const { users } = await call(env, 'accounts:lookup', { idToken });
  return !!users?.[0]?.emailVerified;
}

export async function sendVerification(env: Env, idToken: string) {
  await call(env, 'accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken });
}

/** Unknown addresses succeed silently, so this cannot be used to find accounts. */
export async function sendPasswordReset(env: Env, email: string) {
  const payload = { requestType: 'PASSWORD_RESET', email };
  await call(env, 'accounts:sendOobCode', payload, ['EMAIL_NOT_FOUND', 'INVALID_EMAIL']);
}

/** Complete the link in a verification email. */
export async function confirmEmail(env: Env, oobCode: string) {
  const { localId } = await call(env, 'accounts:update', { oobCode });
  if (!localId) throw fail(422, BAD_LINK);
}

/** Complete the link in a reset email; returns the account's email. */
export async function resetPassword(env: Env, oobCode: string, newPassword: string) {
  const { email } = await call(env, 'accounts:resetPassword', { oobCode, newPassword });
  if (!email) throw fail(422, BAD_LINK);
  return email.toLowerCase();
}

export async function deleteIdentity(env: Env, idToken: string) {
  await call(env, 'accounts:delete', { idToken });
}
