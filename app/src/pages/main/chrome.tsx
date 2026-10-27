import { type ReactNode, useEffect } from '@lynx-js/react';

import { APP_NAME } from '../../client-contract.js';
import type { IconName } from '../../icons.js';
import { type Page, isAuthPage } from '../../web-pages.js';
import { type Notice, useApp } from './app-context.js';
import { cx } from './class-names.js';
import { Button, IconButton, LinkButton } from './components/Button.js';
import { BrandMark, Icon } from './components/Icon.js';
import { InitialTile } from './components/InitialTile.js';
import { Pressable } from './components/Pressable.js';
import { Sheet } from './components/Sheet.js';
import { DisplayText, GlyphText } from './components/Text.js';
import { HOME } from './hooks/useRouter.js';
import { Avatar, initialOf } from './parts/Avatar.js';
import { ThemeControl } from './parts/ThemeControl.js';
import './chrome.css';

type Tab = 'gyms' | 'feed' | 'admin' | 'account';

const TABS: Partial<Record<Page['name'], Tab>> = {
  gyms: 'gyms',
  gym: 'gyms',
  feed: 'feed',
  admin: 'admin',
  account: 'account',
};

const tabOf = (page: Page) => (isAuthPage(page) ? 'account' : TABS[page.name]);

const DESTINATIONS: { tab: Exclude<Tab, 'account'>; label: string; icon: IconName; page: Page }[] =
  [
    { tab: 'gyms', label: 'Gyms', icon: 'gyms', page: HOME },
    { tab: 'feed', label: 'Feed', icon: 'feed', page: { name: 'feed', following: false } },
    { tab: 'admin', label: 'Admin', icon: 'admin', page: { name: 'admin' } },
  ];

/** The destinations this visitor may use; moderation is for administrators. */
function useDestinations() {
  const { auth } = useApp();
  return DESTINATIONS.filter(({ tab }) => tab !== 'admin' || auth?.user.role === 'admin');
}

/** The top bar: brand, progress, theme; on wide screens also the navigation and account. */
export function TopBar({ page, busy }: { page: Page; busy: boolean }) {
  const { wideLayout, colorScheme, openSheet } = useApp();
  return (
    <view className="topbar">
      <view
        className="brand"
        accessibility-element
        accessibility-label={APP_NAME}
        aria-label={APP_NAME}
        role="img"
      >
        <BrandMark height={30} />
        <GlyphText className="display wordmark" size={26} leading={28}>
          {APP_NAME}
        </GlyphText>
      </view>
      {wideLayout && <WideNav page={page} />}
      <view className="topbar-spacer" />
      {busy && (
        <text className="busy-text" accessibility-traits="updating">
          Working…
        </text>
      )}
      <IconButton
        icon={colorScheme === 'dark' ? 'sun' : 'moon'}
        label="Appearance"
        onTap={() => openSheet(<AppearanceSheet />)}
      />
      {wideLayout && <AccountChip page={page} />}
      {busy && (
        <view className="busy-line">
          <view className="busy-run" />
        </view>
      )}
    </view>
  );
}

/** Choosing the theme here, as in Account, means a guest can also go back to following the device. */
function AppearanceSheet() {
  const { closeSheet } = useApp();
  return (
    <Sheet title="Appearance">
      <ThemeControl />
      <Button kind="secondary" size="lg" block onTap={closeSheet}>
        Done
      </Button>
    </Sheet>
  );
}

function WideNav({ page }: { page: Page }) {
  const { go } = useApp();
  const destinations = useDestinations();
  const current = tabOf(page);
  return (
    <view className="wide-nav">
      {destinations.map(({ tab, label, page: destination }) => (
        <Pressable
          key={tab}
          className={cx('wide-nav-item', current === tab && 'is-on')}
          label={label}
          selected={current === tab}
          selection="current"
          onTap={() => go(destination, 'reset')}
        >
          <DisplayText className="wide-nav-label" size={22} leading={24}>
            {label}
          </DisplayText>
        </Pressable>
      ))}
    </view>
  );
}

