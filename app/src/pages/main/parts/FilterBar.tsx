import { useState } from '@lynx-js/react';

import { GRADE_TIERS } from '../../../grade-tiers.js';
import { plural } from '../../../plural.js';
import { useApp } from '../app-context.js';
import { cx } from '../class-names.js';
import { Button, LinkButton } from '../components/Button.js';
import { Icon } from '../components/Icon.js';
import { Pressable } from '../components/Pressable.js';
import { Segmented } from '../components/Segmented.js';
import { Choice, ChoiceGroup, Sheet } from '../components/Sheet.js';
import { SORTS, type SortKey } from '../ordering.js';
import './FilterBar.css';
import './GradeTag.css';

/**
 * Narrows a list of routes to grade tiers and orders it. Choosing no tier means every route,
 * and the count line says how many of them are showing. Where the host supports it, the bar
 * stays at the top of the screen while the routes scroll under it.
 */
export function FilterBar({
  tiers,
  onTiers,
  sort,
  onSort,
  shown,
  total,
}: {
  tiers: number[];
  onTiers: (tiers: number[]) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  shown: number;
  total: number;
}) {
  const { wideLayout, openSheet } = useApp();
  const toggle = (id: number) =>
    onTiers(tiers.includes(id) ? tiers.filter((tier) => tier !== id) : [...tiers, id]);
  const sortLabel = SORTS.find((option) => option.key === sort)!.label;

  const chips = (
    <view className="chips">
      {GRADE_TIERS.map(({ id, label }) => (
        <Pressable
          key={id}
          className={cx('chip', tiers.includes(id) && 'is-on')}
          label={`Grade ${label}`}
          selected={tiers.includes(id)}
          onTap={() => toggle(id)}
        >
          <view className={cx('chip-swatch', `g${id}`)} />
          <text className="chip-label">{label}</text>
          {tiers.includes(id) && <Icon name="check" size={16} />}
        </Pressable>
      ))}
    </view>
  );
  const sorting = wideLayout ? (
    <Segmented
      small
      label="Sort"
      options={SORTS.map(({ key, label }) => ({ id: key, label }))}
      value={sort}
      onChange={onSort}
    />
  ) : (
    <Pressable
      className="sort-button"
      label={`Sort: ${sortLabel}`}
      onTap={() => openSheet(<SortSheet value={sort} onChange={onSort} />)}
    >
      <Icon name="sort" size={18} />
      <text className="sort-label">{sortLabel}</text>
      <Icon name="chevron-down" size={16} />
    </Pressable>
  );
  const filtered = tiers.length > 0 || sort !== 'newest';
  const count = plural(total, 'route');
  const tally = (
    <view className="tally">
      <text
        className="t-cap c-ink-2"
        accessibility-traits="updating"
        accessibility-label={filtered ? `Showing ${shown} of ${count}` : count}
        aria-label={filtered ? `Showing ${shown} of ${count}` : count}
      >
        {filtered ? `${shown} of ${count}` : count}
      </text>
      {tiers.length > 0 && <LinkButton onTap={() => onTiers([])}>Clear filter</LinkButton>}
    </view>
  );

  return (
    <view className="page filter-sticky">
      <view className="filter-bar" role="group" aria-label="Filter and sort routes">
        {wideLayout ? (
          <view className="split-row">
            {chips}
            {sorting}
          </view>
        ) : (
          <scroll-view className="chips-scroll" scroll-orientation="horizontal">
            {chips}
          </scroll-view>
        )}
        <view className="tally-line split-row">
          {tally}
          {!wideLayout && sorting}
        </view>
      </view>
    </view>
  );
}

/** Applies each choice as it is made; Done only closes. */
function SortSheet({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  const { closeSheet } = useApp();
  // The sheet is shown from outside the list, so it keeps its own copy of the choice.
  const [chosen, setChosen] = useState(value);
  return (
    <Sheet title="Sort routes">
      <ChoiceGroup label="Order">
        {SORTS.map(({ key, label }) => (
          <Choice
            key={key}
            label={label}
            selected={key === chosen}
            onTap={() => {
              setChosen(key);
              onChange(key);
            }}
          />
        ))}
      </ChoiceGroup>
      <Button size="lg" block onTap={closeSheet}>
        Done
      </Button>
    </Sheet>
  );
}
