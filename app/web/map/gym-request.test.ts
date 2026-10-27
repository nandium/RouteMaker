import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS, GYM_ADDRESS_LENGTH, GYM_NAME_LENGTH } from '../../src/client-contract.js';
import { browserRequest } from '../http.js';
import { STORAGE_KEYS } from '../storage.js';
import { byRole, installDom, queryByRole, settle, statusLine } from '../test-dom.js';
import { createGymRequest } from './gym-request.js';

vi.mock('../http.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../http.js')>()),
  browserRequest: vi.fn(),
}));

const request = vi.mocked(browserRequest);

describe('gym request form', () => {
  beforeEach(() => {
    installDom('http://localhost/gyms/map');
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  const mount = () => {
    const form = createGymRequest();
    document.body.append(form.element);
    return form;
  };
  const input = (label: string) => byRole<HTMLInputElement>(document.body, 'textbox', label);
  const submit = () => document.querySelector('form')!.requestSubmit();
  const fill = () => {
    input('Gym name').value = 'Climb Central';
    input('Address').value = '1 Main Street';
    input('Latitude').value = '1.3';
    input('Longitude').value = '103.8';
  };
  const signIn = () => localStorage.setItem(STORAGE_KEYS.session, 'token');

  it('asks signed-out visitors to sign in and returns them to the map', () => {
    mount();

    expect(document.querySelector('form')).toBeNull();
    expect(byRole(document.body, 'link', 'Sign in to request one').getAttribute('href')).toBe(
      '/login?next=%2Fgyms%2Fmap'
    );
  });

  it('fills coordinates from the map and updates the hint', () => {
    signIn();
    const form = mount();

    form.setLocation(1.352083, 103.819836);

    expect(input('Latitude').value).toBe('1.352083');
    expect(input('Longitude').value).toBe('103.819836');
    expect(statusLine(document.body).textContent).toContain('Location selected');
  });

  it('asks for coordinates when the map is unavailable', () => {
    signIn();
    mount().expectManualEntry();

    expect(statusLine(document.body).textContent).toBe('Enter the gym coordinates below.');
  });

  describe('validating before sending', () => {
    /** The problem shown for a field: the text the field is described by, beyond its hint. */
    const problem = (label: string) => {
      const field = input(label);
      if (!field.hasAttribute('aria-invalid')) return null;
      const ids = field.getAttribute('aria-describedby')!.split(' ');
      return document.getElementById(ids[ids.length - 1])!.textContent;
    };

    it('names every field that is wrong, under it, and focuses the first', async () => {
      signIn();
      mount();
      input('Latitude').value = '123';
      input('Longitude').value = '200';
      input('Country').value = 'S';

      submit();
      await settle();

      expect(request).not.toHaveBeenCalled();
      expect(problem('Gym name')).toBe('Enter the gym name.');
      expect(problem('Address')).toBe('Enter the address.');
      expect(problem('Country')).toBe('Use a 2-letter country code.');
      expect(problem('Latitude')).toBe('Latitude must be between -90 and 90.');
      expect(problem('Longitude')).toBe('Longitude must be between -180 and 180.');
      expect(document.activeElement).toBe(input('Gym name'));
    });

    it('keeps the name and address within the lengths the server accepts', async () => {
      signIn();
      mount();
      fill();
      expect(input('Gym name').maxLength).toBe(GYM_NAME_LENGTH[1]);
      expect(input('Address').maxLength).toBe(GYM_ADDRESS_LENGTH[1]);
      input('Gym name').value = ' A ';
      input('Address').value = 'x'.repeat(GYM_ADDRESS_LENGTH[1] + 1);

      submit();
      await settle();

      expect(request).not.toHaveBeenCalled();
      expect(problem('Gym name')).toBe(`Use ${GYM_NAME_LENGTH.join('–')} characters.`);
      expect(problem('Address')).toBe(`Use ${GYM_ADDRESS_LENGTH.join('–')} characters.`);
    });

    it('asks for coordinates that are missing, not just wrong', async () => {
      signIn();
      mount();
      fill();
      input('Latitude').value = '';

      submit();
      await settle();

      expect(request).not.toHaveBeenCalled();
      expect(problem('Latitude')).toBe('Latitude must be between -90 and 90.');
      expect(document.activeElement).toBe(input('Latitude'));
    });

    it('takes a problem away when the field is edited', async () => {
      signIn();
      mount();
      fill();
      input('Latitude').value = '123';
      submit();
      await settle();
      expect(problem('Latitude')).not.toBeNull();

      input('Latitude').value = '1.3';
      input('Latitude').dispatchEvent(new window.Event('input', { bubbles: true }));

      expect(problem('Latitude')).toBeNull();
    });

    it("does not use the browser's own messages", () => {
      signIn();
      mount();

      expect(document.querySelector('form')!.noValidate).toBe(true);
    });
  });

  it('sends the request once with the session token', async () => {
    signIn();
    request.mockResolvedValue({ id: 'g', status: 'pending' });
    mount();
    fill();

    submit();
    await settle();
    submit();
    await settle();

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(API_PATHS.gyms, {
      method: 'POST',
      token: 'token',
      json: {
        name: 'Climb Central',
        address: '1 Main Street',
        country_code: 'SG',
        latitude: 1.3,
        longitude: 103.8,
      },
    });
    expect(byRole<HTMLButtonElement>(document.body, 'button', 'Request sent').disabled).toBe(true);
    expect(statusLine(document.body).textContent).toBe('Request sent to an administrator.');
    expect(input('Gym name').disabled).toBe(true);
  });

  it('shows the button busy while the request is out', async () => {
    signIn();
    let finish!: () => void;
    request.mockReturnValue(new Promise((resolve) => (finish = () => resolve({}))));
    mount();
    fill();

    submit();
    await settle();

    const sending = byRole<HTMLButtonElement>(document.body, 'button', 'Sending…');
    expect(sending.disabled).toBe(true);
    expect(sending.classList.contains('is-busy')).toBe(true);

    finish();
    await settle();
    expect(byRole(document.body, 'button', 'Request sent').classList.contains('is-busy')).toBe(
      false
    );
  });

  it('shows a failure and lets the user try again', async () => {
    signIn();
    request.mockRejectedValue(new Error('Too many pending gyms'));
    mount();
    fill();

    submit();
    await settle();

    expect(byRole(document.body, 'alert').textContent).toBe('Too many pending gyms');
    const again = byRole<HTMLButtonElement>(document.body, 'button', 'Send for approval');
    expect(again.disabled).toBe(false);
    expect(again.classList.contains('is-busy')).toBe(false);
    expect(queryByRole(document.body, 'button', 'Request sent')).toBeNull();
  });
});