function AccountChip({ page }: { page: Page }) {
  const { auth, go } = useApp();
  const name = auth?.user.username ?? 'Guest';
  return (
    <Pressable
      className={cx('account-chip', tabOf(page) === 'account' && 'is-on')}
      label={auth ? `Account, ${name}` : 'Account, guest, sign in'}
      selected={tabOf(page) === 'account'}
      selection="current"
      onTap={() => go({ name: auth ? 'account' : 'login' }, 'reset')}
    >
      {auth ? <Avatar person={auth.user} size="s" /> : <InitialTile icon="user" size="s" />}
      <text className="t-label">{name}</text>
    </Pressable>
  );
}

/** The bar along the bottom of a compact screen: the destinations and the account. */
export function TabBar({ page }: { page: Page }) {
  const { auth, go } = useApp();
  const destinations = useDestinations();
  const current = tabOf(page);
  const name = auth?.user.username ?? 'Guest';
  return (
    <view className="tabbar" role="navigation" aria-label="Primary">
      {destinations.map(({ tab, label, icon, page: destination }) => (
        <Tab
          key={tab}
          on={current === tab}
          label={label}
          onTap={() => go(destination, 'reset')}
          mark={<Icon name={icon} tone={current === tab ? 'on-nav' : 'on-nav-2'} size={24} />}
        />
      ))}
      <Tab
        on={current === 'account'}
        label={name}
        description={auth ? `Account, ${name}` : 'Account, guest, sign in'}
        onTap={() => go({ name: auth ? 'account' : 'login' }, 'reset')}
        mark={
          auth ? (
            <view className="tab-avatar">
              <GlyphText className="display tab-avatar-initial" size={20} leading={22}>
                {initialOf(auth.user)}
              </GlyphText>
            </view>
          ) : (
            <Icon name="user" tone={current === 'account' ? 'on-nav' : 'on-nav-2'} size={24} />
          )
        }
      />
    </view>
  );
}

function Tab({
  on,
  label,
  description = label,
  mark,
  onTap,
}: {
  on: boolean;
  label: string;
  /** What a screen reader says, when it should say more than the visible label. */
  description?: string;
  mark: ReactNode;
  onTap: () => void;
}) {
  return (
    <Pressable
      className={cx('tab', on && 'is-on')}
      label={description}
      selected={on}
      selection="current"
      onTap={onTap}
    >
      <view className="tab-marker" />
      {mark}
      <GlyphText className="tab-label" size={12} leading={14} lines={1}>
        {label}
      </GlyphText>
    </Pressable>
  );
}

/** How long a success stays: a moment, and longer when there is more to read. */
export const noticeDuration = (text: string) =>
  Math.min(12_000, Math.max(4000, 2500 + 50 * text.length));

/**
 * One message, floating under the top bar so that showing it moves nothing. The slot is always
 * there, as a live region whose content changes, so that a screen reader on the web speaks each
 * message; native screen readers are told directly. A failure stays until it is dismissed.
 */
export function NoticeBar({ notice, dismiss }: { notice: Notice | null; dismiss(): void }) {
  useEffect(() => {
    if (!notice) return;
    lynx.accessibilityAnnounce?.({ content: notice.text });
    if (notice.kind === 'error') return;
    const timer = setTimeout(dismiss, noticeDuration(notice.text));
    return () => clearTimeout(timer);
  }, [notice]);

  const failed = notice?.kind === 'error';
  return (
    <view className="notice-slot" role="status" aria-live="polite">
      {notice && (
        <view className={cx('notice', failed ? 'is-error' : 'is-success')}>
          <Icon name={failed ? 'alert' : 'check-circle'} tone={failed ? 'danger' : 'success'} />
          <view className="notice-body">
            <text
              className="notice-text"
              accessibility-element
              accessibility-traits="updating"
              accessibility-label={notice.text}
            >
              {notice.text}
            </text>
            {notice.retry && (
              <LinkButton
                onTap={() => {
                  dismiss();
                  notice.retry?.();
                }}
              >
                Retry
              </LinkButton>
            )}
          </view>
          <IconButton icon="close" label="Dismiss message" onTap={dismiss} />
        </view>
      )}
    </view>
  );
}
