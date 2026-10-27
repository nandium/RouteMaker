import type { IconName } from '../../../icons.js';
import { Icon } from './Icon.js';
import './Stat.css';

/** A count with its icon; the icon alone says what is counted, so the phrase goes to the reader. */
export function Stat({
  icon,
  tone = 'ink-2',
  count,
  phrase,
}: {
  icon: IconName;
  tone?: 'ink-2' | 'link';
  count: number;
  /** The count in words, such as `3 likes`. */
  phrase: string;
}) {
  return (
    <view
      className="stat"
      accessibility-element
      accessibility-label={phrase}
      aria-label={phrase}
      role="text"
    >
      <Icon name={icon} tone={tone} size={16} />
      <text className={tone === 'link' ? 'stat-n c-link' : 'stat-n'}>{count}</text>
    </view>
  );
}
