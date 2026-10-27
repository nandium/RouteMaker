import { BRAND_PALETTE, logoMarkSvg } from '../src/brand.js';
import { APP_NAME } from '../src/client-contract.js';
import type { ColorScheme } from '../src/host-contract.js';
import { WEB_PATHS } from '../src/web-pages.js';
import { element, iconButton, iconNode, textElement } from './dom.js';
import type { ToolPage } from './pages.js';
import { chooseTheme, currentScheme, onThemeChange } from './theme.js';

const NAV = [
  { name: 'gym-map', label: 'Gym map', href: WEB_PATHS.gymMap, icon: 'map' },
  { name: 'new-route', label: 'Add route', href: WEB_PATHS.newRoute, icon: 'plus' },
] as const;

function themeToggle() {
  const toggle = iconButton('moon', '');
  toggle.classList.add('theme-toggle');
  const sync = (scheme: ColorScheme) => {
    toggle.setAttribute('aria-label', `Switch to ${scheme === 'dark' ? 'light' : 'dark'} theme`);
    toggle.replaceChildren(iconNode(scheme === 'dark' ? 'sun' : 'moon'));
  };
  sync(currentScheme());
  onThemeChange(sync);
  toggle.onclick = () => chooseTheme(currentScheme() === 'dark' ? 'light' : 'dark');
  return toggle;
}

export function createHeader(current: ToolPage['name']) {
  const brand = element('a', 'web-header__brand');
  brand.href = WEB_PATHS.gyms;
  brand.setAttribute('aria-label', 'Back to RouteMaker gyms');
  // The logo's fills are baked into its SVG, so it is repainted when the scheme changes.
  const mark = element('span', 'web-header__mark icon');
  const paintMark = (scheme: ColorScheme) => {
    mark.innerHTML = logoMarkSvg(BRAND_PALETTE[scheme]);
  };
  paintMark(currentScheme());
  onThemeChange(paintMark);
  brand.append(mark, textElement('span', APP_NAME, 'web-header__wordmark display'));

  const header = element('header', 'web-header');
  header.append(brand);
  if (NAV.some((item) => item.name === current)) {
    const nav = element('nav', 'web-header__nav');
    nav.setAttribute('aria-label', 'Browser tools');
    for (const item of NAV) {
      const link = textElement('a', item.label, 'web-header__link display');
      link.href = item.href;
      if (item.name === current) link.setAttribute('aria-current', 'page');
      link.prepend(iconNode(item.icon));
      nav.append(link);
    }
    header.append(nav);
  }
  header.append(themeToggle());
  return header;
}
