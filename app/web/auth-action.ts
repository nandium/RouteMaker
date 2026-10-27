import { API_PATHS, PASSWORD_LENGTH } from '../src/client-contract.js';
import type { AuthMessage } from '../src/client-contract.js';
import type { IconName } from '../src/icons.js';
import { WEB_PATHS } from '../src/web-pages.js';
import {
  button,
  checkFields,
  createStatus,
  decoration,
  element,
  field,
  iconNode,
  linkButton,
  setStatus,
  submitButton,
  textElement,
} from './dom.js';
import { browserRequest, errorMessage } from './http.js';
import './mail.css';

const [MIN_PASSWORD, MAX_PASSWORD] = PASSWORD_LENGTH;

async function post(path: string, body: object) {
  const { message } = await browserRequest<AuthMessage>(path, { method: 'POST', json: body });
  return message;
}

const signInLink = (kind: 'primary' | 'secondary' = 'primary') =>
  linkButton('Sign in', WEB_PATHS.login, kind);

const appHint = () =>
  textElement(
    'p',
    'Using the RouteMaker app? Switch back to it and sign in there.',
    'mail-card__hint'
  );

/** A card with a tile for its outcome (a plain `icon` while undecided), a title and a lede. */
function createMailCard(title: string, lede: string, icon: IconName) {
  const card = element('section', 'mail-card');
  const tile = decoration('mail-card__icon');
  tile.append(iconNode(icon));
  const heading = textElement('h1', title, 'display display--lg');
  const ledeText = textElement('p', lede, 'mail-card__lede');
  card.append(tile, heading, ledeText);
  return {
    card,
    /** The outcome is in: change the tile, and the title and lede if there are new ones. */
    settle(outcome: 'ok' | 'bad', newTitle?: string, newLede?: string) {
      tile.className = `mail-card__icon mail-card__icon--${outcome}`;
      tile.replaceChildren(iconNode(outcome === 'ok' ? 'check' : 'close'));
      if (newTitle) heading.textContent = newTitle;
      if (newLede) ledeText.textContent = newLede;
    },
  };
}

/** The page body for an email action: one card, centred. */
function mountCard(root: HTMLElement, card: HTMLElement) {
  const main = element('main', 'tool-main tool-main--mail');
  main.append(card);
  root.append(main);
}

/** A password box with a button that shows what was typed. */
function passwordField(label: string) {
  const reveal = element('button', 'icon-button');
  reveal.type = 'button';
  const handle = field(label, { type: 'password', trailing: reveal });
  const sync = () => {
    const shown = handle.input.type === 'text';
    reveal.setAttribute('aria-label', `${shown ? 'Hide' : 'Show'} password`);
    reveal.setAttribute('aria-pressed', String(shown));
    reveal.replaceChildren(iconNode(shown ? 'eye-off' : 'eye'));
  };
  reveal.onclick = () => {
    handle.input.type = handle.input.type === 'password' ? 'text' : 'password';
    sync();
  };
  sync();
  handle.input.autocomplete = 'new-password';
  handle.input.maxLength = MAX_PASSWORD;
  return handle;
}

/** A line of the password checklist: a dashed ring until it holds, then a check. */
function createRule(text: string) {
  const item = element('li', 'rule');
  const label = textElement('span', text);
  const done = textElement('span', ' (done)', 'sr-only');
  done.hidden = true;
  const mark = element('span', 'rule__mark');
  item.append(mark, label, done);
  return {
    item,
    show(met: boolean) {
      item.classList.toggle('rule--met', met);
      done.hidden = !met;
      mark.replaceChildren(iconNode(met ? 'check-circle' : 'proj'));
    },
  };
}

