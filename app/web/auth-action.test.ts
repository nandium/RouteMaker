import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS } from '../src/client-contract.js';
import { mountAuthAction, mountUsedLink } from './auth-action.js';
import { browserRequest } from './http.js';
import {
  allByRole,
  byRole,
  installDom,
  queryByRole,
  queryByText,
  settle,
  statusLine,
  visibleText,
} from './test-dom.js';

vi.mock('./mail.css', () => ({}));
vi.mock('./http.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./http.js')>()),
  browserRequest: vi.fn(),
}));

const request = vi.mocked(browserRequest);

function mount(mode: 'verifyEmail' | 'resetPassword') {
  const root = document.createElement('main');
  document.body.append(root);
  mountAuthAction(root, mode, 'code-1');
  return root;
}

/** Type like a user: set the value and let the input event run. */
function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

/** The problem shown under a field: what it is described by, past its hint. */
function problemWith(input: HTMLInputElement) {
  if (!input.hasAttribute('aria-invalid')) return null;
  const ids = input.getAttribute('aria-describedby')!.split(' ');
  return document.getElementById(ids[ids.length - 1])!.textContent;
}

function resetForm() {
  const root = mount('resetPassword');
  const password = byRole<HTMLInputElement>(root, 'textbox', 'New password');
  const confirm = byRole<HTMLInputElement>(root, 'textbox', 'Confirm new password');
  const submit = () => root.querySelector('form')!.requestSubmit();
  return { root, password, confirm, submit };
}

