import type { ReactNode } from '@lynx-js/react';

import { headingProps } from './Text.js';
import './GroupHead.css';

/** The small heading above a group of rows, with something about the group at its far end. */
export function GroupHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <view className="group-head split-row">
      <text className="t-label" {...headingProps(2)}>
        {title}
      </text>
      {children}
    </view>
  );
}
