import type { ReactNode } from '@lynx-js/react';

import { useApp } from '../app-context.js';
import { cx } from '../class-names.js';
import { displayStyle, glyphStyle } from '../text-scale.js';

/** The attributes that make text a heading to a screen reader on the web, iOS and Android. */
export const headingProps = (level: 1 | 2) => ({
  role: 'heading',
  'aria-level': String(level),
  'accessibility-traits': 'header' as const,
  'accessibility-heading': true,
});

type SizedTextProps = {
  /** Font size in px at normal text size. */
  size: number;
  /** Height of a line in px at normal text size; it becomes a ratio that scales with the text. */
  leading?: number;
  className?: string;
  /** Limits the text to this many lines, ending in an ellipsis. */
  lines?: number;
  children: ReactNode;
};

/** Text in the display face, which stops growing with the system text size at 150%. */
export function DisplayText({
  size,
  leading = size,
  className,
  lines,
  heading,
  children,
}: SizedTextProps & {
  /** Marks the text as a heading of this level. */
  heading?: 1 | 2;
}) {
  const { fontScale } = useApp();
  return (
    <text
      className={cx('display', lines ? 'clamp' : undefined, className)}
      text-maxline={lines ? String(lines) : undefined}
      style={displayStyle(size, leading, fontScale)}
      {...(heading && headingProps(heading))}
    >
      {children}
    </text>
  );
}

/** Letters inside a shape (a tag, a tab), which stop growing with the system text size at 130%. */
export function GlyphText({ size, leading = size, className, lines, children }: SizedTextProps) {
  const { fontScale } = useApp();
  return (
    <text
      className={cx(lines ? 'clamp' : undefined, className)}
      text-maxline={lines ? String(lines) : undefined}
      style={glyphStyle(size, leading, fontScale)}
    >
      {children}
    </text>
  );
}

/** The heading of a section within a screen. */
export const SectionTitle = ({ children }: { children: string }) => (
  <DisplayText size={28} leading={30} heading={2}>
    {children}
  </DisplayText>
);
