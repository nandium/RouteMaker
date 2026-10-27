import type { ReactNode } from '@lynx-js/react';

import { type Page, isAuthPage, pathOf } from '../../web-pages.js';
import { type Notice, useApp } from './app-context.js';
import { cx } from './class-names.js';
import { NoticeBar, TabBar, TopBar } from './chrome.js';
import { textSizeClasses } from './text-scale.js';
import { Account } from './screens/Account.js';
import { Admin } from './screens/Admin.js';
import { AuthForm } from './screens/AuthForm.js';
import { Feed } from './screens/Feed.js';
import { GymDetail } from './screens/GymDetail.js';
import { GymList } from './screens/GymList.js';
import { Profile } from './screens/Profile.js';
import { RouteDetail } from './screens/RouteDetail.js';

/**
 * The frame around every screen: top bar, navigation, and the current screen, with the notice and
 * any sheet above them. The root carries the classes the stylesheets key on.
 */
export function Shell({
  page,
  waiting,
  working,
  notice,
  sheet,
  dismiss,
}: {
  page: Page;
  waiting: boolean;
  working: boolean;
  notice: Notice | null;
  sheet: ReactNode;
  dismiss(): void;
}) {
  const { colorScheme, wideLayout, fontScale, reducedMotion } = useApp();
  return (
    <view
      className={cx(
        'app',
        `theme-${colorScheme}`,
        wideLayout && 'wide',
        reducedMotion && 'rm',
        textSizeClasses(fontScale)
      )}
    >
      <TopBar page={page} busy={working || waiting} />
      {/* A new key remounts the screen, resetting scroll and local state. */}
      <scroll-view key={screenKey(page)} className="screen" scroll-orientation="vertical">
        {waiting ? (
          <view
            aria-busy="true"
            aria-label="Loading"
            accessibility-element
            accessibility-label="Loading"
          />
        ) : (
          <Screen page={page} />
        )}
      </scroll-view>
      {!wideLayout && <TabBar page={page} />}
      {sheet}
      <NoticeBar notice={notice} dismiss={dismiss} />
    </view>
  );
}

/** The sign-in modes share a key so what was typed survives switching between them. */
const screenKey = (page: Page) => (isAuthPage(page) ? 'auth' : pathOf(page));

function Screen({ page }: { page: Page }) {
  const { auth } = useApp();
  if (isAuthPage(page)) return <AuthForm mode={page.name} next={page.next} />;
  switch (page.name) {
    case 'gyms':
      return <GymList />;
    case 'gym':
      return <GymDetail gymId={page.gymId} />;
    case 'feed':
      return <Feed following={page.following} />;
    case 'route':
      return <RouteDetail routeId={page.routeId} />;
    case 'profile':
      return <Profile username={page.username} />;
    case 'account':
      return auth && <Account auth={auth} />;
    case 'admin':
      return auth && <Admin auth={auth} />;
  }
}
