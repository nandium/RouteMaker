import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { manageModalFocus } from './modal-focus.js';
import { installDom } from './test-dom.js';

/** Let the observer see what the test just changed. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve));

function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const close = vi.fn();
  manageModalFocus(root, close);

  const page = document.createElement('div');
  const openButton = document.createElement('div');
  openButton.setAttribute('tabindex', '0');
  const otherButton = document.createElement('div');
  otherButton.setAttribute('tabindex', '0');
  page.append(openButton, otherButton);
  root.append(page);

  /** A sheet like the app's: a scrim that is not a control, then the dialog. */
  function sheet(controls = 2) {
    const wrapper = document.createElement('div');
    const scrim = document.createElement('div');
    scrim.setAttribute('aria-hidden', 'true');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const items = Array.from({ length: controls }, () => {
      const item = document.createElement('div');
      item.setAttribute('tabindex', '0');
      dialog.append(item);
      return item;
    });
    wrapper.append(scrim, dialog);
    return { wrapper, scrim, dialog, items };
  }
  const press = (key: string, options: KeyboardEventInit = {}) => {
    const event = new window.KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      composed: true,
      ...options,
    });
    (root.activeElement ?? page).dispatchEvent(event);
    return event;
  };
  return { root, page, openButton, otherButton, close, sheet, press };
}

describe('a dialog in the Lynx view', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('takes focus, and makes the rest of the view inert, except the scrim a tap can close it by', async () => {
    const { root, page, openButton, sheet } = setup();
    openButton.focus();
    const { wrapper, scrim, dialog, items } = sheet();

    root.append(wrapper);
    await settled();

    expect(root.activeElement).toBe(items[0]);
    expect(page.hasAttribute('inert')).toBe(true);
    expect(scrim.hasAttribute('inert')).toBe(false);
    expect(dialog.hasAttribute('inert')).toBe(false);
    expect(wrapper.hasAttribute('inert')).toBe(false);
  });

  it('is found however deep it sits: only the path down to it stays live', async () => {
    const { root, page, sheet } = setup();
    const { wrapper, dialog } = sheet();
    const outer = document.createElement('section');
    const neighbour = document.createElement('div');
    outer.append(neighbour, wrapper);

    root.append(outer);
    await settled();

    expect(neighbour.hasAttribute('inert')).toBe(true);
    expect(page.hasAttribute('inert')).toBe(true);
    expect([outer, wrapper, dialog].some((node) => node.hasAttribute('inert'))).toBe(false);
  });

  it('keeps Tab inside, wrapping from the last control to the first and back', async () => {
    const { root, sheet, press } = setup();
    const { wrapper, items } = sheet(3);
    root.append(wrapper);
    await settled();

    items[2].focus();
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(root.activeElement).toBe(items[0]);

    expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(root.activeElement).toBe(items[2]);

    items[1].focus();
    expect(press('Tab').defaultPrevented).toBe(false);
  });

  it('brings Tab back inside when focus has strayed outside the dialog', async () => {
    const { root, otherButton, sheet, press } = setup();
    const { wrapper, items } = sheet();
    root.append(wrapper);
    await settled();

    otherButton.removeAttribute('inert');
    otherButton.focus();
    press('Tab');

    expect(root.activeElement).toBe(items[0]);
  });

  it('closes on Escape, by asking the app, as Back does', async () => {
    const { root, close, sheet, press } = setup();
    const { wrapper } = sheet();
    root.append(wrapper);
    await settled();

    const event = press('Escape');

    expect(close).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing on Escape when no dialog is open', () => {
    const { close, press } = setup();

    press('Escape');

    expect(close).not.toHaveBeenCalled();
  });

  it('gives everything back when it closes, focus included', async () => {
    const { root, page, openButton, sheet } = setup();
    openButton.focus();
    const { wrapper } = sheet();
    root.append(wrapper);
    await settled();

    wrapper.remove();
    await settled();

    expect(page.hasAttribute('inert')).toBe(false);
    expect(root.activeElement).toBe(openButton);
  });

  it('leaves alone what was already inert before it opened', async () => {
    const { root, page, otherButton, sheet } = setup();
    otherButton.setAttribute('inert', '');
    const { wrapper } = sheet();
    root.append(wrapper);
    await settled();
    expect(page.hasAttribute('inert')).toBe(true);

    wrapper.remove();
    await settled();

    expect(page.hasAttribute('inert')).toBe(false);
    expect(otherButton.hasAttribute('inert')).toBe(true);
  });

  it('takes focus itself when it has nothing to focus', async () => {
    const { root, sheet, press } = setup();
    const { wrapper, dialog } = sheet(0);

    root.append(wrapper);
    await settled();

    expect(root.activeElement).toBe(dialog);
    expect(press('Tab').defaultPrevented).toBe(true);
  });

  it('passes from one dialog to the next', async () => {
    const { root, page, sheet } = setup();
    const first = sheet();
    root.append(first.wrapper);
    await settled();
    const second = sheet(1);

    first.wrapper.remove();
    root.append(second.wrapper);
    await settled();

    expect(root.activeElement).toBe(second.items[0]);
    expect(page.hasAttribute('inert')).toBe(true);
  });

  it('notices a dialog that only becomes one after it is added', async () => {
    const { root, page, sheet } = setup();
    const { wrapper, dialog, items } = sheet();
    dialog.removeAttribute('aria-modal');
    root.append(wrapper);
    await settled();
    expect(page.hasAttribute('inert')).toBe(false);

    dialog.setAttribute('aria-modal', 'true');
    await settled();

    expect(page.hasAttribute('inert')).toBe(true);
    expect(root.activeElement).toBe(items[0]);
  });

  it('ignores a dialog that is not modal', async () => {
    const { root, page, sheet } = setup();
    const { wrapper, dialog } = sheet();
    dialog.setAttribute('aria-modal', 'false');

    root.append(wrapper);
    await settled();

    expect(page.hasAttribute('inert')).toBe(false);
  });
});
