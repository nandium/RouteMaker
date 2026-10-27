import { vi } from 'vitest';

type Account = {
  localId: string;
  password: string;
  idToken: string;
  emailVerified: boolean;
};

export const verifyCode = (email: string) => `verify:${email}`;
export const resetCode = (email: string) => `reset:${email}`;

const accounts = new Map<string, Account>();
const emailByToken = new Map<string, string>();
/** Endpoints called, in order. */
const calls: string[] = [];
/** Endpoint -> Firebase error message for its next call only. */
const failures = new Map<string, string>();
/** Endpoint -> side effect to run just before its next call is handled. */
const hooks = new Map<string, () => Promise<unknown>>();

const reply = (status: number, value: unknown) => Response.json(value, { status });
const error = (message: string) => reply(400, { error: { message } });

async function handle(input: RequestInfo | URL, init?: RequestInit) {
  const endpoint = new URL(String(input)).pathname.split('/').at(-1)!;
  const payload = init?.body ? JSON.parse(String(init.body)) : {};
  calls.push(endpoint);
  await hooks.get(endpoint)?.();
  hooks.delete(endpoint);
  const failure = failures.get(endpoint);
  if (failure) {
    failures.delete(endpoint);
    return error(failure);
  }
  const email = String(payload.email ?? emailByToken.get(payload.idToken) ?? '').toLowerCase();
  const account = accounts.get(email);
  switch (endpoint) {
    case 'accounts:signUp': {
      if (account) return error('EMAIL_EXISTS');
      const localId = `firebase-${crypto.randomUUID()}`;
      const idToken = `token-${localId}`;
      accounts.set(email, {
        localId,
        idToken,
        password: payload.password,
        emailVerified: false,
      });
      emailByToken.set(idToken, email);
      return reply(200, { localId, idToken });
    }
    case 'accounts:signInWithPassword':
      return account && account.password === payload.password
        ? reply(200, { localId: account.localId, idToken: account.idToken })
        : error('INVALID_LOGIN_CREDENTIALS');
    case 'accounts:lookup':
      return account
        ? reply(200, {
            users: [
              {
                localId: account.localId,
                emailVerified: account.emailVerified,
              },
            ],
          })
        : error('INVALID_ID_TOKEN');
    case 'accounts:sendOobCode':
      return payload.requestType === 'PASSWORD_RESET' && !account
        ? error('EMAIL_NOT_FOUND')
        : reply(200, {});
    case 'accounts:update':
    case 'accounts:resetPassword': {
      const [kind, codeEmail] = String(payload.oobCode).split(':');
      const target = accounts.get(codeEmail ?? '');
      const expected = endpoint === 'accounts:update' ? 'verify' : 'reset';
      if (kind !== expected || !target) return error('INVALID_OOB_CODE');
      if (endpoint === 'accounts:update') target.emailVerified = true;
      else target.password = payload.newPassword;
      return reply(200, { localId: target.localId, email: codeEmail });
    }
    case 'accounts:delete':
      accounts.delete(email);
      return reply(200, {});
  }
  return error('UNKNOWN_ENDPOINT');
}

/** In-memory Identity Toolkit covering the REST calls the Worker makes. */
export const firebase = {
  accounts,
  calls,
  /** Make the next call to `endpoint` fail with a Firebase error message. */
  failNext(endpoint: string, message: string) {
    failures.set(endpoint, message);
  },
  /** Run `action` just before the next call to `endpoint`, to stage a race. */
  beforeNext(endpoint: string, action: () => Promise<unknown>) {
    hooks.set(endpoint, action);
  },
  verify(email: string) {
    accounts.get(email.toLowerCase())!.emailVerified = true;
  },
  /** Forget everything and route fetch to the fake. */
  reset() {
    accounts.clear();
    emailByToken.clear();
    calls.length = 0;
    failures.clear();
    hooks.clear();
    vi.stubGlobal('fetch', handle);
  },
};
