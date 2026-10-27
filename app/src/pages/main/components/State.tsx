import type { ReactNode } from '@lynx-js/react';

import { cx } from '../class-names.js';
import { Icon } from './Icon.js';
import { DisplayText } from './Text.js';
import './State.css';

/** A screen or section with nothing to show, or that failed to load; `children` are its actions. */
export function State({
  title,
  body,
  failed = false,
  children,
}: {
  title: string;
  body?: string;
  /** Draws the illustration with a red hold. */
  failed?: boolean;
  children?: ReactNode;
}) {
  return (
    <view className="state">
      <view className={cx('state-art', failed && 'is-failed')} accessibility-element={false}>
        <view className="art-wall" />
        <view className="art-shard" />
        <view className="art-hold">{failed && <Icon name="close" tone="danger" size={20} />}</view>
      </view>
      <DisplayText className="state-title" size={30} leading={32} heading={2}>
        {title}
      </DisplayText>
      {body && <text className="state-body">{body}</text>}
      {children && <view className="state-actions">{children}</view>}
    </view>
  );
}

/** Stand-ins shaped like rows while a list loads; `label` is what a screen reader says instead. */
export function RowSkeletons({
  count,
  label,
  kind = 'route',
}: {
  count: number;
  label: string;
  kind?: 'route' | 'gym';
}) {
  return (
    <view aria-busy="true" accessibility-element accessibility-label={label} aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <view className="skel-row" key={index}>
          <view className={cx('skel', kind === 'gym' ? 'skel-tile' : 'skel-thumb')} />
          <view className="skel-copy">
            <view className="skel skel-title" />
            <view className="skel skel-line" />
            {kind === 'route' && <view className="skel skel-line skel-short" />}
          </view>
        </view>
      ))}
    </view>
  );
}