/** Finish a Firebase email link (verify address or reset password) on the plain web shell. */
export function mountAuthAction(
  root: HTMLElement,
  mode: 'verifyEmail' | 'resetPassword',
  oobCode: string
) {
  if (mode === 'verifyEmail') return mountVerifyEmail(root, oobCode);

  const { card, settle } = createMailCard(
    'Choose a new password',
    `Use ${MIN_PASSWORD}–${MAX_PASSWORD} characters. You will be signed out on every other device.`,
    'lock'
  );
  const form = element('form', 'mail-card__form');
  form.noValidate = true;
  const password = passwordField('New password');
  const confirm = passwordField('Confirm new password');
  const lengthRule = createRule(`At least ${MIN_PASSWORD} characters`);
  const matchRule = createRule('Both passwords match');
  const rules = element('ul', 'rules');
  rules.setAttribute('role', 'status');
  rules.append(lengthRule.item, matchRule.item);
  const showRules = () => {
    lengthRule.show(password.input.value.length >= MIN_PASSWORD);
    matchRule.show(confirm.input.value !== '' && confirm.input.value === password.input.value);
  };
  password.input.addEventListener('input', showRules);
  confirm.input.addEventListener('input', showRules);
  showRules();
  const submit = submitButton('Change password');
  const status = createStatus();
  const newLink = linkButton('Request a new reset link', WEB_PATHS.forgotPassword, 'secondary');
  form.append(password.wrapper, confirm.wrapper, rules, submit, status);
  card.append(form);
  mountCard(root, card);

  form.onsubmit = async (event) => {
    event.preventDefault();
    const valid = checkFields([
      [
        password,
        password.input.value.length >= MIN_PASSWORD
          ? null
          : `Use at least ${MIN_PASSWORD} characters.`,
      ],
      [confirm, confirm.input.value === password.input.value ? null : 'Passwords do not match.'],
    ]);
    if (!valid) return;
    submit.disabled = true;
    submit.classList.add('is-busy');
    submit.textContent = 'Changing password…';
    setStatus(status, 'Changing password…');
    try {
      const message = await post(API_PATHS.auth.reset, {
        oob_code: oobCode,
        password: password.input.value,
      });
      settle('ok', 'Password changed', 'You were signed out on your other devices.');
      setStatus(status, message, 'success');
      // Nothing left to edit: the form folds away and sign-in is the way on.
      form.classList.add('is-done');
      submit.remove();
      card.append(signInLink(), appHint());
    } catch (error) {
      submit.disabled = false;
      submit.textContent = 'Change password';
      setStatus(status, errorMessage(error), 'error');
      if (!newLink.isConnected) status.after(newLink);
    } finally {
      submit.classList.remove('is-busy');
    }
  };
}

function mountVerifyEmail(root: HTMLElement, oobCode: string) {
  const { card, settle } = createMailCard(
    'Verify your email',
    'Confirm to verify your email address.',
    'user'
  );
  // Mail scanners open links, and verifying on load would spend the single-use code for them.
  const verify = button('Verify email', 'primary', 'lg');
  const status = createStatus();
  const fallback = signInLink('secondary');
  card.append(verify, status);
  mountCard(root, card);

  verify.onclick = async () => {
    verify.disabled = true;
    verify.classList.add('is-busy');
    setStatus(status, 'Verifying…');
    try {
      setStatus(status, await post(API_PATHS.auth.verify, { oob_code: oobCode }), 'success');
      settle('ok', 'Email verified', 'You can now sign in.');
      verify.replaceWith(signInLink());
      card.append(appHint());
    } catch (error) {
      verify.disabled = false;
      setStatus(status, errorMessage(error), 'error');
      // A used or expired link cannot be tried again; signing in is still the way on.
      if (!fallback.isConnected) status.after(fallback);
    } finally {
      verify.classList.remove('is-busy');
    }
  };
}

/** An email-action address with no code left: it was used, or is being reloaded. */
export function mountUsedLink(root: HTMLElement) {
  const { card, settle } = createMailCard(
    'This link has already been used.',
    'Email links work once. Sign in, or ask for a new link from the sign-in page.',
    'lock'
  );
  settle('bad');
  card.append(signInLink(), appHint());
  mountCard(root, card);
}
