import {
  type ReactNode,
  useEffect,
  useLynxGlobalEventListener,
  useRef,
  useState,
} from '@lynx-js/react';

import { absoluteUrl, api } from '../../api.js';
import { HANDOFF_FRAGMENT_KEY } from '../../client-contract.js';
import { HOST_EVENTS, type ThemePreference } from '../../host-contract.js';
import { appearance, hostProps, navigation } from '../../host.js';
import { errorMessage } from '../../http.js';
import { type Page, pathOf } from '../../web-pages.js';
import { type AppContextValue, AppContext, type Notice } from './app-context.js';
import { guard } from './guard.js';
import { HOME, useRouter } from './hooks/useRouter.js';
import { useSession } from './hooks/useSession.js';
import './base.css';
import { Shell } from './Shell.js';

/** Owns the state every screen shares: session, navigation, notice, and theme. */
export function App() {
  const props = hostProps();
  const [themePreference, setThemePreference] = useState<ThemePreference>(props.themePreference);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sheet, setSheet] = useState<ReactNode>(null);
  const [working, setWorking] = useState(false);
  const busy = useRef(false);

  const deviceScheme = props.systemTheme === 'dark' ? 'dark' : 'light';
  const colorScheme = themePreference === 'system' ? deviceScheme : themePreference;
  const notify: AppContextValue['notify'] = (kind, text, retry) => setNotice({ kind, text, retry });
  const session = useSession(notify);
  const router = useRouter(props.initialPage ?? HOME, (page) =>
    session.ready ? guard(page, session.auth !== null) : page
  );

  // Where the host owns system Back (Android), it must be told whether Back has anything to do.
  const backable = router.canGoBack || sheet !== null;
  useEffect(() => {
    navigation.setCanGoBack(backable);
  }, [backable]);

  // A sheet belongs to the page it was opened on, however the page came to change: a visitor's
  // navigation, the browser's Back, or a session ending under it.
  const path = pathOf(router.page);
  useEffect(() => setSheet(null), [path]);

  // Navigating dismisses the notice; notify after navigating to keep one.
  const go: AppContextValue['go'] = (page, mode = 'push') => {
    setNotice(null);
    if (mode !== 'replace' && pathOf(page) === pathOf(router.page)) return;
    router.go(page, mode);
  };
  const back = () => {
    setNotice(null);
    // Back closes a sheet before it leaves the page.
    if (sheet) setSheet(null);
    else router.back();
  };
  useLynxGlobalEventListener(HOST_EVENTS.back.name, back);
  useLynxGlobalEventListener(HOST_EVENTS.page.name, (page: Page) => {
    setNotice(null);
    router.adopt(page);
  });

  // Anything that calls the API or a host module and is handed to a component as a prop, like
  // this, starts with 'background only'. The compiler infers that only for handlers bound
  // directly to elements; without it, the body would ship in the main-thread bundle as well.
  const run: AppContextValue['run'] = async (work) => {
    'background only';
    if (busy.current) return undefined;
    busy.current = true;
    setWorking(true);
    setNotice(null);
    try {
      return await work();
    } catch (error) {
      if (!session.sessionExpired(error)) notify('error', errorMessage(error));
      return undefined;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  };

  const app: AppContextValue = {
    colorScheme,
    themePreference,
    setThemePreference(preference) {
      'background only';
      setThemePreference(preference);
      appearance.save(preference);
    },
    wideLayout: Boolean(props.wideLayout),
    fontScale: props.fontScale ?? 1,
    reducedMotion: Boolean(props.reducedMotion),
    auth: session.auth,
    signIn: session.signIn,
    signOut: session.signOut,
    setUser: session.setUser,
    sessionExpired: session.sessionExpired,
    go,
    back,
    notify,
    working,
    run,
    openSheet: setSheet,
    closeSheet: () => setSheet(null),
    async openInBrowser(path, label, { replace = false } = {}) {
      'background only';
      await run(async () => {
        const url = absoluteUrl(path);
        // The browser is another app with its own storage: pass it this session as a one-time
        // code in the URL fragment, which never reaches a server. Without one, it asks to sign in.
        // (The web host shares the browser's session, so it needs none.)
        const code =
          session.auth && !props.webHost
            ? await api.handoff(session.auth.token).then(
                (handoff) => handoff.code,
                () => null
              )
            : null;
        const opened = await navigation.openExternal(
          code ? `${url}#${HANDOFF_FRAGMENT_KEY}=${code}` : url,
          replace
        );
        if (!opened) notify('error', `Could not open the ${label}. Try again.`);
      });
    },
  };

  return (
    <AppContext.Provider value={app}>
      <Shell
        page={router.page}
        // Identity-dependent screens wait for the saved session to be confirmed.
        waiting={!session.ready && router.page.name !== 'gyms'}
        working={working}
        notice={notice}
        sheet={sheet}
        dismiss={() => setNotice(null)}
      />
    </AppContext.Provider>
  );
}
