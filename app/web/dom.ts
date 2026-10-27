import { tierOf } from '../src/grade-tiers.js';
import { type IconName, iconSvg } from '../src/icons.js';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '') {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
  className = ''
) {
  const node = element(tag, className);
  node.textContent = text;
  return node;
}

/** A purely visual span, hidden from assistive technology. */
export function decoration(className: string) {
  const node = element('span', className);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/** A decorative icon that takes its colour from the surrounding text. */
export function iconNode(name: IconName, className = '') {
  const node = decoration(className ? `icon ${className}` : 'icon');
  node.innerHTML = iconSvg(name, 'currentColor');
  return node;
}

type ButtonKind = 'primary' | 'secondary' | 'quiet';
type ButtonSize = 'lg' | 'sm';

const buttonClass = (kind: ButtonKind, size: ButtonSize) => `btn btn--${kind} btn--${size}`;

/** A non-submitting button; inside a form only the publish/confirm button should submit. */
export function button(text: string, kind: ButtonKind = 'primary', size: ButtonSize = 'lg') {
  const node = textElement('button', text, buttonClass(kind, size));
  node.type = 'button';
  return node;
}

/** The button that submits its form. */
export function submitButton(text: string, kind: ButtonKind = 'primary', size: ButtonSize = 'lg') {
  const node = textElement('button', text, buttonClass(kind, size));
  node.type = 'submit';
  return node;
}

/** A link that looks like a button. */
export function linkButton(
  text: string,
  href: string,
  kind: ButtonKind = 'primary',
  size: ButtonSize = 'lg'
) {
  const link = textElement('a', text, buttonClass(kind, size));
  link.href = href;
  return link;
}

/** An icon-only button; `label` is its accessible name and its tooltip. */
export function iconButton(icon: IconName, label: string) {
  const node = element('button', 'icon-button');
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.title = label;
  node.append(iconNode(icon));
  return node;
}

/** A grade as the coloured tag used on route lists; `modifier` adds a class such as a size. */
export function gradeTag(grade: string, modifier = '') {
  const tag = element('span', `tag g${tierOf(grade)} ${modifier}`.trim());
  tag.append(textElement('span', grade, 'tag__number display display--md'));
  return tag;
}

let nextFieldId = 0;
const uniqueId = (prefix: string) => `${prefix}-${(nextFieldId += 1)}`;

type FieldOptions = {
  type?: string;
  placeholder?: string;
  /** Text under the field that explains it. */
  hint?: string;
  /** Shows "used/limit" under the field and enforces the limit. */
  limit?: number;
  /** Control after the input inside the box, such as a show-password button. */
  trailing?: HTMLElement;
};

/**
 * A label above a boxed text input, with optional hint and length counter below it, and a
 * place for the field's own error.
 *
 * Forms on these pages validate in one way: they set `noValidate`, check on submit, put each
 * problem under its field with `setError` and focus the first one. The route editor's steps
 * (photo, holds, name) report through its status line, as does the place search.
 */
export function field(label: string, options: FieldOptions = {}) {
  const input = element('input', 'field__input');
  input.type = options.type ?? 'text';
  input.id = uniqueId('field');
  if (options.placeholder) input.placeholder = options.placeholder;
  const box = element('div', 'input-box');
  box.append(input);
  if (options.trailing) box.append(options.trailing);
  const wrapper = element('div', 'field');
  const name = textElement('label', label, 'field__label');
  name.htmlFor = input.id;
  wrapper.append(name, box);

  const described: HTMLElement[] = [];
  const footer = element('div', 'field__foot');
  if (options.hint) {
    const hint = textElement('p', options.hint, 'field__hint');
    hint.id = `${input.id}-hint`;
    footer.append(hint);
    described.push(hint);
  }
  if (options.limit) {
    const { limit } = options;
    input.maxLength = limit;
    const counter = textElement('span', `0/${limit}`, 'field__counter');
    counter.id = `${input.id}-count`;
    input.addEventListener('input', () => {
      counter.textContent = `${input.value.length}/${limit}`;
    });
    footer.append(counter);
    described.push(counter);
  }
  if (footer.hasChildNodes()) wrapper.append(footer);
  const error = element('p', 'field__error');
  error.id = `${input.id}-error`;
  error.hidden = true;
  wrapper.append(error);
  const describe = (parts: readonly HTMLElement[]) => {
    if (parts.length)
      input.setAttribute('aria-describedby', parts.map((part) => part.id).join(' '));
    else input.removeAttribute('aria-describedby');
  };
  describe(described);

  // Editing the field answers its problem.
  input.addEventListener('input', () => {
    if (!error.hidden) setError(null);
  });

  function setError(message: string | null) {
    error.hidden = message === null;
    error.replaceChildren(...(message === null ? [] : [iconNode('alert'), message]));
    box.classList.toggle('is-error', message !== null);
    if (message === null) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
    describe(message === null ? described : [...described, error]);
  }

  return {
    wrapper,
    input,
    /** Set the value the way typing would, so the counter follows. */
    setValue(value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    /** Show what is wrong with this field, or clear it with `null`. */
    setError,
  };
}

type FieldHandle = ReturnType<typeof field>;

/**
 * Show each field's problem (or none) under it and focus the first field that has one. True
 * when every field is fine.
 */
export function checkFields(checks: ReadonlyArray<readonly [FieldHandle, string | null]>) {
  let first: FieldHandle | undefined;
  for (const [handle, problem] of checks) {
    handle.setError(problem);
    if (problem && !first) first = handle;
  }
  first?.input.focus();
  return !first;
}

/** A label above a select, with a chevron in place of the browser's arrow. */
export function selectField(label: string, select: HTMLSelectElement, hint?: string) {
  select.id = uniqueId('select');
  select.classList.add('select-box__control');
  const name = textElement('label', label, 'field__label');
  name.htmlFor = select.id;
  const box = element('div', 'select-box');
  box.append(select, iconNode('chevron-down'));
  const wrapper = element('div', 'field');
  wrapper.append(name, box);
  if (hint) wrapper.append(textElement('p', hint, 'field__hint'));
  return wrapper;
}

export type Tone = 'info' | 'success' | 'error';

const TONE_ICONS = { info: 'info', success: 'check-circle', error: 'alert' } as const;

/** A message box, hidden until it has something to say. */
export function createStatus(message = '', tone: Tone = 'info') {
  const node = element('div', 'status');
  node.append(element('span', 'status__icon'), element('p', 'status__text'));
  node.hidden = true;
  if (message) setStatus(node, message, tone);
  return node;
}

/**
 * Show `message` in a status box. It announces itself: errors at once, everything else when the
 * reader is free. The announcing role sits on the text, and a change of role swaps in a new
 * element, because screen readers do not reliably announce a role that changes in place.
 */
export function setStatus(node: HTMLElement, message: string, tone: Tone = 'info') {
  node.hidden = false;
  node.className = `status status--${tone}`;
  const role = tone === 'error' ? 'alert' : 'status';
  let text = node.querySelector('.status__text')!;
  if (text.getAttribute('role') !== role) {
    const next = element('p', 'status__text');
    next.setAttribute('role', role);
    text.replaceWith(next);
    text = next;
  }
  text.textContent = message;
  node.querySelector('.status__icon')!.replaceChildren(iconNode(TONE_ICONS[tone]));
}

/** The wall-coloured banner that opens a tool page. */
export function createHero(title: string, subtitle: string) {
  const inner = element('div', 'hero__inner');
  inner.append(
    textElement('h1', title, 'hero__title display display--xl'),
    textElement('p', subtitle, 'hero__sub')
  );
  const hero = element('section', 'hero');
  hero.append(
    decoration('hero__shard'),
    decoration('hero__shard hero__shard--lit'),
    inner,
    decoration('hero__cut')
  );
  return hero;
}
