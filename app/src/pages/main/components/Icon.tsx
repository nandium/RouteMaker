import { BRAND_PALETTE, LOGO_MARK_SIZE, logoMarkSvg } from '../../../brand.js';
import { type IconName, type IconTone, iconColor, iconSvg } from '../../../icons.js';
import { useApp } from '../app-context.js';
import { iconScale } from '../text-scale.js';

/** An icon drawn in one of the theme's colors; `size` is in px at normal text size. */
export function Icon({
  name,
  tone = 'ink',
  size = 24,
}: {
  name: IconName;
  tone?: IconTone;
  size?: number;
}) {
  const { colorScheme, fontScale } = useApp();
  const color = iconColor(colorScheme, tone);
  const px = Math.round(size * iconScale(fontScale));
  return (
    <svg
      // Keyed by what it draws so a theme change remounts the svg and every host repaints it.
      key={`${name}-${color}-${px}`}
      className="icon"
      style={{ width: `${px}px`, height: `${px}px` }}
      content={iconSvg(name, color, size)}
    />
  );
}

/** The logo, in the brand colors of the current theme. */
export function BrandMark({ height }: { height: number }) {
  const { colorScheme } = useApp();
  return (
    <svg
      key={colorScheme}
      className="icon"
      style={{
        width: `${Math.round((height * LOGO_MARK_SIZE.width) / LOGO_MARK_SIZE.height)}px`,
        height: `${height}px`,
      }}
      content={logoMarkSvg(BRAND_PALETTE[colorScheme])}
    />
  );
}
