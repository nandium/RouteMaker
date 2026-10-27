import { ApiError, errorMessage, type FetchJsonInit, fetchJson } from '../src/http.js';
import { clearSession, storedSession } from './session.js';

export { ApiError, errorMessage };

export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;

/**
 * Same-origin API call. If the server rejects the stored session's own token (it has expired),
 * the session is forgotten; a rejected stale token cannot sign out a newer session.
 */
export async function browserRequest<T>(path: string, options: FetchJsonInit = {}): Promise<T> {
  try {
    return await fetchJson<T>(fetch, `/api${path}`, options);
  } catch (error) {
    if (isUnauthorized(error) && options.token && options.token === storedSession()) {
      clearSession();
    }
    throw error;
  }
}