describe('verifying an email address', () => {
  beforeEach(() => {
    installDom();
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('waits for a click before spending the verification code', async () => {
    const root = mount('verifyEmail');
    await settle();

    expect(request).not.toHaveBeenCalled();
    expect(byRole(root, 'button', 'Verify email')).toBeTruthy();
  });

  it('verifies on request, says so in the title and the lede, and offers sign-in', async () => {
    request.mockResolvedValue({ message: 'Email verified.' });
    const root = mount('verifyEmail');

    byRole(root, 'button', 'Verify email').click();
    await settle();

    expect(request).toHaveBeenCalledWith(API_PATHS.auth.verify, {
      method: 'POST',
      json: { oob_code: 'code-1' },
    });
    expect(statusLine(root).textContent).toBe('Email verified.');
    expect(byRole(root, 'heading').textContent).toBe('Email verified');
    expect(queryByText(root, 'You can now sign in.')).not.toBeNull();
    expect(queryByText(root, 'Confirm to verify your email address.')).toBeNull();
    expect(queryByRole(root, 'button')).toBeNull();
    expect(byRole(root, 'link', 'Sign in').getAttribute('href')).toBe('/login');
  });

  it('shows the button busy while it works', async () => {
    let finish!: () => void;
    request.mockReturnValue(new Promise((resolve) => (finish = () => resolve({ message: 'ok' }))));
    const root = mount('verifyEmail');

    byRole(root, 'button', 'Verify email').click();
    await settle();
    const busy = byRole<HTMLButtonElement>(root, 'button', 'Verify email');
    expect(busy.disabled).toBe(true);
    expect(busy.classList.contains('is-busy')).toBe(true);
    expect(statusLine(root).textContent).toBe('Verifying…');

    finish();
    await settle();
  });

  it('reports a failure as an alert, lets the user try again, and offers sign-in', async () => {
    request.mockRejectedValue(new Error('Link expired.'));
    const root = mount('verifyEmail');

    byRole(root, 'button', 'Verify email').click();
    await settle();

    expect(byRole(root, 'alert').textContent).toBe('Link expired.');
    const again = byRole<HTMLButtonElement>(root, 'button', 'Verify email');
    expect(again.disabled).toBe(false);
    expect(again.classList.contains('is-busy')).toBe(false);
    expect(byRole(root, 'link', 'Sign in').getAttribute('href')).toBe('/login');

    again.click();
    await settle();
    expect(allByRole(root, 'link', 'Sign in')).toHaveLength(1);
  });
});

describe('choosing a new password', () => {
  beforeEach(() => {
    installDom();
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks the browser to keep the passwords for its password manager', () => {
    const { password, confirm } = resetForm();

    expect([password.autocomplete, confirm.autocomplete]).toEqual(['new-password', 'new-password']);
  });

  it('lets each password be shown and hidden again', () => {
    const { root, password } = resetForm();
    const [first] = allByRole<HTMLButtonElement>(root, 'button', 'Show password');

    first.click();
    expect(password.type).toBe('text');
    expect(first.getAttribute('aria-label')).toBe('Hide password');
    expect(first.getAttribute('aria-pressed')).toBe('true');

    first.click();
    expect(password.type).toBe('password');
    expect(first.getAttribute('aria-label')).toBe('Show password');
  });

  it('checks off the rules as they are met, in words as well as marks', () => {
    const { root, password, confirm } = resetForm();
    const spoken = () => visibleText(allByRole(root, 'status')[0]);
    expect(spoken()).toBe('At least 8 charactersBoth passwords match');

    type(password, 'correct horse');
    expect(spoken()).toBe('At least 8 characters (done)Both passwords match');

    type(confirm, 'correct horse');
    expect(spoken()).toBe('At least 8 characters (done)Both passwords match (done)');

    type(confirm, 'something else');
    expect(spoken()).toBe('At least 8 characters (done)Both passwords match');
  });

  it("does not use the browser's own messages", () => {
    resetForm();

    expect(document.querySelector('form')!.noValidate).toBe(true);
  });

  it('names what is wrong under the field, then accepts the passwords once they are right', async () => {
    request.mockResolvedValue({ message: 'Password changed.' });
    const { root, password, confirm, submit } = resetForm();
    type(password, 'correct horse');
    type(confirm, 'battery staple');

    submit();
    await settle();
    expect(request).not.toHaveBeenCalled();
    expect(problemWith(confirm)).toBe('Passwords do not match.');
    expect(document.activeElement).toBe(confirm);

    type(confirm, 'correct horse');
    submit();
    await settle();

    expect(request).toHaveBeenCalledWith(API_PATHS.auth.reset, {
      method: 'POST',
      json: { oob_code: 'code-1', password: 'correct horse' },
    });
    expect(statusLine(root).textContent).toBe('Password changed.');
  });

  it('refuses a password that is too short', async () => {
    const { password, confirm, submit } = resetForm();
    type(password, 'short');
    type(confirm, 'short');

    submit();
    await settle();

    expect(request).not.toHaveBeenCalled();
    expect(problemWith(password)).toBe('Use at least 8 characters.');
    expect(document.activeElement).toBe(password);
  });

  it('refuses when the first password is the one that changed', async () => {
    const { password, confirm, submit } = resetForm();
    type(password, 'correct horse');
    type(confirm, 'correct horse');
    type(password, 'another password');

    submit();
    await settle();

    expect(request).not.toHaveBeenCalled();
    expect(problemWith(confirm)).toBe('Passwords do not match.');
  });

  it('changes the password once, folds the form away and points to sign-in', async () => {
    request.mockResolvedValue({ message: 'Password changed.' });
    const { root, password, confirm, submit } = resetForm();
    type(password, 'correct horse');
    type(confirm, 'correct horse');

    submit();
    await settle();

    expect(byRole(root, 'heading').textContent).toBe('Password changed');
    expect(queryByText(root, 'You were signed out on your other devices.')).not.toBeNull();
    expect(queryByText(root, 'You will be signed out on every other device.')).toBeNull();
    expect(root.querySelector('form')!.classList.contains('is-done')).toBe(true);
    expect(queryByRole(root, 'button', 'Change password')).toBeNull();
    expect(byRole(root, 'link', 'Sign in').getAttribute('href')).toBe('/login');
  });

  it('shows the button busy while it works', async () => {
    let finish!: () => void;
    request.mockReturnValue(new Promise((resolve) => (finish = () => resolve({ message: 'ok' }))));
    const { root, password, confirm, submit } = resetForm();
    type(password, 'correct horse');
    type(confirm, 'correct horse');

    submit();
    await settle();

    const busy = byRole<HTMLButtonElement>(root, 'button', 'Changing password…');
    expect(busy.disabled).toBe(true);
    expect(busy.classList.contains('is-busy')).toBe(true);

    finish();
    await settle();
  });

  it('lets the user retry after a failed reset, and offers a new link once', async () => {
    request.mockRejectedValue(new Error('Link expired.'));
    const { root, password, confirm, submit } = resetForm();
    type(password, 'correct horse');
    type(confirm, 'correct horse');

    submit();
    await settle();
    submit();
    await settle();

    const retry = byRole<HTMLButtonElement>(root, 'button', 'Change password');
    expect(retry.disabled).toBe(false);
    expect(retry.classList.contains('is-busy')).toBe(false);
    expect(byRole(root, 'alert').textContent).toBe('Link expired.');
    expect(
      allByRole(root, 'link', 'Request a new reset link').map((link) => link.getAttribute('href'))
    ).toEqual(['/forgot-password']);
  });
});

describe('a link that has already been used', () => {
  beforeEach(() => {
    installDom();
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('says so and offers sign-in', () => {
    const root = document.createElement('main');

    mountUsedLink(root);

    expect(byRole(root, 'heading').textContent).toBe('This link has already been used.');
    expect(byRole(root, 'link', 'Sign in').getAttribute('href')).toBe('/login');
    expect(request).not.toHaveBeenCalled();
  });
});
