import type { ShareResult } from '../src/host-contract.js';
import { WEB_PATHS } from '../src/web-pages.js';

const DEPTH_KEY = 'routeMakerDepth';

/** How many in-app screens deep this history entry is. It lives in the entry, so it survives reloads. */
export function historyDepth(): number {
  const depth = history.state?.[DEPTH_KEY];
  return typeof depth === 'number' ? depth : 0;
}

function withDepth(depth: number) {
  const state = history.state && typeof history.state === 'object' ? history.state : {};
  return { ...state, [DEPTH_KEY]: depth };
}

/** Rewrite the current entry to `url` and record its depth. */
export function stampHistory(url: string) {
  history.replaceState(withDepth(historyDepth()), '', url);
}

/**
 * Same-origin path (with query and hash) for a string supplied by the Lynx app, else null.
 * Parsing rejects `//host` and `/\host`; the result is checked too, because normalising
 * `/.//host` leaves a path that browsers read as cross-origin.
 */
export function safePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  try {
    const url = new URL(raw, location.origin);
    const path = url.pathname + url.search + url.hash;
    return url.origin === location.origin && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}

export function pushPath(raw: unknown) {
  const path = safePath(raw);
  if (path) history.pushState(withDepth(historyDepth() + 1), '', path);
}

export function replacePath(raw: unknown) {
  const path = safePath(raw);
  if (path) history.replaceState(withDepth(historyDepth()), '', path);
}

export function goBack(fallback: unknown) {
  if (historyDepth() > 0) history.back();
  else location.replace(safePath(fallback) ?? WEB_PATHS.gyms);
}

/** Navigate to a page on this site, as the native hosts do; returns whether navigation started. */
export function openExternal(raw: unknown, replace: unknown): boolean {
  if (typeof raw !== 'string') return false;
  let url: URL;
  try {
    url = new URL(raw, location.origin);
  } catch {
    return false;
  }
  if (url.origin !== location.origin) return false;
  if (replace === true) location.replace(url.href);
  else location.assign(url.href);
  return true;
}

export async function sharePage(rawUrl: unknown, rawTitle: unknown): Promise<ShareResult> {
  if (typeof rawUrl !== 'string') return 'unavailable';
  const title = typeof rawTitle === 'string' ? rawTitle : 'RouteMaker route';
  let url: string;
  try {
    url = new URL(rawUrl, location.origin).href;
  } catch {
    return 'unavailable';
  }
  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
      return 'shared';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}
