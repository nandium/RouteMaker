import '@lynx-js/web-core/client';
import {
  THEME_CHANGE_EVENT,
  isThemePreference,
  resolveColorScheme,
  type ColorScheme,
  type ThemePreference,
} from '../src/appearance.js';
import { BRAND_PALETTE, logoMarkSvg } from '../src/brand.js';
import {
  APP_NAME,
  LAYOUT_CHANGE_EVENT,
  STORAGE_KEYS,
  SYSTEM_THEME_EVENT,
} from '../src/client-contract.js';
import { iconColor, iconSvg, type IconName, type IconTone } from '../src/icons.js';
import { loginPath, parseWebRoute, WEB_PATHS, type AppRoute } from '../src/web-routes.js';
import { deleteStorage, readStorage, writeStorage } from './storage.js';
import './tools.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const HISTORY_DEPTH = 'routeMakerDepth';
const historyDepth = () =>
  typeof history.state?.[HISTORY_DEPTH] === 'number' ? history.state[HISTORY_DEPTH] : 0;
const historyState = (depth: number) => ({
  ...(history.state && typeof history.state === 'object' ? history.state : {}),
  [HISTORY_DEPTH]: depth,
});
let currentRoute = parseWebRoute(location.pathname, location.search);
if (!currentRoute || location.pathname === WEB_PATHS.root) {
  currentRoute ??= { name: 'gyms' };
  history.replaceState(historyState(historyDepth()), '', WEB_PATHS.gyms);
} else {
  history.replaceState(historyState(historyDepth()), '', location.href);
}
if (currentRoute.name === 'new-route' && !readStorage(STORAGE_KEYS.session)) {
  const path = loginPath(WEB_PATHS.newRoute);
  currentRoute = { name: 'login', next: WEB_PATHS.newRoute };
  location.replace(path);
}
const tool =
  currentRoute.name === 'gym-map' ? 'map' : currentRoute.name === 'new-route' ? 'editor' : null;
const action = currentRoute.name === 'auth-action' ? currentRoute : null;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const WIDE_LAYOUT_BREAKPOINT = 760;

function savedTheme(): ThemePreference | null {
  const value = readStorage(STORAGE_KEYS.theme);
  return isThemePreference(value) ? value : null;
}

function currentSystemTheme(): ColorScheme {
  return systemTheme.matches ? 'dark' : 'light';
}

