import { tierOf } from '../../../grade-tiers.js';
import { cx } from '../class-names.js';
import { GlyphText } from '../components/Text.js';
import './GradeTag.css';

type TagSize = 's' | 'm' | 'l' | 'xl';

// Numeral size and line height in px for each tag size.
const NUMERAL: Record<TagSize, [size: number, leading: number]> = {
  s: [18, 20],
  m: [26, 28],
  l: [40, 42],
  xl: [56, 58],
};

/**
 * A route's grade as a colored tag whose color is its tier. It is decorative: whatever holds it
 * names the grade, unless it gets a `label` and stands alone. No grade shows a dashed tag.
 * `className` may add `tag-ring` (a halo in the page color, to set it off a photo), `tag-pin` (a
 * button's hard shadow) or `tag-stamp` (stamped onto the page as it appears).
 */
export function GradeTag({
  grade,
  size = 'm',
  label,
  className,
}: {
  grade: string | null | undefined;
  size?: TagSize;
  label?: string;
  className?: string;
}) {
  const [numeral, leading] = NUMERAL[size];
  return (
    <view
      className={cx('tag', `tag-${size}`, `g${tierOf(grade)}`, className)}
      accessibility-element={label ? true : false}
      accessibility-label={label}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      <GlyphText className="display tag-num" size={numeral} leading={leading}>
        {grade || '–'}
      </GlyphText>
    </view>
  );
}
