import type { ReactNode } from '@lynx-js/react';

import './Card.css';

/** A raised panel with a hard edge, for something a climber fills in or reads as a unit. */
export const Card = ({ children }: { children: ReactNode }) => (
  <view className="card">{children}</view>
);