function showTheme(preference: ThemePreference | null) {
  const scheme = resolveColorScheme(preference, currentSystemTheme());
  document.documentElement.dataset.theme = scheme;
  document.documentElement.classList.toggle('theme-light', scheme === 'light');
  document.documentElement.classList.toggle('theme-dark', scheme === 'dark');
  document.documentElement.style.colorScheme = scheme;
  document.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function chooseTheme(preference: ThemePreference) {
  // The selected theme still applies for this page when storage is blocked.
  writeStorage(STORAGE_KEYS.theme, preference);
  showTheme(preference);
}

showTheme(savedTheme());
let notifySystemThemeChange = () => {};
systemTheme.addEventListener('change', () => {
  if (savedTheme()) return;
  showTheme(null);
  notifySystemThemeChange();
});

function link(label: string, href: string) {
  const anchor = document.createElement('a');
  anchor.textContent = label;
  anchor.href = href;
  return anchor;
}

function bridgeModule(source: string) {
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

const webIcons: Array<{ node: HTMLSpanElement; name: IconName; tone: IconTone }> = [];

function currentTheme(): ColorScheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function paintWebIcons() {
  const scheme = currentTheme();
  for (const item of webIcons) {
    item.node.innerHTML = iconSvg(item.name, iconColor(scheme, item.tone));
  }
}

function icon(name: IconName, className = 'web-icon', tone: IconTone = 'base') {
  const node = document.createElement('span');
  node.className = className;
  node.setAttribute('aria-hidden', 'true');
  webIcons.push({ node, name, tone });
  node.innerHTML = iconSvg(name, iconColor(currentTheme(), tone));
  return node;
}

function enableLynxWebBehavior(
  view: HTMLElement & { sendGlobalEvent(name: string, params: unknown[]): void },
  wideLayout: MediaQueryList
) {
  // Lynx Web strips shared-bundle media queries and does not activate custom views by keyboard.
  void customElements.whenDefined('lynx-view').then(() => {
    requestAnimationFrame(() => {
      const root = view.shadowRoot;
      if (!root) return;
      const syncLayout = () => view.sendGlobalEvent(LAYOUT_CHANGE_EVENT, [wideLayout.matches]);
      syncLayout();
      wideLayout.addEventListener('change', syncLayout);
      root.addEventListener('keydown', (event) => {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') return;
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'button') return;
        keyEvent.preventDefault();
        target.click();
      });
    });
  });
}

if (tool || action) {
  document.body.classList.add('has-web-header');
  const header = document.createElement('header');
  header.className = 'web-header';
  const homeLink = link('', WEB_PATHS.gyms);
  homeLink.className = 'web-header__brand';
  homeLink.setAttribute('aria-label', 'Back to RouteMaker gyms');
  const back = document.createElement('span');
  back.className = 'web-header__back';
  back.append(icon('arrowLeft'));
  const mark = document.createElement('span');
  mark.className = 'web-header__mark';
  const paintMark = () => {
    mark.innerHTML = logoMarkSvg(BRAND_PALETTE[currentTheme()]);
  };
  paintMark();
  const wordmark = document.createElement('span');
  wordmark.textContent = APP_NAME;
  homeLink.append(back, mark, wordmark);
  const headerActions = document.createElement('div');
  headerActions.className = 'web-header__actions';
  if (tool) {
    const nav = document.createElement('nav');
    nav.className = 'web-header__nav';
    const mapLink = link('Gym map', WEB_PATHS.gymMap);
    const editorLink = link('Add route', WEB_PATHS.newRoute);
    mapLink.prepend(icon('map', 'web-icon', tool === 'map' ? 'active' : 'base'));
    editorLink.prepend(icon('plus', 'web-icon', tool === 'editor' ? 'active' : 'base'));
    mapLink.setAttribute('aria-label', 'Gym map');
    editorLink.setAttribute('aria-label', 'Add route');
    if (tool === 'map') mapLink.setAttribute('aria-current', 'page');
    if (tool === 'editor') editorLink.setAttribute('aria-current', 'page');
    nav.append(mapLink, editorLink);
    headerActions.append(nav);
  }
  const themeToggle = document.createElement('button');
  themeToggle.className = 'appearance-toggle';
  themeToggle.type = 'button';
  const sun = icon('sun', 'appearance-toggle__icon', 'sun');
  const track = document.createElement('span');
  track.className = 'appearance-toggle__track';
  const thumb = document.createElement('span');
  thumb.className = 'appearance-toggle__thumb';
  track.append(thumb);
  const moon = icon('moon', 'appearance-toggle__icon', 'moon');
  themeToggle.append(sun, track, moon);
  const syncThemeToggle = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    themeToggle.classList.toggle('appearance-toggle--dark', dark);
    paintMark();
    paintWebIcons();
  };
  syncThemeToggle();
  document.addEventListener(THEME_CHANGE_EVENT, syncThemeToggle);
  themeToggle.addEventListener('click', () => {
    chooseTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  headerActions.append(themeToggle);
  header.append(homeLink, headerActions);
  document.body.prepend(header);
}

if (action) {
  import('./actions.js').then(({ mountAuthAction }) =>
    mountAuthAction(app, action.mode, action.oobCode)
  );
} else if (tool) {
  import('./tools.js').then(({ mountTool }) => mountTool(app, tool));
} else {
  const apiBaseUrl = location.origin;
  const wideLayout = matchMedia(`(min-width: ${WIDE_LAYOUT_BREAKPOINT}px)`);
  const themePreference = savedTheme();
  const initialProps = {
    apiBaseUrl,
    initialRoute: currentRoute as AppRoute,
    webHost: true,
    wideLayout: wideLayout.matches,
    themePreference: themePreference ?? undefined,
    systemTheme: currentSystemTheme(),
  };
  const view = document.createElement('lynx-view') as HTMLElement & {
    globalProps: Record<string, unknown>;
    injectStyleRules: string[];
    nativeModulesMap: Record<string, string>;
    sendGlobalEvent(name: string, params: unknown[]): void;
    onNativeModulesCall: (
      name: string,
      data: {
        preference?: string;
        replace?: boolean;
        token?: string;
        url?: string;
        title?: string;
        path?: string;
      },
      moduleName: string
    ) => unknown;
  };
  notifySystemThemeChange = () => view.sendGlobalEvent(SYSTEM_THEME_EVENT, [currentSystemTheme()]);
  view.setAttribute('url', '/main.web.bundle');
  view.globalProps = initialProps;
  view.injectStyleRules = [
    'x-text { -webkit-user-select: text; user-select: text; }',
    '.pressable:focus { outline-offset: 3px; }',
    '.field__input:focus { outline-offset: 2px; }',
  ];
  view.nativeModulesMap = {
    RouteMakerSession: bridgeModule(
      `export default function(_, callHost) {
            return {
              getToken(callback) {
                callHost('getToken').then(callback);
              },
              setToken(token) {
                callHost('setToken', { token });
              },
              clearToken() {
                callHost('clearToken');
              }
            };
          }`
    ),
    RouteMakerShare: bridgeModule(
      `export default function(_, callHost) {
            return {
              share(url, title, callback) {
                callHost('share', { url, title }).then(callback);
              }
            };
          }`
    ),
    RouteMakerAppearance: bridgeModule(
      `export default function(_, callHost) {
            return {
              setPreference(preference) {
                callHost('setPreference', { preference });
              }
            };
          }`
    ),
    RouteMakerNavigation: bridgeModule(
      `export default function(_, callHost) {
            return {
              push(path) {
                callHost('push', { path });
              },
              replace(path) {
                callHost('replace', { path });
              },
              back(fallbackPath) {
                callHost('back', { path: fallbackPath });
              },
              openExternal(url, replace, callback) {
                callHost('openExternal', { url, replace }).then(callback);
              }
            };
          }`
    ),
  };
  view.onNativeModulesCall = (name, data, moduleName) => {
    if (moduleName === 'RouteMakerSession') {
      if (name === 'getToken') return readStorage(STORAGE_KEYS.session) ?? '';
      if (name === 'setToken' && typeof data.token === 'string') {
        writeStorage(STORAGE_KEYS.session, data.token);
        return;
      }
      if (name === 'clearToken') {
        deleteStorage(STORAGE_KEYS.session);
        return;
      }
    }
    if (moduleName === 'RouteMakerShare' && name === 'share') {
      const url = data.url;
      if (typeof url !== 'string') return;
      const title = typeof data.title === 'string' ? data.title : 'RouteMaker route';
      const shareUrl = new URL(url, location.origin).toString();
      return (async () => {
        try {
          if (typeof navigator.share === 'function') {
            await navigator.share({ title, text: title, url: shareUrl });
            return 'shared';
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            return 'copied';
          }
          return 'unavailable';
        } catch (error) {
          if (
            typeof DOMException !== 'undefined' &&
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            return 'cancelled';
          }
          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(shareUrl);
              return 'copied';
            } catch {
              // The caller reports that sharing is unavailable.
            }
          }
          return 'unavailable';
        }
      })();
    }
    if (moduleName === 'RouteMakerAppearance' && name === 'setPreference') {
      const preference = data.preference;
      if (isThemePreference(preference)) chooseTheme(preference);
      return;
    }
    if (moduleName === 'RouteMakerNavigation') {
      if (name === 'openExternal') {
        if (typeof data.url !== 'string') return false;
        let url: URL;
        try {
          url = new URL(data.url, location.origin);
        } catch {
          return false;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        if (data.replace === true) location.replace(url);
        else location.assign(url);
        return true;
      }
      if (name === 'back') {
        const fallback = data.path;
        if (historyDepth() > 0) history.back();
        else if (
          typeof fallback === 'string' &&
          fallback.startsWith('/') &&
          !fallback.startsWith('//')
        )
          location.replace(fallback);
        else location.replace(WEB_PATHS.gyms);
        return;
      }
      const path = data.path;
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return;
      if (name === 'push') history.pushState(historyState(historyDepth() + 1), '', path);
      if (name === 'replace') history.replaceState(historyState(historyDepth()), '', path);
      return;
    }
    return { code: -1, msg: 'Unsupported browser bridge method' };
  };
  view.style.height = '100%';
  view.style.width = '100%';
  app.append(view);
  enableLynxWebBehavior(view, wideLayout);
  addEventListener('popstate', () => location.reload());
}
