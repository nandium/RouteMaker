import type { ReactNode } from '@lynx-js/react';

import { cx } from '../class-names.js';
import { useApp } from '../app-context.js';
import { Pressable } from './Pressable.js';
import { SectionTitle } from './Text.js';
import './Sheet.css';

/**
 * A bottom sheet (a centered dialog on wide screens) over a dimmed scrim. It is shown with
 * `openSheet`, because it must sit above the whole screen, and tapping the scrim closes it.
 */
export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const { closeSheet } = useApp();
  return (
    <>
      <view
        className="scrim"
        bindtap={closeSheet}
        accessibility-element={false}
        aria-hidden="true"
      />
      <view
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        accessibility-exclusive-focus
      >
        <view className="sheet-grab" />
        <SectionTitle>{title}</SectionTitle>
        {/* At large text sizes a sheet outgrows the screen, so its contents scroll. */}
        <scroll-view className="sheet-body" scroll-orientation="vertical">
          {children}
        </scroll-view>
      </view>
    </>
  );
}

/** The choices of a sheet, of which one can be selected. */
export const ChoiceGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <view className="sheet-choices" role="radiogroup" aria-label={label}>
    {children}
  </view>
);

/** One choice among several in a sheet, with a radio mark. */
export function Choice({
  label,
  detail,
  selected,
  onTap,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onTap: () => void;
}) {
  return (
    <Pressable
      className={cx('choice', selected && 'is-on')}
      label={label}
      selected={selected}
      selection="checked"
      onTap={onTap}
    >
      <view className="radio">{selected && <view className="radio-dot" />}</view>
      <view className="choice-copy">
        <text className="t-body">{label}</text>
        {detail && <text className="t-cap c-ink-2">{detail}</text>}
      </view>
    </Pressable>
  );
}
