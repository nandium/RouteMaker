import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const styles = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheets = readdirSync(styles, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.css') && file !== 'web-only.css')
  .map((file) => ({ file, css: readFileSync(path.join(styles, file), 'utf8') }));

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string) {
  for (const { css } of sheets) {
    const match = new RegExp(
      `(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`
    ).exec(css);
    if (match) return match[1];
  }
  throw new Error(`No rule for ${selector}`);
}

test('every line height is a ratio, so lines keep pace with their text at any system size', () => {
  expect(sheets.length).toBeGreaterThan(10);
  for (const { file, css } of sheets) {
    for (const [, value] of css.matchAll(/line-height:\s*([^;]+);/g)) {
      expect(value.trim(), file).toMatch(/^\d+(\.\d+)?$/);
    }
  }
});

test('the root and the screen each begin a stacking context, so layers above them paint above', () => {
  expect(rule('.app')).toMatch(/z-index:\s*0/);
  expect(rule('.screen')).toMatch(/z-index:\s*0/);
});

test('segmented choices stack from large text, so no label has to wrap to fit', () => {
  expect(rule('.fs-lg .seg')).toMatch(/flex-direction:\s*column/);
});

test('the sheet and notice sit above the sticky bar', () => {
  const z = (selector: string) => Number(/z-index:\s*(\d+)/.exec(rule(selector))![1]);

  expect(z('.scrim')).toBeGreaterThan(z('.filter-sticky'));
  expect(z('.sheet')).toBeGreaterThan(z('.scrim'));
  expect(z('.notice-slot')).toBeGreaterThan(z('.sheet'));
});

test.each([
  '.tag',
  '.thumb',
  '.tile-photo',
  '.det-photo',
  '.picker',
  '.picker-item',
  '.picker-box',
])('lets what hangs off %s show, rather than leaving the clip to the host', (selector) => {
  expect(rule(selector)).toMatch(/overflow:\s*visible/);
});

test('hit targets and the content column take their sizes from the tokens', () => {
  for (const { file, css } of sheets) {
    expect(css, file).not.toMatch(/min-height:\s*44px/);
    expect(css, file).not.toMatch(/max-width:\s*1120px/);
  }
});
