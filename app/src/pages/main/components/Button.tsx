import type { IconName, IconTone } from '../../../icons.js';
import { cx } from '../class-names.js';
import { Icon } from './Icon.js';
import { Pressable } from './Pressable.js';
import './Button.css';

type ButtonKind =
  'primary' | 'secondary' | 'wall' | 'wall-line' | 'danger' | 'quiet' | 'quiet-danger';

// Each kind's label color, so its icon can match.
const ICON_TONE: Record<ButtonKind, IconTone> = {
  primary: 'on-action',
  secondary: 'ink',
  wall: 'wall-3',
  'wall-line': 'on-wall',
  danger: 'on-danger',
  quiet: 'link',
  'quiet-danger': 'danger',
};

/** A labelled button. `external` marks one that leaves the app for the browser. */
export function Button({
  children,
  onTap,
  kind = 'primary',
  size,
  icon,
  external = false,
  busy = false,
  disabled = false,
  block = false,
  label,
}: {
  children: string;
  onTap: () => void;
  kind?: ButtonKind;
  size: 'lg' | 'md' | 'sm';
  icon?: IconName;
  external?: boolean;
  /** Shows a spinner and ignores taps. */
  busy?: boolean;
  disabled?: boolean;
  /** Fills the width. */
  block?: boolean;
  /** What a screen reader says, when it should say more than the visible text. */
  label?: string;
  className?: string;
}) {
  const tone = ICON_TONE[kind];
  return (
    <Pressable
      className={cx(
        'btn',
        `btn-${kind}`,
        `btn-${size}`,
        block && 'btn-block',
        disabled && 'is-disabled',
        busy && 'is-busy'
      )}
      label={label ?? children}
      onTap={onTap}
      disabled={disabled || busy}
    >
      {busy ? <view className="spin" /> : icon && <Icon name={icon} tone={tone} size={22} />}
      <text className="btn-label">{children}</text>
      {external && <Icon name="external" tone={tone} size={20} />}
    </Pressable>
  );
}

/** A square 44px button that holds only an icon. */
export function IconButton({
  icon,
  label,
  onTap,
  tone = 'ink',
}: {
  icon: IconName;
  label: string;
  onTap: () => void;
  tone?: IconTone;
}) {
  return (
    <Pressable className="ibtn" label={label} onTap={onTap}>
      <Icon name={icon} tone={tone} size={22} />
    </Pressable>
  );
}

/** Underlined text that acts on the screen it is in. */
export function LinkButton({ children, onTap }: { children: string; onTap: () => void }) {
  return (
    <Pressable className="link" label={children} onTap={onTap}>
      <text className="link-label">{children}</text>
    </Pressable>
  );
}
