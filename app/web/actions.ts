import { API_PATHS } from '../src/client-contract.js';
import { browserRequest } from './http.js';
import { element as node } from './shared.js';

async function post(path: string, body: object) {
  const result = await browserRequest<{ detail?: string; message?: string }>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return result?.message ?? 'Done.';
}

export function mountAuthAction(
  root: HTMLElement,
  mode: 'verifyEmail' | 'resetPassword',
  oobCode: string
) {
  root.className = 'tool-page';
  const intro = node('section', 'tool-intro');
  intro.append(
    node('p', 'tool-kicker', 'Account security'),
    node('h1', '', mode === 'verifyEmail' ? 'Verify your email.' : 'Choose a new password.')
  );
  const card = node('section', 'tool-card');
  const status = node('p', 'tool-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.replaceChildren(intro, card);

  if (mode === 'verifyEmail') {
    card.append(status);
    status.textContent = 'Verifying…';
    void post(API_PATHS.auth.verify, { oob_code: oobCode })
      .then((message) => {
        status.textContent = message;
      })
      .catch((error) => {
        status.className = 'tool-status tool-status--error';
        status.setAttribute('role', 'alert');
        status.setAttribute('aria-live', 'assertive');
        status.textContent = error instanceof Error ? error.message : 'Verification failed.';
      });
    return;
  }

  const password = node('input');
  password.type = 'password';
  password.minLength = 8;
  password.maxLength = 128;
  password.placeholder = 'New password';
  password.setAttribute('aria-label', 'New password');
  const confirm = node('input');
  confirm.type = 'password';
  confirm.placeholder = 'Confirm new password';
  confirm.setAttribute('aria-label', 'Confirm new password');
  const passwordField = node('label', 'tool-field');
  passwordField.append(node('span', '', 'New password'), password);
  const confirmField = node('label', 'tool-field');
  confirmField.append(node('span', '', 'Confirm new password'), confirm);
  const submit = node('button', '', 'Change password');
  submit.onclick = async () => {
    if (password.value.length < 8 || password.value !== confirm.value) {
      status.className = 'tool-status tool-status--error';
      status.setAttribute('role', 'alert');
      status.setAttribute('aria-live', 'assertive');
      status.textContent = 'Use at least 8 characters and make both passwords match.';
      return;
    }
    submit.disabled = true;
    try {
      status.textContent = 'Changing password…';
      status.className = 'tool-status';
      status.textContent = await post(API_PATHS.auth.reset, {
        oob_code: oobCode,
        password: password.value,
      });
      submit.textContent = 'Password changed';
    } catch (error) {
      submit.disabled = false;
      status.className = 'tool-status tool-status--error';
      status.setAttribute('role', 'alert');
      status.setAttribute('aria-live', 'assertive');
      status.textContent = error instanceof Error ? error.message : 'Password reset failed.';
    }
  };
  card.append(passwordField, confirmField, submit, status);
}
