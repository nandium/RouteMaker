import '@lynx-js/web-core/client';
import type { LynxViewElement } from '@lynx-js/web-core/client';
import type { GlobalProps } from '@lynx-js/types';
import { isThemePreference } from '../src/host-contract.js';
import webOnlyCss from '../src/pages/main/web-only.css?raw';
import { type Page, parseWebPage } from '../src/web-pages.js';
import { goBack, openExternal, pushPath, replacePath, sharePage } from './host-actions.js';
import { manageModalFocus } from './modal-focus.js';
import { isToolPage, showTitleForAddress } from './pages.js';
import { clearSession, saveSession, storedSession } from './session.js';
import { chooseTheme, savedTheme, systemScheme } from './theme.js';

/** Keep in step with the `min-width` breakpoint in tools.css. */
const WIDE_LAYOUT_MIN_WIDTH = 760;

/** NativeModules the browser provides; RouteMakerMap is deliberately absent (the app falls back). */
const MODULES: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  RouteMakerSession: {
    getToken: () => storedSession() ?? '',
    setToken: (token) => {
      if (typeof token === 'string') saveSession(token);
    },
    clearToken: clearSession,
  },
  RouteMakerAppearance: {
    setPreference: (preference) => {
      if (isThemePreference(preference)) chooseTheme(preference);
    },
  },
  RouteMakerShare: { share: sharePage },
  RouteMakerNavigation: {
    push: (path) => {
      pushPath(path);
      showTitleForAddress();
    },
    replace: (path) => {
      replacePath(path);
      showTitleForAddress();
    },
    back: goBack,
    openExternal,
  },
};

/**
 * Source of a module that runs inside web-core's worker. Each method forwards its arguments to
 * the host and passes the host's answer to the callback the app supplied as the last argument.
 */
export function moduleSource(methodNames: string[]) {
  return `export default (_, callHost) => {
  const module = {};
  for (const name of ${JSON.stringify(methodNames)}) {
    module[name] = (...args) => {
      const callback = typeof args.at(-1) === 'function' ? args.pop() : undefined;
      const result = callHost(name, args);
      if (callback) result.then(callback);
    };
  }
  return module;
};`;
}

export function callHost(name: string, args: unknown, moduleName: string) {
  const method = MODULES[moduleName]?.[name];
  if (!method) return { code: -1, msg: 'Unsupported browser bridge method' };
  return method(...(Array.isArray(args) ? args : []));
}

const moduleUrl = (methodNames: string[]) =>
  URL.createObjectURL(new Blob([moduleSource(methodNames)], { type: 'text/javascript' }));

/** Enter/Space do not activate Lynx Web views that carry role="button". */
function activateButton(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'button') return;
  event.preventDefault();
  target.click();
}

/** `injectStyleRules` takes one rule per entry. */
function styleRules(css: string) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return Array.from(sheet.cssRules, (rule) => rule.cssText);
}

export function mountLynxHost(app: HTMLElement, initialPage: Page) {
  const wideLayout = matchMedia(`(min-width: ${WIDE_LAYOUT_MIN_WIDTH}px)`);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const view = document.createElement('lynx-view') as LynxViewElement;
  // The engine replaces its stored props on every update, so each send is the whole, current
  // set: nothing is remembered from mount time, and a changed preference is never overwritten.
  const send = () => {
    const props: GlobalProps = {
      apiBaseUrl: location.origin,
      initialPage,
      webHost: true,
      wideLayout: wideLayout.matches,
      themePreference: savedTheme() ?? 'system',
      systemTheme: systemScheme(),
      // The browser scales text itself (zoom, minimum font size), so the app adds nothing.
      fontScale: 1,
      reducedMotion: reducedMotion.matches,
    };
    view.updateGlobalProps(props as unknown as LynxViewElement['globalProps']);
  };

  view.setAttribute('url', '/main.web.bundle');
  send();
  view.injectStyleRules = styleRules(webOnlyCss);
  view.nativeModulesMap = Object.fromEntries(
    Object.entries(MODULES).map(([name, methods]) => [name, moduleUrl(Object.keys(methods))])
  );
  view.onNativeModulesCall = callHost;
  view.addEventListener('keydown', activateButton);
  app.append(view);
  showTitleForAddress();
  // The app's sheets are dialogs; the browser needs help to treat them as modal. A sheet closes
  // on Back, as it does on Android. The quoted event name is what scripts/check-client-contract.mjs
  // looks for, as with 'routemaker:page' below.
  if (view.shadowRoot) {
    manageModalFocus(view.shadowRoot, () => view.sendGlobalEvent('routemaker:back', []));
  }

  for (const query of [wideLayout, reducedMotion, matchMedia('(prefers-color-scheme: dark)')]) {
    query.addEventListener('change', send);
  }
  // Back/forward: the app swaps pages itself; anything else needs a fresh load.
  window.addEventListener('popstate', () => {
    const page = parseWebPage(location.pathname, location.search);
    // The quoted event name is what scripts/check-client-contract.mjs looks for.
    if (page && !isToolPage(page)) {
      view.sendGlobalEvent('routemaker:page', [page]);
      showTitleForAddress();
    } else {
      location.reload();
    }
  });
}
