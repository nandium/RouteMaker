import { type Page, WEB_PATHS, isAuthPage } from '../../web-pages.js';

/** The page a visitor may actually see; signed-out visitors are sent to sign in. */
export function guard(page: Page, signedIn: boolean): Page {
  if (isAuthPage(page)) return signedIn ? { name: 'account' } : page;
  switch (page.name) {
    case 'account':
      return signedIn ? page : { name: 'login' };
    case 'admin':
      return signedIn ? page : { name: 'login', next: WEB_PATHS.admin };
    default:
      return page;
  }
}
