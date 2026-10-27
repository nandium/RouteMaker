import { MARK_COLORS } from './marking-colors.js';

export const LEGEND_KINDS = ['hand', 'foot', 'any', 'start', 'finish'] as const;
export type LegendKind = (typeof LEGEND_KINDS)[number];

export const LEGEND_SIZE = { width: 46, height: 28 } as const;
const { width: WIDTH, height: HEIGHT } = LEGEND_SIZE;
const { halo } = MARK_COLORS;

// Each mark is drawn as it looks on a published photo: its color on a dark halo.
const outline = (color: string, dash?: string) =>
  `<rect x="8" y="7" width="24" height="15" rx="2" fill="none" stroke="${halo}" stroke-width="5"/>` +
  `<rect x="8" y="7" width="24" height="15" rx="2" fill="none" stroke="${color}" stroke-width="2.4"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

/** Two strips of tape at `x`; finish tape is broken, where start tape is solid. */
const tape = (x: number, color: string, broken: boolean) =>
  [0, 1]
    .map((strip) => {
      const left = x + strip * 3.6;
      return (
        `<rect x="${left - 0.9}" y="6" width="3.2" height="16" fill="${halo}"/>` +
        `<rect x="${left}" y="7" width="2" height="14" fill="${color}"/>` +
        (broken
          ? `<line x1="${left + 1}" y1="7" x2="${left + 1}" y2="21" stroke="${halo}" stroke-width="2" stroke-dasharray="2 2" opacity="0.6"/>`
          : '')
      );
    })
    .join('');

const SHAPES: Record<LegendKind, string> = {
  hand:
    outline(MARK_COLORS.hand) +
    `<circle cx="35" cy="8" r="7" fill="${halo}"/><circle cx="35" cy="8" r="5.5" fill="${MARK_COLORS.hand}"/>`,
  foot:
    outline(MARK_COLORS.foot, '6 3.5') +
    `<polygon points="35,0.5 42,13 28,13" fill="${halo}"/><polygon points="35,2.7 40.4,11.8 29.6,11.8" fill="${MARK_COLORS.foot}"/>`,
  any:
    outline(MARK_COLORS.any, '2.6 3') +
    `<rect x="28" y="1" width="14" height="14" rx="3.5" fill="${halo}"/><rect x="29.3" y="2.3" width="11.4" height="11.4" rx="2.8" fill="${MARK_COLORS.any}"/>`,
  start: outline(MARK_COLORS.any, '2.6 3') + tape(2, MARK_COLORS.start, false),
  finish: outline(MARK_COLORS.any, '2.6 3') + tape(35, MARK_COLORS.finish, true),
};

/** A glyph for the photo key, on the dark swatch the marks are read against. */
export const legendSvg = (kind: LegendKind) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true" focusable="false">` +
  `<rect width="${WIDTH}" height="${HEIGHT}" rx="4" fill="#26303a"/>${SHAPES[kind]}</svg>`;
