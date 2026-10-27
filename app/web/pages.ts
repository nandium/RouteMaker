import { parseWebPage, WEB_PATHS } from '../src/web-pages.js';

/** An email-action address whose code is gone: the code leaves the address bar on load. */
type UsedLinkPage = { name: 'used-link' };

export type WebPage = NonNullable<ReturnType<typeof parseWebPage>> | UsedLinkPage;

/**
 * Pages the browser tools render instead of the Lynx bundle, and the one path each is served
 * at. _headers gives exactly these paths their strict security policy, so they must only ever
 * run there, and nothing else may.
 */
const TOOL_PATHS = {
  'gym-map': WEB_PATHS.gymMap,
  'new-route': WEB_PATHS.newRoute,
  'auth-action': WEB_PATHS.authAction,
  'used-link': WEB_PATHS.authAction,
} as const;

export type ToolPage = Extract<WebPage, { name: keyof typeof TOOL_PATHS }>;

export const isToolPage = (page: WebPage): page is ToolPage => page.name in TOOL_PATHS;

export const toolPath = (page: ToolPage) => TOOL_PATHS[page.name];

/** The site's name in tab titles, as index.html has it. */
const SITE_NAME = 'RouteMaker';

/** What the browser tab and history entry call a page. */
function pageName(page: WebPage) {
  switch (page.name) {
    case 'gyms':
      return 'Gyms';
    case 'gym':
      return 'Gym';
    case 'feed':
      return page.following ? 'Following' : 'Feed';
    case 'route':
      return 'Route';
    case 'profile':
      return `@${page.username}`;
    case 'login':
      return 'Sign in';
    case 'signup':
      return 'Create account';
    case 'forgot-password':
      return 'Reset password';
    case 'account':
      return 'Account';
    case 'admin':
      return 'Admin';
    case 'gym-map':
      return 'Gym map';
    case 'new-route':
      return 'Add a route';
    case 'auth-action':
      return page.mode === 'verifyEmail' ? 'Verify your email' : 'Choose a new password';
    case 'used-link':
      return 'Link already used';
  }
}

export const showTitle = (page: WebPage) => {
  document.title = `${pageName(page)} · ${SITE_NAME}`;
};

/** Title the tab for whatever page the address bar shows now (the app moves it on its own). */
export function showTitleForAddress() {
  const page = parseWebPage(location.pathname, location.search);
  if (page) showTitle(page);
}
