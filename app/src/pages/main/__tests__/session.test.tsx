import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import {
  account,
  confirmField,
  enterField,
  fieldValue,
  notice,
  resetHost,
  sessionStore,
  signIn,
  startApp,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost());

test('keeps account actions behind a clear sign-in screen', async () => {
  const { queries } = startApp();

  await tapText(queries, 'Guest');

  expect(await queries.findByText('Sign in', { selector: '.hero-title' })).toBeInTheDocument();
  expect(queries.getByLabelText('Create account')).toBeInTheDocument();
  expect(queries.getByText('Forgot password?')).toBeInTheDocument();
});

test('validates authentication before calling the API', async () => {
  const { api, queries } = startApp();

  await tapText(queries, 'Guest');
  await tapText(queries, 'Sign in', -1);

  expect(await queries.findByText('Enter your email.')).toBeInTheDocument();
  expect(queries.getByText('Enter your password.')).toBeInTheDocument();
  expect(api.to('login')).toHaveLength(0);
});

test('shows a field’s error until it is edited', async () => {
  const { queries } = startApp();

  await tapText(queries, 'Guest');
  await tapText(queries, 'Sign in', -1);
  await queries.findByText('Enter your email.');

  await enterField(queries, 'Email', 'maya@example.com');

  expect(queries.queryByText('Enter your email.')).not.toBeInTheDocument();
  expect(queries.getByText('Enter your password.')).toBeInTheDocument();
});

test('shows and hides the typed password', async () => {
  const { queries } = startApp();
  await tapText(queries, 'Guest');
  await enterField(queries, 'Password', 'valid-password');
  expect(queries.getByLabelText('Password')).toHaveAttribute('type', 'password');

  await tapLabel(queries, 'Show password');
  expect(queries.getByLabelText('Password')).toHaveAttribute('type', 'text');
  expect(fieldValue(queries, 'Password')).toBe('valid-password');

  await tapLabel(queries, 'Hide password');
  expect(queries.getByLabelText('Password')).toHaveAttribute('type', 'password');
});

test('validates the forgot-password email when the field is confirmed', async () => {
  const { api, queries } = startApp();

  await tapText(queries, 'Guest');
  await tapText(queries, 'Forgot password?');
  await confirmField(queries, 'Email');

  expect(await queries.findByText('Enter your email.')).toBeInTheDocument();
  expect(api.to('forgot')).toHaveLength(0);
});

test('signs in with a trimmed email, shows the feed, and signs out', async () => {
  const store = sessionStore();
  const { api, queries } = startApp();

  await tapText(queries, 'Guest');
  await enterField(queries, 'Email', ` ${account.email} `);
  await enterField(queries, 'Password', 'valid-password');
  await tapText(queries, 'Sign in', -1);

  expect(
    await queries.findByText('Fresh routes from every gym, newest first.')
  ).toBeInTheDocument();
  expect(api.to('login')[0].body).toEqual({
    email: account.email,
    password: 'valid-password',
  });
  expect(store.set).toHaveBeenCalledWith('test-token');
  expect(queries.getByLabelText('Everyone')).toHaveAttribute('aria-pressed', 'true');

  await tapText(queries, 'maya');
  await tapText(queries, 'Sign out');

  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(store.clear).toHaveBeenCalled();
  expect(api.to('logout')[0].token).toBe('test-token');
});

test('forgets typed credentials after signing out', async () => {
  const { queries } = startApp();

  await signIn(queries);
  await tapText(queries, 'maya');
  await tapText(queries, 'Sign out');
  await queries.findByText('Forgot password?');
  expect(fieldValue(queries, 'Email')).toBe('');
  expect(fieldValue(queries, 'Password')).toBe('');

  await tapText(queries, 'Create account');
  expect(fieldValue(queries, 'Display name (optional)')).toBe('');
});

test('keeps the session when the feed fails to load after signing in', async () => {
  const store = sessionStore();
  const { queries } = startApp({
    routes: () => {
      throw new ApiError('offline', 503);
    },
  });

  await signIn(queries);

  expect(await queries.findByText('offline')).toBeInTheDocument();
  expect(store.set).toHaveBeenCalledWith('test-token');
  expect(queries.getByText('Try again')).toBeInTheDocument();
});

