import { loginPath } from '../src/web-pages.js';
import { deleteStorage, readStorage, STORAGE_KEYS, writeStorage } from './storage.js';

export const storedSession = () => readStorage(STORAGE_KEYS.session);
export const saveSession = (token: string) => writeStorage(STORAGE_KEYS.session, token);

/** Forget the token (signed out, or it expired). A draft route stays: it belongs to its owner. */
export const clearSession = () => deleteStorage(STORAGE_KEYS.session);

/** Send the visitor to sign in and back to this page, query included (e.g. the chosen gym). */
export const redirectToLogin = () =>
  location.assign(loginPath(location.pathname + location.search));
