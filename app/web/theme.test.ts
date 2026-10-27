import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ColorScheme } from '../src/host-contract.js';
import { STORAGE_KEYS } from './storage.js';
import { installDom, stubMatchMedia } from './test-dom.js';
import { chooseTheme, currentScheme, followSystemTheme, onThemeChange } from './theme.js';

/** What theme-init.js has done by the time the page's scripts run. */
function startPage(options: { appliedDark: boolean; system?: boolean; saved?: string }) {
  installDom();
  document.documentElement.classList.toggle('theme-dark', options.appliedDark);
  const media = stubMatchMedia({ dark: options.system ?? options.appliedDark });
  if (options.saved) localStorage.setItem(STORAGE_KEYS.theme, options.saved);
  return media;
}

describe('theme', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the scheme theme-init.js applied', () => {
    startPage({ appliedDark: true });

    expect(currentScheme()).toBe('dark');
  });

  it('follows the OS scheme while nothing is saved', () => {
    const media = startPage({ appliedDark: true });
    followSystemTheme();

    media.set('dark', false);

    expect(currentScheme()).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('keeps a saved preference when the OS scheme changes', () => {
    const media = startPage({ appliedDark: true, system: false, saved: 'dark' });
    followSystemTheme();

    media.set('dark', true);
    media.set('dark', false);

    expect(currentScheme()).toBe('dark');
  });

  it('returns to the OS scheme when "system" is chosen', () => {
    const media = startPage({ appliedDark: true, system: false, saved: 'dark' });
    followSystemTheme();

    chooseTheme('system');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
    expect(currentScheme()).toBe('light');

    media.set('dark', true);
    expect(currentScheme()).toBe('dark');
  });

  describe('choosing', () => {
    let changes: ReturnType<typeof vi.fn<(scheme: ColorScheme) => void>>;
    beforeEach(() => {
      startPage({ appliedDark: false });
      changes = vi.fn<(scheme: ColorScheme) => void>();
      onThemeChange(changes);
    });

    it('persists the choice and tells listeners only when the scheme changes', () => {
      chooseTheme('dark');
      chooseTheme('dark');

      expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
      expect(changes).toHaveBeenCalledOnce();
      expect(changes).toHaveBeenCalledWith('dark');
    });

    it('stops telling a listener that unsubscribed', () => {
      const unsubscribed = vi.fn<(scheme: ColorScheme) => void>();
      onThemeChange(unsubscribed)();

      chooseTheme('dark');

      expect(changes).toHaveBeenCalledOnce();
      expect(unsubscribed).not.toHaveBeenCalled();
    });
  });
});

describe('theme-init.js', () => {
  const script = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'theme-init.js'),
    'utf8'
  );
  const runWith = (saved: string | null, osDark: boolean) => {
    installDom();
    stubMatchMedia({ dark: osDark });
    if (saved) localStorage.setItem(STORAGE_KEYS.theme, saved);
    new Function(script)();
    return document.documentElement.classList.contains('theme-dark');
  };
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['dark', false, true],
    ['light', true, false],
    [null, true, true],
    [null, false, false],
    ['system', true, true],
  ])('with %s saved and OS dark=%s, dark is %s', (saved, osDark, dark) => {
    expect(runWith(saved, osDark)).toBe(dark);
  });
});
