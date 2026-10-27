import {
  API_PATHS,
  type AuthSession,
  HANDOFF_CODE_PATTERN,
  HANDOFF_FRAGMENT_KEY,
  type User,
} from '../src/client-contract.js';
import { element, textElement } from './dom.js';
import { browserRequest } from './http.js';
import { saveSession, storedSession } from './session.js';

/**
 * Take the code the native app put in the address bar's fragment. It leaves the address bar
 * before anything else runs, so no request, history entry or later link can carry it.
 */
export function takeHandoffCode(): string | null {
  const code = new URLSearchParams(location.hash.slice(1)).get(HANDOFF_FRAGMENT_KEY);
  if (code === null) return null;
  history.replaceState(history.state, '', location.pathname + location.search);
  return HANDOFF_CODE_PATTERN.test(code) ? code : null;
}

/** Trade a code for its session without keeping it; null when it is expired, used or unknown. */
async function redeemHandoff(code: string): Promise<AuthSession | null> {
  try {
    return await browserRequest<AuthSession>(API_PATHS.auth.redeemHandoff, {
      method: 'POST',
      json: { code },
    });
  } catch {
    return null;
  }
}

/** Who this browser is signed in as; null when nobody is, or the session has expired. */
async function signedInUsername(): Promise<string | null> {
  const token = storedSession();
  if (!token) return null;
  try {
    return (await browserRequest<User>(API_PATHS.me, { token })).username;
  } catch {
    return null;
  }
}

/** Blocks the page until the visitor answers; false for Cancel or Escape. */
function askToContinue(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = element('div', 'handoff');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'handoff-question');
    const heading = textElement('h1', question, 'handoff__question');
    heading.id = 'handoff-question';
    const warning = textElement(
      'p',
      'This link came from the RouteMaker app. If someone else sent it to you, choose Cancel.',
      'handoff__detail'
    );
    const proceed = textElement('button', 'Continue', 'handoff__button handoff__button--primary');
    const cancel = textElement('button', 'Cancel', 'handoff__button');
    proceed.type = cancel.type = 'button';

    const answer = (confirmed: boolean) => {
      dialog.remove();
      resolve(confirmed);
    };
    proceed.onclick = () => answer(true);
    cancel.onclick = () => answer(false);
    dialog.onkeydown = (event) => {
      if (event.key === 'Escape') answer(false);
    };
    const actions = element('div', 'handoff__actions');
    actions.append(proceed, cancel);
    dialog.append(heading, warning, actions);
    document.body.append(dialog);
    proceed.focus();
  });
}

/**
 * Sign this browser in as the account behind a code from the app, if the visitor agrees.
 *
 * The code is single-use, but anyone can put a code in a link: a forwarded link would sign the
 * recipient in as someone else, so nothing is stored until they confirm. Cancelling revokes the
 * session just issued and leaves whatever this browser already had.
 */
export async function signInFromApp(code: string) {
  const session = await redeemHandoff(code);
  if (!session) return;
  const username = `@${session.user.username}`;
  const current = await signedInUsername();
  const confirmed = await askToContinue(
    current
      ? `You're signed in as @${current} on this browser. Switch to ${username}?`
      : `Continue as ${username}?`
  );
  if (confirmed) {
    saveSession(session.token);
  } else {
    await browserRequest(API_PATHS.auth.logout, { method: 'POST', token: session.token }).catch(
      () => undefined
    );
  }
}