test('signs out locally even when revoking the session fails', async () => {
  const store = sessionStore('saved-token');
  const { queries } = startApp({
    logout: () => {
      throw new ApiError('offline', 503);
    },
  });

  await tapText(queries, 'maya');
  await tapText(queries, 'Sign out');

  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(store.clear).toHaveBeenCalled();
  expect(notice()).toBeUndefined();
});

test('restores a saved session', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp();

  expect(await queries.findByText('maya')).toBeInTheDocument();
  expect(api.to('me')[0].token).toBe('saved-token');
});

test('drops a saved session the server rejects', async () => {
  const store = sessionStore('stale-token');
  const { queries } = startApp({
    me: () => {
      throw new ApiError('Session is invalid', 401);
    },
  });

  expect(await queries.findByText('Guest')).toBeInTheDocument();
  await vi.waitFor(() => expect(store.clear).toHaveBeenCalled());
});

test('keeps a saved session through a network failure and offers a retry', async () => {
  const store = sessionStore('saved-token');
  let online = false;
  const { queries } = startApp({
    me: () => {
      if (!online) throw new ApiError('offline', 503);
      return account;
    },
  });

  expect(
    await queries.findByText('Could not restore your session. Check your connection.')
  ).toBeInTheDocument();
  expect(store.clear).not.toHaveBeenCalled();

  online = true;
  await tapText(queries, 'Retry');

  expect(await queries.findByText('maya')).toBeInTheDocument();
  expect(notice()).toBeUndefined();
});

test('shows the account once the saved session is confirmed, not a sign-in form', async () => {
  let confirm: (user: typeof account) => void = () => {};
  sessionStore('saved-token');
  const { queries } = startApp({ me: () => new Promise((resolve) => (confirm = resolve)) });

  await tapText(queries, 'Guest');
  expect(queries.queryByText('Forgot password?')).not.toBeInTheDocument();
  expect(queries.getByText('Working…')).toBeInTheDocument();

  confirm(account);
  expect(await queries.findByText('Delete account')).toBeInTheDocument();
});

test('creates an account and resets a password through the browser links', async () => {
  const { api, queries } = startApp();
  const verification =
    'Check your email for a verification link. Open it in your browser, then return here and sign in.';

  await tapText(queries, 'Guest');
  await tapText(queries, 'Create account');
  await enterField(queries, 'Username', account.username);
  await enterField(queries, 'Email', account.email);
  await enterField(queries, 'Password', 'valid-password');
  await tapText(queries, 'Create account', -1);

  expect(await queries.findByText(verification)).toBeInTheDocument();
  expect(api.to('signup')[0].body).toMatchObject({
    username: 'maya',
    display_name: 'maya',
  });
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();

  await tapText(queries, 'Forgot password?');
  expect(queries.queryByText(verification)).not.toBeInTheDocument();
  expect(queries.getByText('Back to sign in')).toBeInTheDocument();
  expect(queries.queryByText('Forgot password?')).not.toBeInTheDocument();

  await tapText(queries, 'Send reset link');
  expect(
    await queries.findByText(
      'Check your email for a password-reset link. Complete it in your browser, then return here and sign in.'
    )
  ).toBeInTheDocument();
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
});

test('lists what to do next after signing up, until the visitor leaves', async () => {
  const { queries } = startApp();
  await tapText(queries, 'Guest');
  await tapText(queries, 'Create account');
  expect(queries.queryByText('Next: verify your email')).not.toBeInTheDocument();
  await enterField(queries, 'Username', account.username);
  await enterField(queries, 'Email', account.email);
  await enterField(queries, 'Password', 'valid-password');
  await tapText(queries, 'Create account', -1);

  expect(await queries.findByText('Next: verify your email')).toBeInTheDocument();
  expect(queries.getByText('Open the email we just sent.')).toBeInTheDocument();
  expect(queries.getByText('Tap the link. It opens in your browser.')).toBeInTheDocument();
  expect(queries.getByText('Come back here and sign in.')).toBeInTheDocument();
});

