import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  button,
  checkFields,
  createHero,
  createStatus,
  decoration,
  field,
  gradeTag,
  iconButton,
  linkButton,
  selectField,
  setStatus,
  submitButton,
} from './dom.js';
import { allByRole, byRole, installDom, queryByRole } from './test-dom.js';

describe('dom helpers', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('buttons', () => {
    it('look like the design system buttons and never submit by accident', () => {
      const plain = button('Go', 'secondary', 'sm');
      const link = linkButton('Home', '/gyms');

      expect(plain.className).toBe('btn btn--secondary btn--sm');
      expect(plain.type).toBe('button');
      expect(link.className).toBe('btn btn--primary btn--lg');
      expect(link.getAttribute('href')).toBe('/gyms');
    });

    it('submit only when made to', () => {
      const submit = submitButton('Send', 'primary', 'sm');

      expect(submit.type).toBe('submit');
      expect(submit.className).toBe('btn btn--primary btn--sm');
      expect(submit.textContent).toBe('Send');
    });

    it('name an icon-only button for assistive technology and for the pointer', () => {
      const node = iconButton('undo', 'Undo last change');

      expect(node.getAttribute('aria-label')).toBe('Undo last change');
      expect(node.title).toBe('Undo last change');
      expect(node.querySelector('svg')).not.toBeNull();
    });
  });

  describe('fields', () => {
    it('label the input they wrap, with a counter that follows what is typed', () => {
      const { wrapper, input, setValue } = field('Route name', {
        limit: 80,
        hint: 'Short is fine',
      });
      document.body.append(wrapper);

      expect(byRole(wrapper, 'textbox', 'Route name')).toBe(input);
      expect(input.maxLength).toBe(80);
      expect(wrapper.textContent).toContain('Short is fine');
      expect(wrapper.textContent).toContain('0/80');

      setValue('Hush');

      expect(input.value).toBe('Hush');
      expect(wrapper.textContent).toContain('4/80');
    });

    it('tie the hint and the counter to the input, so they are read with it', () => {
      const { wrapper, input } = field('Country', { hint: '2 letters', limit: 2 });
      document.body.append(wrapper);

      const described = input.getAttribute('aria-describedby')!.split(' ');

      expect(described.map((id) => document.getElementById(id)!.textContent)).toEqual([
        '2 letters',
        '0/2',
      ]);
    });

    it('give every input its own id, so each label finds its own', () => {
      const first = field('One');
      const second = field('Two');

      expect(first.input.id).not.toBe(second.input.id);
    });

    it('put a trailing control inside the box', () => {
      const reveal = iconButton('eye', 'Show password');
      const { wrapper } = field('Password', { type: 'password', trailing: reveal });

      expect(wrapper.querySelector('.input-box')!.contains(reveal)).toBe(true);
    });

    it('label a select and add a hint when asked', () => {
      const select = document.createElement('select');
      const wrapper = selectField('Gym', select, 'Preselected');
      document.body.append(wrapper);

      expect(byRole(wrapper, 'combobox', 'Gym')).toBe(select);
      expect(wrapper.textContent).toContain('Preselected');
    });

    describe('a problem', () => {
      it('shows under the field, marks it invalid and is read with it', () => {
        const { wrapper, input, setError } = field('Name', { hint: 'Short is fine' });
        document.body.append(wrapper);

        setError('Enter a name.');

        expect(input.getAttribute('aria-invalid')).toBe('true');
        const described = input.getAttribute('aria-describedby')!.split(' ');
        expect(described.map((id) => document.getElementById(id)!.textContent)).toEqual([
          'Short is fine',
          'Enter a name.',
        ]);
      });

      it('goes away when cleared, or when the field is edited', () => {
        const { wrapper, input, setError, setValue } = field('Name', { hint: 'Short is fine' });
        document.body.append(wrapper);

        setError('Enter a name.');
        setError(null);
        expect(input.hasAttribute('aria-invalid')).toBe(false);
        expect(input.getAttribute('aria-describedby')).toBe(`${input.id}-hint`);

        setError('Enter a name.');
        setValue('Hush');
        expect(input.hasAttribute('aria-invalid')).toBe(false);
        expect(wrapper.textContent).not.toContain('Enter a name.');
      });
    });
  });

  describe('checking fields', () => {
    it('shows every problem, focuses the first and says the form is not fine', () => {
      const first = field('One');
      const second = field('Two');
      const third = field('Three');
      document.body.append(first.wrapper, second.wrapper, third.wrapper);

      const fine = checkFields([
        [first, null],
        [second, 'Fix two.'],
        [third, 'Fix three.'],
      ]);

      expect(fine).toBe(false);
      expect(document.activeElement).toBe(second.input);
      expect(first.input.hasAttribute('aria-invalid')).toBe(false);
      expect(third.input.getAttribute('aria-invalid')).toBe('true');
    });

    it('clears earlier problems and says the form is fine when nothing is wrong', () => {
      const one = field('One');
      document.body.append(one.wrapper);
      checkFields([[one, 'Fix one.']]);

      const fine = checkFields([[one, null]]);

      expect(fine).toBe(true);
      expect(one.input.hasAttribute('aria-invalid')).toBe(false);
    });
  });

  describe('status', () => {
    it('is hidden until it has something to say', () => {
      const status = createStatus();
      expect(status.hidden).toBe(true);

      setStatus(status, 'Saved.');

      expect(status.hidden).toBe(false);
      expect(createStatus('Hello').hidden).toBe(false);
    });

    it('announces errors at once and everything else when the reader is free', () => {
      const status = createStatus('Saved.', 'success');
      document.body.append(status);
      expect(byRole(status, 'status').textContent).toBe('Saved.');
      expect(status.className).toBe('status status--success');

      setStatus(status, 'Could not save.', 'error');

      expect(byRole(status, 'alert').textContent).toBe('Could not save.');
      expect(queryByRole(status, 'status')).toBeNull();
      expect(status.className).toBe('status status--error');
    });

    it('swaps in a new text element only when the role changes, never changing one in place', () => {
      const status = createStatus('One');
      const first = byRole(status, 'status');

      setStatus(status, 'Two', 'success');
      expect(byRole(status, 'status')).toBe(first);

      setStatus(status, 'Three', 'error');
      const alert = byRole(status, 'alert');
      expect(alert).not.toBe(first);

      setStatus(status, 'Four', 'error');
      expect(byRole(status, 'alert')).toBe(alert);
      expect(allByRole(status, 'status')).toHaveLength(0);
    });

    it('shows an icon for each tone, as well as colour', () => {
      const status = createStatus('Note');
      const icon = () => status.querySelector('.status__icon')!.innerHTML;
      const info = icon();

      setStatus(status, 'Note', 'error');

      expect(icon()).not.toBe(info);
      expect(status.querySelectorAll('svg')).toHaveLength(1);
    });
  });

  describe('a grade tag', () => {
    it('is the grade in the colour of its tier, with any extra class', () => {
      const tag = (grade: string, modifier?: string) => gradeTag(grade, modifier);

      expect(tag('V0').className).toBe('tag g1');
      expect(tag('V4').className).toBe('tag g3');
      expect(tag('V17').className).toBe('tag g6');
      expect(tag('V7', 'tag--large').className).toBe('tag g4 tag--large');
      expect(tag('V7').textContent).toBe('V7');
    });
  });

  it('opens a page with a hero whose decoration is hidden from assistive technology', () => {
    const hero = createHero('Gym map', 'Find a gym.');

    expect(byRole(hero, 'heading').textContent).toBe('Gym map');
    expect(hero.textContent).toContain('Find a gym.');
    expect(allByRole(hero, 'img')).toHaveLength(0);
    expect(
      [...hero.querySelectorAll('.hero__shard, .hero__cut')].every(
        (node) => node.getAttribute('aria-hidden') === 'true'
      )
    ).toBe(true);
  });

  it('hides a purely visual span from assistive technology', () => {
    const span = decoration('shard');

    expect(span.className).toBe('shard');
    expect(span.getAttribute('aria-hidden')).toBe('true');
  });
});
