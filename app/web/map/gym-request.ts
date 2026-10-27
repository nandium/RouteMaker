import {
  API_PATHS,
  GYM_ADDRESS_LENGTH,
  GYM_NAME_LENGTH,
  MAP_COORDINATE_LIMITS,
} from '../../src/client-contract.js';
import { loginPath, WEB_PATHS } from '../../src/web-pages.js';
import {
  checkFields,
  createStatus,
  element,
  field,
  linkButton,
  setStatus,
  submitButton,
  textElement,
} from '../dom.js';
import { browserRequest, errorMessage, isUnauthorized } from '../http.js';
import { redirectToLogin, storedSession } from '../session.js';

const DEFAULT_COUNTRY_CODE = 'SG';
const HINTS = {
  pick: 'First, select the gym location on the map.',
  picked: 'Location selected. Add the gym details below.',
  manual: 'Enter the gym coordinates below.',
} as const;

export type GymRequest = {
  element: HTMLElement;
  /** Fill the coordinates from a map selection. */
  setLocation(latitude: number, longitude: number): void;
  /** The map is unavailable; ask for coordinates instead. */
  expectManualEntry(): void;
};

/** A coordinate typed in a number field, which must be a number within +/- `limit`. */
const withinLimit = (text: string, limit: number) =>
  text.trim() !== '' && Math.abs(Number(text)) <= limit;

/** What is wrong with the length of a text field, counted the way the server does; else null. */
function lengthProblem(noun: string, text: string, [shortest, longest]: readonly [number, number]) {
  const length = [...text.trim()].length;
  if (length === 0) return `Enter the ${noun}.`;
  return length < shortest || length > longest ? `Use ${shortest}–${longest} characters.` : null;
}

/** "Can't find your gym?" card; signed-out visitors get a sign-in link instead of the form. */
export function createGymRequest(): GymRequest {
  const card = element('section', 'gym-request');
  card.append(textElement('h2', "Can't find your gym?", 'display display--lg'));

  if (!storedSession()) {
    card.append(
      textElement('p', 'Browsing is public. Sign in only when you want to add a gym.', 'lede'),
      linkButton('Sign in to request one', loginPath(WEB_PATHS.gymMap), 'secondary')
    );
    return { element: card, setLocation() {}, expectManualEntry() {} };
  }

  const form = element('form', 'gym-request__form');
  form.noValidate = true;
  const hint = createStatus(HINTS.pick);
  const name = field('Gym name', {
    placeholder: 'e.g. Chalk Republic',
    limit: GYM_NAME_LENGTH[1],
  });
  const address = field('Address', {
    placeholder: 'Street, unit, postcode',
    limit: GYM_ADDRESS_LENGTH[1],
  });
  const country = field('Country', { hint: '2 letters' });
  country.input.value = DEFAULT_COUNTRY_CODE;
  country.input.maxLength = 2;
  const latitude = field('Latitude', { type: 'number', placeholder: '1.3000' });
  const longitude = field('Longitude', { type: 'number', placeholder: '103.8000' });
  for (const { input } of [latitude, longitude]) input.step = 'any';
  const fields = [name, address, country, latitude, longitude];
  const coordinates = element('div', 'gym-request__coordinates');
  coordinates.append(country.wrapper, latitude.wrapper, longitude.wrapper);
  const submit = submitButton('Send for approval');
  const status = createStatus();
  form.append(name.wrapper, address.wrapper, coordinates, submit, status);
  card.append(
    textElement(
      'p',
      'Pick the spot on the map or search for the place, then add the details. An administrator reviews every request.',
      'lede'
    ),
    hint,
    form
  );

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const { latitude: latitudeLimit, longitude: longitudeLimit } = MAP_COORDINATE_LIMITS;
    const valid = checkFields([
      [name, lengthProblem('gym name', name.input.value, GYM_NAME_LENGTH)],
      [address, lengthProblem('address', address.input.value, GYM_ADDRESS_LENGTH)],
      [country, /^[A-Za-z]{2}$/.test(country.input.value) ? null : 'Use a 2-letter country code.'],
      [
        latitude,
        withinLimit(latitude.input.value, latitudeLimit)
          ? null
          : `Latitude must be between -${latitudeLimit} and ${latitudeLimit}.`,
      ],
      [
        longitude,
        withinLimit(longitude.input.value, longitudeLimit)
          ? null
          : `Longitude must be between -${longitudeLimit} and ${longitudeLimit}.`,
      ],
    ]);
    if (!valid) return;
    const token = storedSession();
    if (!token) return redirectToLogin();
    submit.disabled = true;
    submit.classList.add('is-busy');
    submit.textContent = 'Sending…';
    try {
      await browserRequest(API_PATHS.gyms, {
        method: 'POST',
        token,
        json: {
          name: name.input.value,
          address: address.input.value,
          country_code: country.input.value,
          latitude: Number(latitude.input.value),
          longitude: Number(longitude.input.value),
        },
      });
      // Done: the form stays as it was sent, and the button stays disabled.
      for (const { input } of fields) input.disabled = true;
      submit.textContent = 'Request sent';
      setStatus(hint, 'Request sent to an administrator.', 'success');
    } catch (error) {
      if (isUnauthorized(error)) return redirectToLogin();
      submit.disabled = false;
      submit.textContent = 'Send for approval';
      setStatus(status, errorMessage(error), 'error');
    } finally {
      submit.classList.remove('is-busy');
    }
  };

  return {
    element: card,
    setLocation(lat, lng) {
      latitude.input.value = lat.toFixed(6);
      longitude.input.value = lng.toFixed(6);
      setStatus(hint, HINTS.picked);
    },
    expectManualEntry: () => setStatus(hint, HINTS.manual),
  };
}