test('states the rules for a new account, and flags each field that breaks one', async () => {
  const { api, queries } = startApp();
  await tapText(queries, 'Guest');
  await tapText(queries, 'Create account');
  expect(queries.getByText('3–30 letters, numbers, _ or -')).toBeInTheDocument();
  expect(queries.getByText('At least 8 characters.')).toBeInTheDocument();

  await enterField(queries, 'Username', 'a b');
  await enterField(queries, 'Email', 'maya@');
  await enterField(queries, 'Password', 'short');
  await tapText(queries, 'Create account', -1);

  expect(await queries.findByText('Use 3–30 letters, numbers, _ or -.')).toBeInTheDocument();
  expect(queries.getByText('Enter a valid email address.')).toBeInTheDocument();
  expect(queries.getByText('Use at least 8 characters.')).toBeInTheDocument();
  expect(api.to('signup')).toHaveLength(0);
});

test('limits what can be typed to what the server accepts', async () => {
  const { queries } = startApp();
  await tapText(queries, 'Guest');
  await tapText(queries, 'Create account');

  expect(queries.getByLabelText('Username')).toHaveAttribute('maxlength', '30');
  expect(queries.getByLabelText('Display name (optional)')).toHaveAttribute('maxlength', '50');
  expect(queries.getByLabelText('Password')).toHaveAttribute('maxlength', '128');
});

test('saves the display name', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp();

  await tapText(queries, 'maya');
  await enterField(queries, 'Display name', 'Maya T.');
  await tapText(queries, 'Save profile');

  expect(await queries.findByText('Profile saved.')).toBeInTheDocument();
  expect(api.to('updateProfile')[0].body).toEqual({ display_name: 'Maya T.' });
});

test('ends the session and says so when a request is rejected with 401', async () => {
  const store = sessionStore('saved-token');
  const { queries } = startApp({
    updateProfile: () => {
      throw new ApiError('Session is invalid', 401);
    },
  });

  await tapText(queries, 'maya');
  await tapText(queries, 'Save profile');

  expect(
    await queries.findByText('Your saved session expired. Sign in again to continue.')
  ).toBeInTheDocument();
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(store.clear).toHaveBeenCalled();
});

test('runs one mutation at a time and shows that it is working', async () => {
  let finish: (profile: typeof account) => void = () => {};
  sessionStore('saved-token');
  const { api, queries } = startApp({
    updateProfile: () => new Promise((resolve) => (finish = resolve)),
  });

  await tapText(queries, 'maya');
  await tapText(queries, 'Save profile');
  await tapText(queries, 'Save profile');
  expect(await queries.findByText('Working…')).toBeInTheDocument();
  expect(api.to('updateProfile')).toHaveLength(1);

  finish(account);

  expect(await queries.findByText('Profile saved.')).toBeInTheDocument();
  expect(queries.queryByText('Working…')).not.toBeInTheDocument();
});

test('shows one quiet loading state, not list rows, while a saved session is confirmed', async () => {
  resetHost({ initialPage: { name: 'route', routeId: 'blue' } });
  sessionStore('saved-token');
  const { queries } = startApp({ me: () => new Promise(() => undefined) });

  expect(await queries.findByLabelText('Loading')).toHaveAttribute('aria-busy', 'true');
  expect(elementTree.root!.querySelector('.skel-row')).toBeNull();
  expect(queries.getByText('Working…')).toBeInTheDocument();
});

test('keeps the sign-in button at full strength while it works, and ignores another tap', async () => {
  const { api, queries } = startApp({ login: () => new Promise(() => undefined) });
  await tapText(queries, 'Guest');
  await enterField(queries, 'Email', account.email);
  await enterField(queries, 'Password', 'valid-password');

  await tapText(queries, 'Sign in', -1);
  await tapText(queries, 'Sign in', -1);

  const button = await vi.waitFor(() => {
    const busy = elementTree.root!.querySelector('.btn-primary.is-busy');
    expect(busy).not.toBeNull();
    return busy!;
  });
  expect(button.className).not.toContain('is-disabled');
  expect(button.querySelector('.spin')).not.toBeNull();
  expect(api.to('login')).toHaveLength(1);
});
