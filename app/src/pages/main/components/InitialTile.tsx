import type { IconName } from '../../../icons.js';
import { cx } from '../class-names.js';
import { Icon } from './Icon.js';
import { GlyphText } from './Text.js';
import './InitialTile.css';

type TileSize = 's' | 'm' | 'l' | 'country';

// Letter size and line height in px for each tile size.
const LETTER: Record<TileSize, [size: number, leading: number]> = {
  s: [20, 22],
  m: [26, 28],
  l: [52, 54],
  country: [24, 26],
};

/**
 * A letter, a short code or an icon on a tile of the wall's two colors: what stands in for a photo
 * of a person or a place. `bordered` frames it in chalk, for use on the wall.
 */
export function InitialTile({
  letter,
  icon,
  size = 'm',
  bordered = false,
}: {
  letter?: string;
  icon?: IconName;
  size?: TileSize;
  bordered?: boolean;
}) {
  const [fontSize, leading] = LETTER[size];
  return (
    <view
      className={cx('tile', `tile-${size}`, bordered && 'tile-bordered')}
      accessibility-element={false}
    >
      {icon ? (
        <Icon name={icon} tone="on-wall" size={18} />
      ) : (
        <GlyphText className="display tile-letter" size={fontSize} leading={leading}>
          {letter}
        </GlyphText>
      )}
    </view>
  );
}
