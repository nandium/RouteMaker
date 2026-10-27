import { MARK_COLORS } from '../../src/marking-colors.js';
import { iconNode } from '../dom.js';
import { createSvg, filledRect, type Shape, tapeStrip } from './burn-in.js';
import { type HoldUse, holdUseLabel, TAPE_LIMIT, type TapeKind } from './route-annotations.js';

/** What a tap on a hold does: mark it for a limb, add tape, or delete its boundary. */
export type MarkMode =
  { type: 'use'; use: HoldUse } | { type: 'tape'; kind: TapeKind } | { type: 'delete' };

type ModeInfo = { mode: MarkMode; label: string; short: string; detail: string };

/** The modes in the order the picker shows them. */
export const MODES: readonly ModeInfo[] = [
  {
    mode: { type: 'use', use: 'any' },
    label: holdUseLabel('any'),
    short: 'Any',
    detail: 'Tap a hold to mark it for any limb.',
  },
  {
    mode: { type: 'use', use: 'hand' },
    label: holdUseLabel('hand'),
    short: 'Hand',
    detail: 'Mark a hold for hands only.',
  },
  {
    mode: { type: 'use', use: 'foot' },
    label: holdUseLabel('foot'),
    short: 'Foot',
    detail: 'Mark a foot-only hold. Shown as F.',
  },
  {
    mode: { type: 'tape', kind: 'start' },
    label: 'Start tape',
    short: 'Start',
    detail: `Add a start strip to a hold (up to ${TAPE_LIMIT.start}).`,
  },
  {
    mode: { type: 'tape', kind: 'finish' },
    label: 'Finish tape',
    short: 'Finish',
    detail: `Add a finish strip to a hold (up to ${TAPE_LIMIT.finish}).`,
  },
  {
    mode: { type: 'delete' },
    label: 'Delete boundary',
    short: 'Delete',
    detail: 'Tap a boundary to remove it. Undo brings it back.',
  },
];

const GLYPH_SIZE = 28;
/** The tape glyph's bars, in glyph units, and how its stripes look at that size. */
const GLYPH_BAR = { top: 3.7, width: 3.6, height: 20.6, step: 7.2, first: 5 } as const;
const GLYPH_TAPE_LOOK = { backing: 1.2, stripeSpacing: 3, stripeWidth: 1.5 } as const;

function glyphShapes(mode: Exclude<MarkMode, { type: 'delete' }>): Shape[] {
  const { halo } = MARK_COLORS;
  if (mode.type === 'tape') {
    return [0, 1, 2].flatMap((index) =>
      tapeStrip(
        mode.kind,
        {
          left: GLYPH_BAR.first + index * GLYPH_BAR.step,
          top: GLYPH_BAR.top,
          width: GLYPH_BAR.width,
          height: GLYPH_BAR.height,
        },
        GLYPH_TAPE_LOOK
      )
    );
  }
  switch (mode.use) {
    case 'hand':
      return [
        { type: 'circle', center: [14, 14], radius: 10.5, fill: halo },
        { type: 'circle', center: [14, 14], radius: 8, fill: MARK_COLORS.hand },
      ];
    case 'foot':
      return [
        {
          type: 'polygon',
          points: [
            [14, 2.2],
            [26.5, 24],
            [1.5, 24],
          ],
          fill: halo,
        },
        {
          type: 'polygon',
          points: [
            [14, 6.6],
            [22.3, 21.2],
            [5.7, 21.2],
          ],
          fill: MARK_COLORS.foot,
        },
      ];
    case 'any':
      return [
        filledRect({ left: 2.5, top: 2.5, width: 23, height: 23 }, halo, undefined, 6),
        filledRect(
          { left: 5.2, top: 5.2, width: 17.6, height: 17.6 },
          MARK_COLORS.any,
          undefined,
          3.6
        ),
      ];
  }
}

/** The icon on a mode's button: the mark it draws, as it looks on the photo. */
export function modeGlyph(mode: MarkMode) {
  if (mode.type === 'delete') return iconNode('trash', 'tool__glyph');
  const glyph = createSvg({ width: GLYPH_SIZE, height: GLYPH_SIZE }, glyphShapes(mode));
  glyph.classList.add('tool__glyph');
  return glyph;
}
