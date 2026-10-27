import type { ReactNode } from '@lynx-js/react';

import { useApp } from '../app-context.js';
import { DisplayText } from './Text.js';
import './Hero.css';

/**
 * The banner that opens a screen: the wall in the brand's colors, cut diagonally at the bottom.
 * A `panel` instead fills the side of a wide screen, so it has no cut.
 */
export function Hero({ children, panel = false }: { children: ReactNode; panel?: boolean }) {
  return (
    <view className={panel ? 'hero hero-panel' : 'hero'}>
      <view className="shard-1" />
      <view className="shard-2" />
      <view className="hero-inner">{children}</view>
      {!panel && <view className="hero-cut" />}
    </view>
  );
}

/** A hero's content and what goes beside it: stacked on compact screens, apart on wide ones. */
export const HeroRow = ({ children }: { children: ReactNode }) => (
  <view className="hero-row">{children}</view>
);

/** The usual hero content: a title and a line under it, with something at the far end. */
export const HeroHeader = ({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) => (
  <HeroRow>
    <view className="hero-copy">
      <HeroTitle>{title}</HeroTitle>
      <HeroSubtitle>{subtitle}</HeroSubtitle>
    </view>
    {aside}
  </HeroRow>
);

/** Back, and one more action, along the top of a hero. */
export const HeroBar = ({ children }: { children: ReactNode }) => (
  <view className="hero-bar">{children}</view>
);

/** Buttons that share a hero's width, and stack when text is large or the screen narrow. */
export const HeroActions = ({ children }: { children: ReactNode }) => (
  <view className="hero-actions">{children}</view>
);

// Title size and line height in px: [compact, wide] for a screen title, then for a smaller one.
const TITLE = {
  large: [
    [44, 44],
    [64, 62],
  ],
  small: [
    [36, 38],
    [52, 52],
  ],
} as const;

export function HeroTitle({
  children,
  small = false,
  lines,
}: {
  children: string;
  small?: boolean;
  /** Limits the title to this many lines. */
  lines?: number;
}) {
  const { wideLayout } = useApp();
  const [size, leading] = TITLE[small ? 'small' : 'large'][wideLayout ? 1 : 0];
  return (
    <DisplayText className="hero-title" size={size} leading={leading} lines={lines} heading={1}>
      {children}
    </DisplayText>
  );
}

export const HeroSubtitle = ({ children }: { children: string }) => (
  <text className="hero-sub">{children}</text>
);
