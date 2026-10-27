import { loginPath, parseWebPage, WEB_PATHS } from '../src/web-pages.js';
import { button, textElement } from './dom.js';
import { loadDisplayFont } from './fonts.js';
import { signInFromApp, takeHandoffCode } from './handoff.js';
import { stampHistory } from './host-actions.js';
import { isToolPage, toolPath, type WebPage } from './pages.js';
import { storedSession } from './session.js';
import { followSystemTheme } from './theme.js';
import './web.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

/** True for /auth/action in any spelling: parsing fails once the email-link code is gone. */
const isAuthActionPath = () => location.pathname.replace(/\/+$/, '') === WEB_PATHS.authAction;

/**
 * The page to show and the URL to show it at, normalised. Null when this document is the wrong
 * one and a navigation has started instead.
 *
 * Tool pages and Lynx pages are served with different security headers, which only a real
 * navigation picks up. So a URL is rewritten in place only within the same kind of page.
 */
function bootPage(): { page: WebPage; url: string } | null {
  const parsed = parseWebPage(location.pathname, location.search);
  const page: WebPage | null = parsed ?? (isAuthActionPath() ? { name: 'used-link' } : null);
  if (!page) {
    location.replace(WEB_PATHS.gyms);
    return null;
  }
  if (page.name === 'new-route' && !storedSession()) {
    location.replace(loginPath(location.pathname + location.search));
    return null;
  }
  if (isToolPage(page)) {
    if (location.pathname !== toolPath(page)) {
      location.replace(toolPath(page) + location.search);
      return null;
    }
    // The email-link code is single-use; keep it out of history and referrers.
    return { page, url: page.name === 'auth-action' ? toolPath(page) : location.href };
  }
  return { page, url: location.pathname === WEB_PATHS.root ? WEB_PATHS.gyms : location.href };
}

function showLoadFailure() {
  const reload = button('Reload');
  reload.onclick = () => location.reload();
  app.replaceChildren(textElement('p', 'This page could not load.'), reload);
}

async function start() {
  followSystemTheme();
  // Settled first: whether a session exists decides which page opens.
  const code = takeHandoffCode();
  if (code) await signInFromApp(code);
  const boot = bootPage();
  if (!boot) return;
  const { page, url } = boot;
  stampHistory(url);
  void loadDisplayFont();

  // Each kind of page loads only its own code: tool pages never need the Lynx runtime.
  try {
    if (isToolPage(page)) {
      const { mountToolPage } = await import('./tools.js');
      await mountToolPage(app, page);
    } else {
      const { mountLynxHost } = await import('./lynx-host.js');
      mountLynxHost(app, page);
    }
  } catch {
    showLoadFailure();
  }
}

void start();
