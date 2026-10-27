import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installDom } from '../test-dom.js';
import { MARK_COLORS } from '../../src/marking-colors.js';
import { type MarkMode, MODES, modeGlyph } from './mark-modes.js';

describe('mark modes', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('are six, in the order the picker shows them', () => {
    expect(MODES.map(({ label }) => label)).toEqual([
      'Any limb',
      'Hand only',
      'Foot only',
      'Start tape',
      'Finish tape',
      'Delete boundary',
    ]);
    expect(MODES.map(({ short }) => short)).toEqual([
      'Any',
      'Hand',
      'Foot',
      'Start',
      'Finish',
      'Delete',
    ]);
  });

  it('say what the limit of each kind of tape is', () => {
    const detail = (label: string) => MODES.find((mode) => mode.label === label)!.detail;

    expect(detail('Start tape')).toContain('up to 4');
    expect(detail('Finish tape')).toContain('up to 2');
  });

  describe('glyphs', () => {
    const glyph = (mode: MarkMode) => modeGlyph(mode) as unknown as SVGSVGElement;
    const fills = (svg: SVGSVGElement) =>
      [...svg.querySelectorAll('[fill]')].map((node) => node.getAttribute('fill'));

    it('show the mark a limb gets on the photo', () => {
      const hand = glyph({ type: 'use', use: 'hand' });
      const foot = glyph({ type: 'use', use: 'foot' });
      const any = glyph({ type: 'use', use: 'any' });

      expect(hand.querySelectorAll('circle')).toHaveLength(2);
      expect(fills(hand)).toContain(MARK_COLORS.hand);
      expect(foot.querySelector('polygon')).not.toBeNull();
      expect(fills(foot)).toContain(MARK_COLORS.foot);
      expect(any.querySelectorAll('rect')).toHaveLength(2);
      expect(fills(any)).toContain(MARK_COLORS.any);
    });

    it('show three strips of tape, solid for start and hatched for finish', () => {
      const start = glyph({ type: 'tape', kind: 'start' });
      const finish = glyph({ type: 'tape', kind: 'finish' });

      expect(fills(start).filter((fill) => fill === MARK_COLORS.start)).toHaveLength(3);
      expect(start.querySelector('line')).toBeNull();
      expect(fills(finish).filter((fill) => fill === MARK_COLORS.finish)).toHaveLength(3);
      expect(finish.querySelectorAll('g')).toHaveLength(3);
    });

    it('are sized by CSS and hidden from assistive technology, which has the label', () => {
      const svg = glyph({ type: 'use', use: 'hand' });

      expect(svg.getAttribute('viewBox')).toBe('0 0 28 28');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.classList.contains('tool__glyph')).toBe(true);
    });

    it('use an icon for deleting, which is not a mark on the photo', () => {
      const trash = modeGlyph({ type: 'delete' });

      expect(trash.classList.contains('tool__glyph')).toBe(true);
      expect(trash.querySelector('svg')).not.toBeNull();
    });
  });
});
