import type { ReactNode } from '@lynx-js/react';

import { cx } from '../class-names.js';
import { Icon } from './Icon.js';
import { Pressable } from './Pressable.js';
import './Row.css';

/**
 * A tappable list row: its content, then a chevron. Rows are divided by lines, not boxed; a
 * `flush` row has no side padding, for use inside something that already has its own.
 */
export function Row({
  label,
  onTap,
  className,
  flush = false,
  children,
}: {
  label: string;
  onTap: () => void;
  className?: string;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      className={cx('row-item', flush && 'row-flush', className)}
      label={label}
      onTap={onTap}
    >
      {children}
      <Icon name="chevron-right" tone="ink-3" size={22} />
    </Pressable>
  );
}

/** A row's name, in the display face and limited to `lines` lines. */
export const RowTitle = ({ children, lines = 2 }: { children: string; lines?: number }) => (
  <text className="display row-title clamp" text-maxline={String(lines)}>
    {children}
  </text>
);
