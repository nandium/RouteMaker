import {
  EMAIL_PATTERN,
  PASSWORD_LENGTH,
  USERNAME_LENGTH,
  USERNAME_PATTERN,
} from '../../client-contract.js';
import type { AuthPageName } from '../../web-pages.js';

export type AuthValues = { email: string; username: string; displayName: string; password: string };
export type AuthErrors = Partial<Record<keyof AuthValues, string>>;

/** What is wrong with the form, field by field, before the server has to say so. */
export function validateAuth(mode: AuthPageName, values: AuthValues) {
  const errors: AuthErrors = {};
  const email = values.email.trim();
  if (mode === 'signup') {
    const username = values.username.trim();
    const [shortest, longest] = USERNAME_LENGTH;
    if (
      username.length < shortest ||
      username.length > longest ||
      !USERNAME_PATTERN.test(username)
    ) {
      errors.username = `Use ${shortest}–${longest} letters, numbers, _ or -.`;
    }
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
    if (values.password.length < PASSWORD_LENGTH[0]) {
      errors.password = `Use at least ${PASSWORD_LENGTH[0]} characters.`;
    }
  } else {
    if (!email) errors.email = 'Enter your email.';
    if (mode === 'login' && !values.password) errors.password = 'Enter your password.';
  }
  return errors;
}
