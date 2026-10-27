import { fireEvent } from '@lynx-js/react/testing-library';
import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import {
  enterField,
  fieldValue,
  installHost,
  resetHost,
  sessionStore,
  settle,
  startApp,
  tapLabel,
  tapText,
  updateHostProps,
} from './helpers.js';

beforeEach(() => resetHost({ initialPage: { name: 'account' } }));

const root = () => elementTree.root!.querySelector('.app')!;

test('shows who is signed in, with the username and email fixed', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();

  expect(await queries.findByText('Maya Tan', { selector: '.hero-title' })).toBeInTheDocument();
  expect(fieldValue(queries, 'Display name')).toBe('Maya Tan');
  expect(fieldValue(queries, 'Username')).toBe('maya');
  expect(queries.getByLabelText('Username')).toHaveAttribute('disabled');
  expect(queries.getByLabelText('Email')).toHaveAttribute('disabled');
});

test('counts the characters left in the display name', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');

  expect(queries.getByText('8/50')).toBeInTheDocument();
  await enterField(queries, 'Display name', 'Maya T.');
  expect(await queries.findByText('7/50')).toBeInTheDocument();
});

test('says what is missing before it saves a blank display name', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp();
  await queries.findByText('Delete account');

  await enterField(queries, 'Display name', '  ');
  await tapText(queries, 'Save profile');

  expect(await queries.findByText('Display name is required.')).toBeInTheDocument();
  expect(api.to('updateProfile')).toHaveLength(0);
});

test('opens the climber’s own profile', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');

  await tapLabel(queries, 'Your profile');

  expect(await queries.findByText('This is you')).toBeInTheDocument();
});

test('offers Auto, Light and Dark, and Auto follows the device again', async () => {
  resetHost({ initialPage: { name: 'account' }, systemTheme: 'dark' });
  const setPreference = vi.fn();
  installHost({ RouteMakerAppearance: { setPreference } });
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  const choice = (label: string) => queries.getByLabelText(label);
  expect(choice('Auto')).toHaveAttribute('aria-pressed', 'true');
  expect(root().className).toContain('theme-dark');

  await tapLabel(queries, 'Light');
  expect(root().className).toContain('theme-light');
  expect(choice('Light')).toHaveAttribute('aria-pressed', 'true');
  expect(setPreference).toHaveBeenLastCalledWith('light');

  await tapLabel(queries, 'Auto');
  expect(root().className).toContain('theme-dark');
  expect(choice('Auto')).toHaveAttribute('aria-pressed', 'true');
  expect(setPreference).toHaveBeenLastCalledWith('system');

  updateHostProps({ systemTheme: 'light' });
  expect(root().className).toContain('theme-light');
});

test('the top bar toggle also chooses a theme, which the Account control then shows', async () => {
  installHost({ RouteMakerAppearance: { setPreference: vi.fn() } });
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');

  await tapLabel(queries, 'Appearance');
  // The sheet's control is the later of the two on screen.
  fireEvent.tap((await queries.findAllByLabelText('Dark')).at(-1)!);
  await tapText(queries, 'Done');

  expect(queries.getByLabelText('Dark')).toHaveAttribute('aria-pressed', 'true');
});

test('warns that deleting the account cannot be undone', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();

  await tapText(queries, 'Delete account…');

  expect(await queries.findByText('Delete your account?')).toBeInTheDocument();
  expect(queries.getByText(/cannot be\s+undone/, { selector: '.sheet text' })).toBeInTheDocument();
});

test('keeps the account when the sheet is closed', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp();
  await tapText(queries, 'Delete account…');

  await tapText(queries, 'Keep my account');

  expect(queries.queryByText('Delete your account?')).not.toBeInTheDocument();
  expect(api.to('deleteAccount')).toHaveLength(0);
});

test('system Back closes the sheet before it leaves the page', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await tapText(queries, 'Delete account…');

  lynx.getJSModule('GlobalEventEmitter').emit('routemaker:back', []);

  await vi.waitFor(() =>
    expect(queries.queryByText('Delete your account?')).not.toBeInTheDocument()
  );
  expect(queries.getByText('Delete account')).toBeInTheDocument();
});

test('needs the password before deleting', async () => {
  sessionStore('saved-token');
  const { api, queries } = startApp();
  await tapText(queries, 'Delete account…');

  expect(queries.getByLabelText('Delete my account')).toHaveAttribute('aria-disabled', 'true');
  await tapText(queries, 'Delete my account');
  await settle();

  expect(api.to('deleteAccount')).toHaveLength(0);
});

test('deletes the account with the password, then signs out locally', async () => {
  const store = sessionStore('saved-token');
  const { api, queries } = startApp();
  await tapText(queries, 'Delete account…');

  await enterField(queries, 'Password', 'valid-password');
  await tapText(queries, 'Delete my account');

  expect(await queries.findByText('Your account was deleted.')).toBeInTheDocument();
  expect(api.to('deleteAccount')).toMatchObject([
    { token: 'saved-token', body: { password: 'valid-password' } },
  ]);
  expect(store.clear).toHaveBeenCalled();
  expect(await queries.findByText('Create account')).toBeInTheDocument();
  expect(api.to('logout')).toHaveLength(0);
});

test('keeps the account and the session when the password is wrong', async () => {
  const store = sessionStore('saved-token');
  const { queries } = startApp({
    deleteAccount: () => {
      throw new ApiError('Email or password is incorrect', 403);
    },
  });
  await tapText(queries, 'Delete account…');

  await enterField(queries, 'Password', 'wrong-password');
  await tapText(queries, 'Delete my account');

  expect(await queries.findByText('Password is incorrect.')).toBeInTheDocument();
  expect(store.clear).not.toHaveBeenCalled();
  expect(queries.getByText('Delete your account?')).toBeInTheDocument();
});

test('signs out when the session itself has expired', async () => {
  const store = sessionStore('saved-token');
  const { queries } = startApp({
    deleteAccount: () => {
      throw new ApiError('Authentication required', 401);
    },
  });
  await tapText(queries, 'Delete account…');

  await enterField(queries, 'Password', 'valid-password');
  await tapText(queries, 'Delete my account');

  expect(
    await queries.findByText('Your saved session expired. Sign in again to continue.')
  ).toBeInTheDocument();
  expect(store.clear).toHaveBeenCalled();
  // The guard sent the visitor to sign in, and the sheet did not outlive the page it was on.
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
  expect(queries.queryByText('Delete your account?')).not.toBeInTheDocument();
});
