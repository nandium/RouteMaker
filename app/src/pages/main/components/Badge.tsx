import type { IconName, IconTone } from '../../../icons.js';
import { cx } from '../class-names.js';
import { Icon } from './Icon.js';
import './Badge.css';

type BadgeTone = 'solid' | 'outline' | 'success' | 'danger' | 'dashed';

// Each tone's label color, so its icon can match.
const ICON_TONE: Record<BadgeTone, IconTone> = {
  solid: 'bg',
  outline: 'ink',
  success: 'success',
  danger: 'danger',
  dashed: 'ink-2',
};

/** A small tag saying what something is. The word carries the meaning; the tone only backs it up. */
export function Badge({ label, tone, icon }: { label: string; tone: BadgeTone; icon?: IconName }) {
  return (
    <view className={cx('badge', `badge-${tone}`)}>
      {icon && <Icon name={icon} tone={ICON_TONE[tone]} size={14} />}
      <text className="t-cap-b badge-label">{label}</text>
    </view>
  );
}
