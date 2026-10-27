import { useState } from '@lynx-js/react';

import { api } from '../../../api.js';
import { type AuthSession, DISPLAY_NAME_LENGTH } from '../../../client-contract.js';
import { ApiError } from '../../../http.js';
import { useApp } from '../app-context.js';
import { Button } from '../components/Button.js';
import { DangerZone } from '../components/DangerZone.js';
import { Field } from '../components/Field.js';
import { Hero, HeroSubtitle, HeroTitle } from '../components/Hero.js';
import { Row, RowTitle } from '../components/Row.js';
import { Sheet } from '../components/Sheet.js';
import { SectionTitle } from '../components/Text.js';
import { Avatar } from '../parts/Avatar.js';
import { ThemeControl } from '../parts/ThemeControl.js';
import './Account.css';

export function Account({ auth }: { auth: AuthSession }) {
  const { wideLayout, go, notify, run, setUser, signOut, working, openSheet } = useApp();
  const [displayName, setDisplayName] = useState(auth.user.display_name);
  const [error, setError] = useState('');

  const save = () => {
    'background only';
    const name = displayName.trim();
    if (!name) return setError('Display name is required.');
    setError('');
    void run(async () => {
      setUser(await api.updateProfile(auth.token, name));
      notify('success', 'Profile saved.');
    });
  };
  const logout = () => {
    'background only';
    void run(async () => {
      // Revoking is best effort: the local session ends either way.
      await api.logout(auth.token).catch(() => undefined);
      signOut();
      go({ name: 'login' }, 'reset');
    });
  };

  const profile = (
    <view className="account-section">
      <SectionTitle>Profile</SectionTitle>
      <Field
        label="Display name"
        value={displayName}
        onInput={setDisplayName}
        maxLength={DISPLAY_NAME_LENGTH[1]}
        showCount
        placeholder="How climbers see you"
        error={error}
      />
      <Field label="Username" value={auth.user.username} disabled hint="Usernames are permanent." />
      <Field
        label="Email"
        value={auth.user.email}
        disabled
        hint="Used for sign-in and password reset."
      />
      <Button size="lg" block icon="check" busy={working} onTap={save}>
        Save profile
      </Button>
    </view>
  );
  const appearance = (
    <view className="account-section">
      <view className="account-heading">
        <SectionTitle>Appearance</SectionTitle>
        <text className="t-body-s c-ink-2">Auto follows your device.</text>
      </view>
      <ThemeControl />
    </view>
  );
  const climbing = (
    <view className="account-section">
      <SectionTitle>Your climbing</SectionTitle>
      <Row
        flush
        label="Your profile"
        onTap={() => go({ name: 'profile', username: auth.user.username })}
      >
        <view className="row-copy">
          <RowTitle>Your profile</RowTitle>
          <text className="t-body-s c-ink-2">See your routes and followers</text>
        </view>
      </Row>
    </view>
  );
  const leaving = (
    <>
      <Button kind="secondary" size="lg" block icon="logout" onTap={logout}>
        Sign out
      </Button>
      <DangerZone
        title="Delete account"
        body="Permanently deletes your account. This cannot be undone and you will be signed out everywhere."
        action="Delete account…"
        onTap={() => openSheet(<DeleteAccountSheet auth={auth} />)}
      />
    </>
  );

  return (
    <>
      <Hero>
        <view className="account-id">
          <Avatar person={auth.user} size="l" />
          <view className="row-copy">
            <HeroTitle small lines={2}>
              {auth.user.display_name}
            </HeroTitle>
            <HeroSubtitle>
              {wideLayout
                ? `@${auth.user.username} · ${auth.user.email}`
                : `@${auth.user.username}`}
            </HeroSubtitle>
          </view>
        </view>
      </Hero>
      {wideLayout ? (
        <view className="page account-columns">
          <view className="account-column">
            {profile}
            {appearance}
          </view>
          <view className="account-column">
            {climbing}
            {leaving}
          </view>
        </view>
      ) : (
        <view className="account-stack">
          {profile}
          {appearance}
          {climbing}
          {leaving}
        </view>
      )}
    </>
  );
}

/** Deleting an account is irreversible, so it asks for the password again. */
function DeleteAccountSheet({ auth }: { auth: AuthSession }) {
  const { closeSheet, go, notify, run, signOut, working } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const destroy = () => {
    'background only';
    setError('');
    void run(async () => {
      try {
        await api.deleteAccount(auth.token, password);
      } catch (failure) {
        // A wrong password is a 403; a 401 would mean the session itself has expired.
        if (failure instanceof ApiError && failure.status === 403) {
          return setError('Password is incorrect.');
        }
        throw failure;
      }
      signOut();
      go({ name: 'login' }, 'reset');
      notify('success', 'Your account was deleted.');
    });
  };

  return (
    <Sheet title="Delete your account?">
      <text className="t-body c-ink-2">
        This permanently deletes your account and signs you out on every device. It cannot be
        undone. Enter your password to confirm.
      </text>
      <Field
        label="Password"
        type="password"
        value={password}
        onInput={setPassword}
        placeholder="Your current password"
        error={error}
      />
      <view className="sheet-actions">
        <Button
          kind="danger"
          size="lg"
          block
          icon="trash"
          busy={working}
          disabled={!password}
          onTap={destroy}
        >
          Delete my account
        </Button>
        <Button kind="secondary" size="lg" block onTap={closeSheet}>
          Keep my account
        </Button>
      </view>
    </Sheet>
  );
}
