import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { BRAND_PALETTE } from '../brand.js';
import { ICON_COLORS } from '../icons.js';
import { MARK_COLORS } from '../marking-colors.js';

const app = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const theme = readFileSync(path.join(app, 'theme.css'), 'utf8');

/** The `--name: value` declarations of the rule that begins with `selector`. */
function tokens(selector: string) {
  const block = theme.slice(theme.indexOf(`${selector} {`)).split('}')[0];
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  );
}

const light = tokens(':root');
const dark = { ...light, ...tokens('.theme-dark') };

// Lynx svg content and gradients are written with literal colors, so these checks keep those
// literals in step with the tokens.

test.each(['light', 'dark'] as const)('icon colors match the %s theme tokens', (scheme) => {
  const palette = scheme === 'light' ? light : dark;
  for (const [tone, color] of Object.entries(ICON_COLORS[scheme])) {
    expect(color, `${scheme} ${tone}`).toBe(palette[`c-${tone}`]);
  }
});

test('marking colors match the --m-* tokens', () => {
  for (const [name, color] of Object.entries(MARK_COLORS)) {
    expect(color, name).toBe(light[`m-${name}`]);
  }
});

// The gradients in theme.css, and the theme colors each is made of.
const GRADIENTS: Record<string, string[]> = {
  'bg-wall': ['c-wall', 'c-wall-2', 'c-wall-3'],
  'bg-shard-1': ['c-wall-3'],
  'bg-shard-2': ['c-wall-2'],
  'bg-cut': ['c-bg'],
  'bg-cut-wide': ['c-bg'],
  'bg-tile': ['c-wall', 'c-wall-3'],
  'bg-art-wall': ['c-wall', 'c-wall-3'],
  'bg-art-shard': ['c-wall-2'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`bg-g${n}`, [`g${n}`, `g${n}-shade`]])),
};
const hexes = (value: string) => new Set(value.match(/#[0-9a-f]{6}/gi));

test.each(['light', 'dark'] as const)('the gradients are made of the %s theme colors', (scheme) => {
  const palette = scheme === 'light' ? light : dark;
  for (const [name, colors] of Object.entries(GRADIENTS)) {
    expect(hexes(palette[name]), `${scheme} ${name}`).toEqual(
      new Set(colors.map((color) => palette[color]))
    );
  }
});

test('stylesheets take their gradients from theme.css rather than writing their own', () => {
  const styles = path.join(app, 'src/pages/main');
  const sheets = readdirSync(styles, { recursive: true, encoding: 'utf8' }).filter((file) =>
    file.endsWith('.css')
  );

  expect(sheets.length).toBeGreaterThan(0);
  for (const sheet of sheets) {
    expect(readFileSync(path.join(styles, sheet), 'utf8'), sheet).not.toContain('linear-gradient(');
  }
});

// The native hosts repeat the page colors: Android in res/values/colors.xml (themes.xml picks
// the light or dark one), iOS in the Assets.xcassets color sets.
const NATIVE_COLORS = {
  background: { colorset: 'Page', expected: (scheme: Scheme) => palette(scheme)['c-bg'] },
  nav: { colorset: 'Nav', expected: (scheme: Scheme) => palette(scheme)['c-nav'] },
  on_nav: { colorset: 'OnNav', expected: (scheme: Scheme) => palette(scheme)['c-on-nav'] },
  marker: { colorset: 'Marker', expected: (scheme: Scheme) => BRAND_PALETTE[scheme].primary },
};
type Scheme = 'light' | 'dark';
const palette = (scheme: Scheme) => (scheme === 'light' ? light : dark);
const android = path.join(app, 'android/app/src/main/res');
const catalog = path.join(app, 'ios/RouteMaker/RouteMaker/Assets.xcassets');

const androidColors = Object.fromEntries(
  [
    ...readFileSync(path.join(android, 'values/colors.xml'), 'utf8').matchAll(
      /<color name="(\w+)">(#[0-9A-Fa-f]{6})<\/color>/g
    ),
  ].map(([, name, hex]) => [name, hex.toLowerCase()])
);

/** The light and dark colors of an asset-catalog color set, as #rrggbb. */
function colorset(name: string) {
  const { colors } = JSON.parse(
    readFileSync(path.join(catalog, `${name}.colorset/Contents.json`), 'utf8')
  );
  const hex = ({ color }: { color: { components: Record<string, string> } }) =>
    '#' +
    ['red', 'green', 'blue']
      .map((channel) => color.components[channel].slice(2).toLowerCase())
      .join('');
  return {
    light: hex(colors.find((entry: { appearances?: unknown }) => !entry.appearances)),
    dark: hex(colors.find((entry: { appearances?: unknown }) => entry.appearances)),
  };
}

test.each(Object.entries(NATIVE_COLORS))(
  'Android %s colors match the theme',
  (name, { expected }) => {
    expect(androidColors[`${name}_light`]).toBe(expected('light'));
    expect(androidColors[`${name}_dark`]).toBe(expected('dark'));
  }
);

test.each(Object.entries(NATIVE_COLORS))(
  'the iOS %s color set matches the theme',
  (_, { colorset: set, expected }) => {
    expect(colorset(set)).toEqual({ light: expected('light'), dark: expected('dark') });
  }
);

test('Android window backgrounds use the matching page color', () => {
  const background = (folder: string) =>
    readFileSync(path.join(android, folder, 'themes.xml'), 'utf8').match(
      /name="android:windowBackground">@color\/(\w+)</
    )?.[1];
  expect(background('values')).toBe('background_light');
  expect(background('values-night')).toBe('background_dark');
});
