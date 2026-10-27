import { fireEvent } from '@lynx-js/react/testing-library';
import { beforeEach, expect, test, vi } from 'vitest';

import { ICON_COLORS } from '../../../icons.js';
import { installHost, resetHost, startApp, tapText, updateHostProps } from './helpers.js';

beforeEach(() => resetHost());

const root = () => elementTree.root!.querySelector('.app')!;
const icons = () =>
  [...elementTree.root!.querySelectorAll('svg')].map((svg) => svg.getAttribute('content'));
const usesIconColor = (color: string) =>
  icons().some((content) => content?.includes(`stroke="${color}"`));

test('keeps the bars outside the screen scroller', async () => {
  const { queries } = startApp();

  const insideScroller = () => queries.getByLabelText('Primary').closest('scroll-view');
  expect(insideScroller()).toBeNull();

  await tapText(queries, 'Central Bloc');
  await tapText(queries, 'Blue Moon');
  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
  expect(insideScroller()).toBeNull();
  expect(queries.getByLabelText('ROUTEMAKER').closest('scroll-view')).toBeNull();
});

test('puts navigation in the top bar, not a tab bar, on wide layouts', async () => {
  resetHost({ wideLayout: true });
  const { queries } = startApp();

  expect(queries.queryByLabelText('Primary')).toBeNull();
  expect(queries.getByLabelText('Gyms').closest('.topbar')).not.toBeNull();
  expect(queries.getByLabelText('Account, guest, sign in').closest('.topbar')).not.toBeNull();
});

test('marks the root with the theme, layout, motion and text size the host reports', () => {
  resetHost({ systemTheme: 'dark', wideLayout: true, reducedMotion: true, fontScale: 2 });
  startApp();

  expect(root().className.split(' ').sort()).toEqual(
    ['app', 'fs-lg', 'fs-xl', 'rm', 'theme-dark', 'wide'].sort()
  );
});

test('leaves type alone at normal text size', () => {
  const { queries } = startApp();

  expect(queries.getByText('Gyms', { selector: '.hero-title' }).getAttribute('style')).toContain(
    'font-size: 44px'
  );
});

/** The font size, in px, of the text found by `selector` and `text`. */
const fontSize = (
  queries: ReturnType<typeof startApp>['queries'],
  text: string,
  selector: string
) =>
  parseFloat(
    /font-size: ([\d.]+)px/.exec(queries.getByText(text, { selector }).getAttribute('style')!)![1]
  );

test('stops display type growing at 150% and glyph text at 130% as the system size rises', () => {
  const { queries } = startApp();
  const title = fontSize(queries, 'Gyms', '.hero-title');
  const wordmark = fontSize(queries, 'ROUTEMAKER', '.wordmark');

  // The system multiplies every size by the font scale, so each is shrunk by the same factor
  // beyond its cap and ends at the cap.
  updateHostProps({ fontScale: 3 });

  expect(fontSize(queries, 'Gyms', '.hero-title') * 3).toBeCloseTo(title * 1.5, 1);
  expect(fontSize(queries, 'ROUTEMAKER', '.wordmark') * 3).toBeCloseTo(wordmark * 1.3, 1);
});

test('follows the host when its theme, layout or motion setting changes', () => {
  startApp();
  expect(root().className).not.toContain('wide');

  updateHostProps({ systemTheme: 'dark' });
  expect(root().className).toContain('theme-dark');

  updateHostProps({ wideLayout: true, reducedMotion: true });
  expect(root().className).toContain('wide');
  expect(root().className).toContain('rm');
});

/** Opens the appearance sheet from the top bar and picks one of its three choices. */
async function chooseTheme(queries: ReturnType<typeof startApp>['queries'], choice: string) {
  fireEvent.tap(await queries.findByLabelText('Appearance'));
  fireEvent.tap(await queries.findByLabelText(choice));
}

test('follows the system theme, and a theme the visitor chose wins and persists', async () => {
  resetHost({ systemTheme: 'dark' });
  const setPreference = vi.fn();
  installHost({ RouteMakerAppearance: { setPreference } });
  const { queries } = startApp();
  expect(usesIconColor(ICON_COLORS.dark.ink)).toBe(true);

  await chooseTheme(queries, 'Light');

  expect(root().className).toContain('theme-light');
  expect(usesIconColor(ICON_COLORS.light.ink)).toBe(true);
  expect(usesIconColor(ICON_COLORS.dark.ink)).toBe(false);
  expect(setPreference).toHaveBeenCalledWith('light');
});

test('a guest can go back to following the device', async () => {
  resetHost({ systemTheme: 'dark' });
  const setPreference = vi.fn();
  installHost({ RouteMakerAppearance: { setPreference } });
  const { queries } = startApp();
  await chooseTheme(queries, 'Light');
  expect(root().className).toContain('theme-light');

  fireEvent.tap(await queries.findByLabelText('Auto'));

  expect(root().className).toContain('theme-dark');
  expect(setPreference).toHaveBeenLastCalledWith('system');
  expect(queries.getByLabelText('Auto')).toHaveAttribute('aria-pressed', 'true');
});

test('shows the choice in force in the appearance sheet, and closes it with Done', async () => {
  resetHost({ themePreference: 'dark' });
  const { queries } = startApp();

  fireEvent.tap(await queries.findByLabelText('Appearance'));
  expect(await queries.findByText('Appearance', { selector: '.display' })).toBeInTheDocument();
  expect(queries.getByLabelText('Dark')).toHaveAttribute('aria-pressed', 'true');

  await tapText(queries, 'Done');
  expect(queries.queryByText('Appearance', { selector: '.display' })).not.toBeInTheDocument();
});

test('starts from the theme the visitor saved', () => {
  resetHost({ systemTheme: 'dark', themePreference: 'light' });
  startApp();

  expect(root().className).toContain('theme-light');
});

test('follows the device while the preference is "system"', () => {
  resetHost({ systemTheme: 'dark', themePreference: 'system' });
  startApp();

  expect(root().className).toContain('theme-dark');
});

test('a theme the visitor chose is not overridden by the system theme', async () => {
  const { queries } = startApp();
  await chooseTheme(queries, 'Dark');

  updateHostProps({ systemTheme: 'light' });

  expect(root().className).toContain('theme-dark');
});

test('enlarges icons with the system text size', () => {
  const iconWidth = () =>
    parseFloat(
      /width: ([\d.]+)px/.exec(
        elementTree.root!.querySelector('.ibtn svg')!.getAttribute('style')!
      )![1]
    );
  startApp();
  const normal = iconWidth();

  updateHostProps({ fontScale: 2.5 });

  expect(iconWidth()).toBeGreaterThan(normal);
});
