// Native hosts enlarge all text by the system's font scale. Reading text should follow it all the
// way; display type and the letters inside shapes (grade numerals, initials) would break their
// layouts, so they are shrunk by the same factor beyond a cap and stop growing there.
const DISPLAY_CAP = 1.5;
const GLYPH_CAP = 1.3;

/** The scales at which layouts reflow: buttons stack, rows grow, icons enlarge. */
const LARGE = 1.3;
const HUGE = 2;

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

// A unitless ratio, so a line grows with its text however the host scales it. Lynx clips a line
// that is not taller than its text, hence the floor.
const ratio = (size: number, leading: number) =>
  String(Math.max(Math.round((leading / size) * 100) / 100, 1.05));

function cappedStyle(size: number, leading: number, cap: number, fontScale: number) {
  const shrink = Math.min(1, cap / fontScale);
  return { fontSize: px(size * shrink), lineHeight: ratio(size, leading) };
}

/** Style for display type: `size` and `leading` in px at normal text size. */
export const displayStyle = (size: number, leading: number, fontScale: number) =>
  cappedStyle(size, leading, DISPLAY_CAP, fontScale);

/** Style for letters inside a shape. */
export const glyphStyle = (size: number, leading: number, fontScale: number) =>
  cappedStyle(size, leading, GLYPH_CAP, fontScale);

/** Classes for the app's root that let the stylesheets reflow at large text sizes. */
export const textSizeClasses = (fontScale: number) =>
  [fontScale >= LARGE && 'fs-lg', fontScale >= HUGE && 'fs-xl'].filter(Boolean).join(' ');

/** Icons sit beside text, so they grow with it in two steps. */
export const iconScale = (fontScale: number) =>
  fontScale >= HUGE ? 1.6 : fontScale >= LARGE ? 1.25 : 1;
