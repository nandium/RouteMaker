import { STORAGE_KEYS } from '../src/client-contract.js';
import { deleteStorage } from './storage.js';

class BrowserApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'BrowserApiError';
  }
}

type BrowserRequestOptions = RequestInit & {
  token?: string | null;
  clearSessionOnUnauthorized?: boolean;
};

type ErrorPayload = { detail?: unknown; message?: unknown };

function errorMessage(payload: ErrorPayload, status: number) {
  if (typeof payload.detail === 'string' && payload.detail) return payload.detail;
  if (typeof payload.message === 'string' && payload.message) return payload.message;
  return `Request failed (${status})`;
}

/** Fetch the browser-host API and apply one consistent response/error policy. */
export async function browserRequest<T>(
  path: string,
  options: BrowserRequestOptions = {}
): Promise<T> {
  const { token, clearSessionOnUnauthorized = true, ...init } = options;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...init, headers });
  let payload: unknown;
  try {
    payload = response.status === 204 ? undefined : await response.json();
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    if (response.status === 401 && clearSessionOnUnauthorized) {
      deleteStorage(STORAGE_KEYS.session);
    }
    const message =
      payload && typeof payload === 'object'
        ? errorMessage(payload as ErrorPayload, response.status)
        : `Request failed (${response.status})`;
    throw new BrowserApiError(message, response.status);
  }
  return payload as T;
}
