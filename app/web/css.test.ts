import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['tools.css', 'editor/editor.css', 'map/map.css', 'mail.css', 'web.css'];
const MOTION = /^(animation|transition)(-|$)/;

const parse = (file: string) => postcss.parse(readFileSync(path.join(here, file), 'utf8'));
const isReducedMotion = (node: { type: string }): node is AtRule =>
  node.type === 'atrule' &&
  (node as AtRule).name === 'media' &&
  (node as AtRule).params.includes('prefers-reduced-motion: reduce');

/** Rules, outside any reduced-motion block, that move something. */
function movingRules(file: string) {
  const found: Rule[] = [];
  parse(file).walkRules((rule) => {
    if (rule.parent && isReducedMotion(rule.parent)) return;
    if (rule.nodes.some((node) => node.type === 'decl' && MOTION.test(node.prop))) found.push(rule);
  });
  return found;
}

describe('reduced motion', () => {
  it.each(FILES)('in %s turns off every animation and transition, and comes last', (file) => {
    const root = parse(file);
    const moving = movingRules(file);
    if (!moving.length) return;
    const reduced = root.nodes.filter(isReducedMotion);

    // One block, at the end: nothing after it can win the cascade back.
    expect(reduced).toHaveLength(1);
    expect(root.last).toBe(reduced[0]);

    // Each moving selector appears in it, with the same specificity, so it comes later and wins.
    const switchedOff = new Map<string, Rule>();
    reduced[0].walkRules((rule) => {
      for (const selector of rule.selectors) switchedOff.set(selector, rule);
    });
    for (const rule of moving) {
      for (const selector of rule.selectors) {
        const off = switchedOff.get(selector);
        expect(off, `${selector} is not switched off`).toBeDefined();
        const stops = off!.nodes.some(
          (node) =>
            node.type === 'decl' &&
            ((MOTION.test(node.prop) && node.value === 'none') ||
              (node.prop === 'display' && node.value === 'none'))
        );
        expect(stops, `${selector} is not stopped`).toBe(true);
      }
    }
  });
});

describe('the stylesheets', () => {
  it.each(FILES)(
    '%s has no rule that depends on !important, except the hidden attribute',
    (file) => {
      const important: string[] = [];
      parse(file).walkDecls((decl) => {
        if (decl.important) important.push(`${(decl.parent as Rule).selector} { ${decl.prop} }`);
      });

      expect(important.filter((rule) => !rule.startsWith('[hidden]'))).toEqual([]);
    }
  );
});
