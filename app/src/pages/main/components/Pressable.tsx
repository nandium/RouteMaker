import type { ReactNode } from '@lynx-js/react';

import { cx } from '../class-names.js';

/** What `selected` means to the web host: a toggle, one choice of several, or the page being shown. */
type Selection = 'pressed' | 'checked' | 'current';

/** Anything tappable: it announces itself as a button, or as selected when `selected` is given. */
export function Pressable({
  children,
  label,
  onTap,
  className,
  selected,
  selection = 'pressed',
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onTap: () => void;
  className?: string;
  selected?: boolean;
  selection?: Selection;
  disabled?: boolean;
}) {
  const state = disabled
    ? 'Disabled'
    : selected === undefined
      ? undefined
      : selected
        ? 'Selected'
        : 'Not selected';
  return (
    <view
      className={cx('pressable', className)}
      bindtap={disabled ? undefined : onTap}
      accessibility-element
      accessibility-traits={disabled ? 'disabled' : selected ? 'selected' : 'button'}
      accessibility-role-description={selection === 'checked' ? 'radio button' : 'button'}
      accessibility-label={label}
      accessibility-value={state}
      focusable
      // Lynx Web ignores accessibility-*; its host also activates role=button from the keyboard.
      aria-label={label}
      aria-pressed={selection === 'pressed' ? selected : undefined}
      aria-checked={selection === 'checked' ? selected : undefined}
      aria-current={selection === 'current' && selected ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      role={selection === 'checked' ? 'radio' : 'button'}
      tabindex="0"
    >
      {children}
    </view>
  );
}
