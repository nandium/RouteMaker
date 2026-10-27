import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callHost, moduleSource, mountLynxHost } from './lynx-host.js';
import { STORAGE_KEYS } from './storage.js';
import { installDom, stubMatchMedia, stubNavigation } from './test-dom.js';
import { chooseTheme, currentScheme } from './theme.js';

vi.mock('@lynx-js/web-core/client', () => ({}));
// Vitest blanks stylesheets, even with ?raw.
vi.mock('../src/pages/main/web-only.css?raw', () => ({
  default: '.pressable { cursor: pointer; } x-text { user-select: text; }',
}));

type FakeLynxView = HTMLElement & {
  globalProps: unknown;
  injectStyleRules: string[];
  nativeModulesMap: Record<string, string>;
  updateGlobalProps: ReturnType<typeof vi.fn>;
  sendGlobalEvent: ReturnType<typeof vi.fn>;
};

/** Just enough of constructable stylesheets to split a stylesheet into its rules. */
class FakeStyleSheet {
  cssRules: Array<{ cssText: string }> = [];
  replaceSync(css: string) {
    this.cssRules = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((rule) => rule.trim())
      .filter(Boolean)
      .map((rule) => ({ cssText: `${rule} }` }));
  }
}

function setup(
  options: {
    saved?: Record<string, string>;
    dark?: boolean;
    wide?: boolean;
    reducedMotion?: boolean;
  } = {}
) {
  const dom = installDom('http://localhost/gyms');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:module');
  vi.stubGlobal('CSSStyleSheet', FakeStyleSheet);
  const media = stubMatchMedia({
    dark: options.dark ?? false,
    'min-width': options.wide ?? false,
    'reduced-motion': options.reducedMotion ?? false,
  });
  for (const [key, value] of Object.entries(options.saved ?? {})) localStorage.setItem(key, value);
  dom.customElements.define(
    'lynx-view',
    class extends dom.HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }
      globalProps: unknown;
      injectStyleRules: string[] = [];
      nativeModulesMap: Record<string, string> = {};
      updateGlobalProps = vi.fn((props: unknown) => {
        this.globalProps = props;
      });
      sendGlobalEvent = vi.fn();
    }
  );
  const app = document.createElement('div');
  document.body.append(app);
  return { media, app };
}

const lastView = (app: HTMLElement) => app.querySelector('lynx-view') as FakeLynxView;

