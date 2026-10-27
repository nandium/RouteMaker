import { useRef, useState } from '@lynx-js/react';
import type { NodesRef } from '@lynx-js/types';

import { cx } from '../class-names.js';
import { IconButton } from './Button.js';
import { FieldFrame } from './FieldFrame.js';
import './Field.css';

// Hosts resize the view above the keyboard a moment after a field is focused, so the field is
// brought into view once they have.
const KEYBOARD_SETTLE_MS = 300;

/** A single-line text input with its label above, and the rule or error beneath. */
export function Field({
  label,
  value,
  onInput,
  onConfirm,
  maxLength,
  type = 'text',
  placeholder,
  hint,
  error,
  showCount = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onInput?: (value: string) => void;
  /** Called when the keyboard's action key is pressed. */
  onConfirm?: () => void;
  maxLength?: number;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  /** The rule for this field, shown until there is an error. */
  hint?: string;
  error?: string;
  /** Shows how much of `maxLength` is used. */
  showCount?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const box = useRef<NodesRef>(null);
  const secret = type === 'password';

  return (
    <FieldFrame
      label={label}
      hint={hint}
      error={error}
      count={showCount ? `${value.length}/${maxLength}` : undefined}
    >
      <view
        ref={box}
        className={cx(
          'input-box',
          focused && 'is-focus',
          error && 'is-error',
          disabled && 'is-disabled'
        )}
      >
        <input
          className="input"
          accessibility-element
          accessibility-label={error ? `${label}, error: ${error}` : label}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          type={secret && revealed ? 'text' : type}
          confirm-type={onConfirm ? 'done' : undefined}
          maxlength={maxLength}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          bindinput={(event) => onInput?.(event.detail.value)}
          bindconfirm={onConfirm}
          bindfocus={() => {
            setFocused(true);
            setTimeout(() => {
              box.current
                ?.invoke({
                  method: 'scrollIntoView',
                  params: { scrollIntoViewOptions: { block: 'center', behavior: 'smooth' } },
                })
                .exec();
            }, KEYBOARD_SETTLE_MS);
          }}
          bindblur={() => setFocused(false)}
        />
        {secret && (
          <IconButton
            icon={revealed ? 'eye-off' : 'eye'}
            tone="ink-2"
            label={revealed ? 'Hide password' : 'Show password'}
            onTap={() => setRevealed(!revealed)}
          />
        )}
      </view>
    </FieldFrame>
  );
}
