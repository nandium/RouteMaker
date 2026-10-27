import type { IconName } from '../../../icons.js';
import { cx } from '../class-names.js';
import { Icon } from './Icon.js';
import { Pressable } from './Pressable.js';
import './Segmented.css';

type SegmentOption<T extends string> = { id: T; label: string; icon?: IconName };

/** A row of exclusive choices. With no `value` chosen, none looks selected. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  small = false,
}: {
  /** Names the group for a screen reader. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (id: T) => void;
  small?: boolean;
}) {
  return (
    <view className={cx('seg', small && 'seg-s')} role="group" aria-label={label}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable
            key={option.id}
            className={cx('seg-item', on && 'is-on')}
            label={option.label}
            selected={on}
            onTap={() => onChange(option.id)}
          >
            {option.icon && <Icon name={option.icon} tone={on ? 'bg' : 'ink'} size={20} />}
            <text className="seg-label">{option.label}</text>
          </Pressable>
        );
      })}
    </view>
  );
}
