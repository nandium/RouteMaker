import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BRAND_PALETTE } from '../src/brand.js';
import { iconNode } from './dom.js';
import { createHeader } from './header.js';
import { allByRole, byRole, installDom, queryByRole, stubMatchMedia } from './test-dom.js';
import { currentScheme } from './theme.js';

describe('tool page header', () => {
  beforeEach(() => {
    installDom();
    stubMatchMedia({ dark: false });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('marks the current tool in the navigation', () => {
    const header = createHeader('new-route');

    const nav = byRole(header, 'navigation');
    expect(allByRole(nav, 'link').map((link) => link.textContent)).toEqual([
      'Gym map',
      'Add route',
    ]);
    expect(byRole(nav, 'link', 'Add route').getAttribute('aria-current')).toBe('page');
    expect(byRole(nav, 'link', 'Gym map').getAttribute('aria-current')).toBeNull();
  });

  it.each(['auth-action', 'used-link'] as const)(
    'omits the navigation on the %s page and links home',
    (page) => {
      const header = createHeader(page);

      expect(queryByRole(header, 'navigation')).toBeNull();
      expect(byRole(header, 'link', 'Back to RouteMaker gyms').getAttribute('href')).toBe('/gyms');
    }
  );

  it('switches theme from the toggle, relabels it and repaints the logo', () => {
    const header = createHeader('gym-map');
    const toggle = byRole(header, 'button', 'Switch to dark theme');
    const logo = header.querySelector('svg[viewBox="0 0 348 399"]')!.parentElement!;
    const moonIcon = toggle.innerHTML;
    const sunIcon = iconNode('sun').outerHTML;
    expect(logo.innerHTML).toContain(BRAND_PALETTE.light.primary);

    toggle.click();

    expect(currentScheme()).toBe('dark');
    expect(byRole(header, 'button', 'Switch to light theme')).toBe(toggle);
    expect(toggle.innerHTML).toBe(sunIcon);
    expect(toggle.innerHTML).not.toBe(moonIcon);
    expect(logo.innerHTML).toContain(BRAND_PALETTE.dark.primary);
  });
});