describe('Lynx host', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts the bundle with the host props and web-only styles', async () => {
    const { app } = setup({ saved: { [STORAGE_KEYS.theme]: 'dark' }, wide: true });

    mountLynxHost(app, { name: 'gyms' });

    const view = lastView(app);
    expect(view.getAttribute('url')).toBe('/main.web.bundle');
    expect(view.globalProps).toEqual({
      apiBaseUrl: 'http://localhost',
      initialPage: { name: 'gyms' },
      webHost: true,
      wideLayout: true,
      themePreference: 'dark',
      systemTheme: 'light',
      fontScale: 1,
      reducedMotion: false,
    });
    expect(view.injectStyleRules).toEqual([
      '.pressable { cursor: pointer; }',
      'x-text { user-select: text; }',
    ]);
    expect(Object.keys(view.nativeModulesMap).sort()).toEqual([
      'RouteMakerAppearance',
      'RouteMakerNavigation',
      'RouteMakerSession',
      'RouteMakerShare',
    ]);
  });

  it('sends the complete props whenever the layout or OS scheme changes', () => {
    const { app, media } = setup();
    mountLynxHost(app, { name: 'feed', following: false });
    const view = lastView(app);

    media.set('min-width', true);
    expect(view.updateGlobalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'http://localhost',
        wideLayout: true,
        systemTheme: 'light',
      })
    );

    media.set('dark', true);
    expect(view.updateGlobalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialPage: { name: 'feed', following: false },
        wideLayout: true,
        systemTheme: 'dark',
      })
    );
  });

  it('keeps sending the OS scheme even when a preference is saved', async () => {
    const { app, media } = setup({ saved: { [STORAGE_KEYS.theme]: 'light' } });
    mountLynxHost(app, { name: 'gyms' });

    media.set('dark', true);

    expect(lastView(app).updateGlobalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ themePreference: 'light', systemTheme: 'dark' })
    );
  });

  it('sends the preference as it is now, not as it was at mount', () => {
    const { app, media } = setup();
    mountLynxHost(app, { name: 'gyms' });
    expect(lastView(app).globalProps).toMatchObject({ themePreference: 'system' });

    chooseTheme('dark');
    media.set('min-width', true);

    expect(lastView(app).updateGlobalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ themePreference: 'dark', wideLayout: true })
    );
  });

  it('follows the reduced-motion setting while the page is open', () => {
    const { app, media } = setup({ reducedMotion: true });
    mountLynxHost(app, { name: 'gyms' });
    expect(lastView(app).globalProps).toMatchObject({ reducedMotion: true, fontScale: 1 });

    media.set('reduced-motion', false);

    expect(lastView(app).updateGlobalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reducedMotion: false,
        fontScale: 1,
        apiBaseUrl: 'http://localhost',
      })
    );
  });

  it('hands history navigation to the app and reloads for non-app pages', async () => {
    const { app } = setup();
    const { reload } = stubNavigation();
    mountLynxHost(app, { name: 'gyms' });
    const view = lastView(app);

    history.pushState(null, '', '/routes/blue');
    window.dispatchEvent(new window.Event('popstate'));
    expect(view.sendGlobalEvent).toHaveBeenCalledWith('routemaker:page', [
      { name: 'route', routeId: 'blue' },
    ]);
    expect(reload).not.toHaveBeenCalled();

    history.pushState(null, '', '/gyms/map');
    window.dispatchEvent(new window.Event('popstate'));
    expect(reload).toHaveBeenCalledOnce();
  });

  describe('page titles', () => {
    it('names the tab for the page the address shows when the app starts', () => {
      const { app } = setup();
      history.replaceState(null, '', '/gyms');

      mountLynxHost(app, { name: 'gyms' });

      expect(document.title).toBe('Gyms · RouteMaker');
    });

    it('follows the app as it moves between pages', () => {
      const { app } = setup();
      mountLynxHost(app, { name: 'gyms' });

      callHost('push', ['/routes/blue'], 'RouteMakerNavigation');
      expect(document.title).toBe('Route · RouteMaker');

      callHost('replace', ['/users/maya'], 'RouteMakerNavigation');
      expect(document.title).toBe('@maya · RouteMaker');
    });

    it('follows Back and Forward', () => {
      const { app } = setup();
      mountLynxHost(app, { name: 'gyms' });

      history.pushState(null, '', '/feed?view=following');
      window.dispatchEvent(new window.Event('popstate'));

      expect(document.title).toBe('Following · RouteMaker');
    });

    it('keeps the title when the app asks to go somewhere that is not a page', () => {
      const { app } = setup();
      mountLynxHost(app, { name: 'gyms' });
      history.replaceState(null, '', '/gyms');
      document.title = 'Gyms · RouteMaker';

      callHost('push', ['https://example.com'], 'RouteMakerNavigation');

      expect(document.title).toBe('Gyms · RouteMaker');
    });
  });

  describe('sheets', () => {
    it('close on Escape the way Back closes them, by telling the app', async () => {
      const { app } = setup();
      mountLynxHost(app, { name: 'gyms' });
      const view = lastView(app);
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const close = document.createElement('div');
      close.setAttribute('tabindex', '0');
      dialog.append(close);
      view.shadowRoot!.append(dialog);
      await new Promise((resolve) => setTimeout(resolve));

      close.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })
      );

      expect(view.sendGlobalEvent).toHaveBeenCalledWith('routemaker:back', []);
    });
  });

  it('activates role="button" views from the keyboard', async () => {
    const { app } = setup();
    mountLynxHost(app, { name: 'gyms' });
    const view = lastView(app);
    const press = document.createElement('div');
    press.setAttribute('role', 'button');
    const clicked = vi.fn();
    press.addEventListener('click', clicked);
    const field = document.createElement('div');
    view.append(press, field);

    for (const target of [press, field]) {
      target.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );
    }
    press.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true })
    );

    expect(clicked).toHaveBeenCalledOnce();
  });
});

describe('native modules', () => {
  beforeEach(() => {
    setup();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('serves the session token through the bridge', () => {
    expect(callHost('getToken', [], 'RouteMakerSession')).toBe('');
    callHost('setToken', ['abc'], 'RouteMakerSession');
    callHost('setToken', [42], 'RouteMakerSession');
    expect(callHost('getToken', [], 'RouteMakerSession')).toBe('abc');
    callHost('clearToken', [], 'RouteMakerSession');
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('applies appearance choices and ignores invalid ones', () => {
    callHost('setPreference', ['purple'], 'RouteMakerAppearance');
    expect(currentScheme()).toBe('light');
    callHost('setPreference', ['dark'], 'RouteMakerAppearance');
    expect(currentScheme()).toBe('dark');
  });

  it('returns to the OS scheme when the preference is "system"', () => {
    callHost('setPreference', ['dark'], 'RouteMakerAppearance');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');

    callHost('setPreference', ['system'], 'RouteMakerAppearance');

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
    expect(currentScheme()).toBe('light');
  });

  it('reports unknown methods and modules the browser does not provide', () => {
    expect(callHost('nope', [], 'RouteMakerSession')).toEqual({
      code: -1,
      msg: 'Unsupported browser bridge method',
    });
    expect(callHost('open', [], 'RouteMakerMap')).toMatchObject({ code: -1 });
  });

  it('generates modules that forward their arguments and a trailing callback', async () => {
    const source = moduleSource(['getToken', 'openExternal']).replace('export default', 'return');
    const factory = new Function(source)() as (
      native: unknown,
      callHost: (name: string, args: unknown[]) => Promise<unknown>
    ) => Record<string, (...args: unknown[]) => void>;
    const host = vi.fn(async (_name: string, _args: unknown[]) => 'result');
    const api = factory({}, host);
    const callback = vi.fn();

    api.getToken(callback);
    api.openExternal('https://example.com', true, callback);
    api.openExternal('https://example.com', false);
    await Promise.resolve();

    expect(host).toHaveBeenNthCalledWith(1, 'getToken', []);
    expect(host).toHaveBeenNthCalledWith(2, 'openExternal', ['https://example.com', true]);
    expect(host).toHaveBeenNthCalledWith(3, 'openExternal', ['https://example.com', false]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith('result');
  });
});
