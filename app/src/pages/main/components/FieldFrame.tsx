import type { ReactNode } from '@lynx-js/react';

import { Icon } from './Icon.js';
import './FieldFrame.css';

/**
 * What surrounds a form control: its label above, and beneath it the error, or else the rule for
 * the control and, if it has a limit, how much of it is used.
 */
export function FieldFrame({
  label,
  hint,
  error,
  count,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <view className="field">
      {label && (
        <text className="field-label" accessibility-element={false}>
          {label}
        </text>
      )}
      {children}
      {error ? (
        <view className="field-error">
          <Icon name="alert" tone="danger" size={16} />
          <text className="field-error-text" role="alert">
            {error}
          </text>
        </view>
      ) : (
        (hint || count) && (
          <view className="field-foot">
            <text className="field-hint">{hint}</text>
            {count && <text className="t-cap c-ink-2">{count}</text>}
          </view>
        )
      )}
    </view>
  );
}
