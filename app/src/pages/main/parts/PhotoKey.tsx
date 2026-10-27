import { LEGEND_KINDS, LEGEND_SIZE, type LegendKind, legendSvg } from '../../../marking-legend.js';
import { GlyphText } from '../components/Text.js';
import './PhotoKey.css';

const KEY: Record<LegendKind, { label: string; chip?: string }> = {
  hand: { label: 'Hand', chip: '1' },
  foot: { label: 'Foot', chip: 'F' },
  any: { label: 'Any limb', chip: '2' },
  start: { label: 'Start tape' },
  finish: { label: 'Finish tape' },
};

/** What the burned-in marks on a route photo mean. */
export function PhotoKey() {
  return (
    <view className="photo-key">
      <text className="t-label c-ink-2">How to read the photo</text>
      <view className="key-list" role="list" aria-label="Photo key">
        {LEGEND_KINDS.map((kind) => (
          <view key={kind} className="key-item" role="listitem">
            <view className="key-glyph" accessibility-element={false}>
              <svg
                style={{ width: `${LEGEND_SIZE.width}px`, height: `${LEGEND_SIZE.height}px` }}
                content={legendSvg(kind)}
              />
              {KEY[kind].chip && (
                <view className="key-chip">
                  <GlyphText className="display key-digit" size={10} leading={14}>
                    {KEY[kind].chip}
                  </GlyphText>
                </view>
              )}
            </view>
            <text className="t-body-s">{KEY[kind].label}</text>
          </view>
        ))}
      </view>
    </view>
  );
}
