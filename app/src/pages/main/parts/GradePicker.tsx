import { CLIMBING_GRADES } from '../../../client-contract.js';
import { useApp } from '../app-context.js';
import { cx } from '../class-names.js';
import { Icon } from '../components/Icon.js';
import { Pressable } from '../components/Pressable.js';
import { GradeTag } from './GradeTag.js';
import './GradePicker.css';

// How far apart the tiles' left edges are: a tile's width and the gap between tiles in GradePicker.css.
const TILE_STEP = 66;

/**
 * Every grade as a tag to choose from: a scrolling row on compact screens, a wrapped grid on wide
 * ones. Choosing the chosen grade again clears it. `current` is marked as the public grade.
 */
export function GradePicker({
  value,
  current,
  onChange,
}: {
  value: string;
  current: string;
  onChange: (grade: string) => void;
}) {
  const { wideLayout } = useApp();
  const tiles = (
    <view className="picker" role="group" aria-label="Suggest a grade">
      {CLIMBING_GRADES.map((grade) => {
        const chosen = grade === value;
        return (
          <Pressable
            key={grade}
            className={cx('picker-item', chosen && 'is-on')}
            label={`Suggest ${grade}${grade === current ? ', current public grade' : ''}`}
            selected={chosen}
            onTap={() => onChange(chosen ? '' : grade)}
          >
            <view className="picker-box">
              <GradeTag grade={grade} className="picker-tile" />
              {chosen && (
                <view className="picker-check">
                  <Icon name="check" tone="bg" size={14} />
                </view>
              )}
            </view>
            {/* A blank caption keeps tiles without one level with those that have one. */}
            <text className="picker-caption">
              {chosen ? 'Yours' : grade === current ? 'Public' : ' '}
            </text>
          </Pressable>
        );
      })}
    </view>
  );
  return wideLayout ? (
    tiles
  ) : (
    <scroll-view
      className="picker-scroll"
      scroll-orientation="horizontal"
      // Starts with the chosen grade, and the one before it, in view.
      initial-scroll-offset={Math.max(0, (CLIMBING_GRADES.indexOf(value) - 1) * TILE_STEP)}
    >
      {tiles}
    </scroll-view>
  );
}
