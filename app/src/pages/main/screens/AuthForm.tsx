import { useState } from '@lynx-js/react';

import { api } from '../../../api.js';
import {
  DISPLAY_NAME_LENGTH,
  EMAIL_LENGTH,
  PASSWORD_LENGTH,
  USERNAME_LENGTH,
} from '../../../client-contract.js';
import { type AuthPageName, loginDestination } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { Button, LinkButton } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { Field } from '../components/Field.js';
import { Hero, HeroHeader } from '../components/Hero.js';
import { Icon } from '../components/Icon.js';
import { InitialTile } from '../components/InitialTile.js';
import { Segmented } from '../components/Segmented.js';
import { type AuthErrors, type AuthValues, validateAuth } from '../auth-validation.js';
import './AuthForm.css';

const TITLES: Record<AuthPageName, string> = {
  login: 'Sign in',
  signup: 'Create account',
  'forgot-password': 'Reset password',
};

const SUBTITLES: Record<AuthPageName, string> = {
  login: 'Log sends, grade routes and follow setters. Browsing stays open.',
  signup: 'Log sends, suggest grades and follow setters. It takes a minute.',
  'forgot-password': 'Enter your email and we will send you a reset link.',
};

const PERKS = ['Log every send', 'Suggest the true grade', 'Follow the setters you love'];

/** Sign in, sign up, and password reset share one form so typed values survive switching. */
export function AuthForm({ mode, next }: { mode: AuthPageName; next?: string }) {
  const { wideLayout, working, go, notify, run, signIn, openInBrowser } = useApp();
  const [values, setValues] = useState<AuthValues>({
    email: '',
    username: '',
    displayName: '',
    password: '',
  });
  const [errors, setErrors] = useState<AuthErrors>({});
  // After signing up the visitor still has to verify the email, which happens outside the app.
  const [registered, setRegistered] = useState(false);

  const bind = (name: keyof AuthValues) => ({
    value: values[name],
    error: errors[name],
    onInput(value: string) {
      setValues({ ...values, [name]: value });
      setErrors({ ...errors, [name]: undefined });
    },
  });

  const resume = () => {
    const destination = loginDestination(next);
    if (destination.name === 'gym-map' || destination.name === 'new-route') {
      // These come only from an allowed `next`, which the browser gets whole, query and all.
      const label = destination.name === 'gym-map' ? 'gym map' : 'route editor';
      void openInBrowser(next as string, label, { replace: true });
    } else {
      go(destination, 'replace');
    }
  };

  const submit = async () => {
    'background only';
    const found = validateAuth(mode, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    const email = values.email.trim();

    if (mode === 'login') {
      const session = await run(() => api.login(email, values.password));
      if (!session) return;
      signIn(session);
      return resume();
    }
    await run(async () => {
      if (mode === 'signup') {
        const username = values.username.trim();
        await api.signup({
          email,
          username,
          display_name: values.displayName.trim() || username,
          password: values.password,
        });
        setRegistered(true);
        go({ name: 'login', next }, 'replace');
        return notify(
          'success',
          'Check your email for a verification link. Open it in your browser, then return here and sign in.'
        );
      }
      await api.forgot(email);
      go({ name: 'login', next }, 'replace');
      notify(
        'success',
        'Check your email for a password-reset link. Complete it in your browser, then return here and sign in.'
      );
    });
  };

  const subtitle =
    mode === 'login' && next
      ? 'Sign in to continue. You will land right back where you were.'
      : SUBTITLES[mode];
  const form = (
    <view className="auth-form">
      {registered && mode === 'login' && <NextSteps />}
      {mode !== 'forgot-password' && (
        <Segmented
          label="Account mode"
          value={mode}
          onChange={(id) => go({ name: id, next })}
          options={[
            { id: 'login', label: 'Sign in' },
            { id: 'signup', label: 'Create account' },
          ]}
        />
      )}
      {mode === 'signup' && (
        <>
          <Field
            label="Username"
            placeholder="chalkyclimber"
            hint={`${USERNAME_LENGTH[0]}–${USERNAME_LENGTH[1]} letters, numbers, _ or -`}
            maxLength={USERNAME_LENGTH[1]}
            {...bind('username')}
          />
          <Field
            label="Display name (optional)"
            placeholder="Defaults to your username"
            hint={`Up to ${DISPLAY_NAME_LENGTH[1]} characters.`}
            maxLength={DISPLAY_NAME_LENGTH[1]}
            {...bind('displayName')}
          />
        </>
      )}
      <Field
        label="Email"
        type="email"
        maxLength={EMAIL_LENGTH[1]}
        placeholder="you@example.com"
        hint={
          mode === 'forgot-password' ? "We'll email a link to choose a new password." : undefined
        }
        onConfirm={mode === 'forgot-password' ? submit : undefined}
        {...bind('email')}
      />
      {mode !== 'forgot-password' && (
        <Field
          label="Password"
          type="password"
          placeholder={
            mode === 'signup'
              ? `${PASSWORD_LENGTH[0]}–${PASSWORD_LENGTH[1]} characters`
              : 'Your password'
          }
          hint={mode === 'signup' ? `At least ${PASSWORD_LENGTH[0]} characters.` : undefined}
          maxLength={PASSWORD_LENGTH[1]}
          onConfirm={submit}
          {...bind('password')}
        />
      )}
      <Button
        size="lg"
        block
        icon={mode === 'login' ? 'user' : mode === 'forgot-password' ? 'check' : undefined}
        busy={working}
        onTap={submit}
      >
        {mode === 'forgot-password' ? 'Send reset link' : TITLES[mode]}
      </Button>
      <view className="auth-links">
        {mode === 'login' && (
          <LinkButton onTap={() => go({ name: 'forgot-password', next })}>
            Forgot password?
          </LinkButton>
        )}
        {mode === 'signup' && (
          <LinkButton onTap={() => go({ name: 'login', next })}>
            Already registered? Sign in
          </LinkButton>
        )}
        {mode === 'forgot-password' && (
          <LinkButton onTap={() => go({ name: 'login', next })}>Back to sign in</LinkButton>
        )}
      </view>
    </view>
  );

  if (!wideLayout) {
    return (
      <>
        <Hero>
          <HeroHeader title={TITLES[mode]} subtitle={subtitle} />
        </Hero>
        {form}
      </>
    );
  }
  return (
    <view className="auth-split">
      <Hero panel>
        <HeroHeader title={TITLES[mode]} subtitle={subtitle} />
        <view className="auth-perks">
          {PERKS.map((perk) => (
            <view key={perk} className="auth-perk">
              <Icon name="check-circle" tone="on-wall" />
              <text className="t-body c-on-wall">{perk}</text>
            </view>
          ))}
        </view>
      </Hero>
      <view className="auth-side">{form}</view>
    </view>
  );
}

const NEXT_STEPS = [
  'Open the email we just sent.',
  'Tap the link. It opens in your browser.',
  'Come back here and sign in.',
];

/** What happens after signing up, which the notice is too brief to keep saying. */
function NextSteps() {
  return (
    <Card>
      <text className="t-title">Next: verify your email</text>
      {NEXT_STEPS.map((step, index) => (
        <view key={step} className="auth-step">
          <InitialTile letter={String(index + 1)} size="s" />
          <text className="t-body auth-step-text">{step}</text>
        </view>
      ))}
    </Card>
  );
}
