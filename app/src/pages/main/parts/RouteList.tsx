import { type ReactNode, useState } from '@lynx-js/react';

import type { Route } from '../../../client-contract.js';
import { tierLabels } from '../../../grade-tiers.js';
import { useApp } from '../app-context.js';
import { Async } from '../components/Async.js';
import { Button } from '../components/Button.js';
import { RowSkeletons, State } from '../components/State.js';
import type { Load } from '../hooks/useLoad.js';
import { type SortKey, arrangeRoutes } from '../ordering.js';
import { FilterBar } from './FilterBar.js';
import { RouteRow, RouteTile } from './RouteRow.js';
import './RouteList.css';

// A list can hold a hundred routes, each with a picture, so it is shown a page at a time.
const PAGE_SIZE = 24;

/**
 * The routes of any screen, narrowed by grade and ordered as the climber chooses. `empty` is what
 * to show when there are no routes at all, `showGym` whether each route names its gym, and
 * `summary` what to show above the routes once there are some.
 */
export function RouteList({
  state,
  empty,
  showGym = true,
  summary,
}: {
  state: Load<Route[]>;
  empty: ReactNode;
  showGym?: boolean;
  summary?: (routes: Route[]) => ReactNode;
}) {
  return (
    <Async
      state={state}
      loading={
        <view className="page">
          <RowSkeletons count={5} label="Loading routes" />
        </view>
      }
      failure="Couldn't load routes"
    >
      {(routes) =>
        routes.length ? (
          <>
            {summary?.(routes)}
            <RouteBrowser routes={routes} showGym={showGym} />
          </>
        ) : (
          <view className="page">{empty}</view>
        )
      }
    </Async>
  );
}

function RouteBrowser({ routes, showGym }: { routes: Route[]; showGym: boolean }) {
  const { wideLayout } = useApp();
  const [tiers, setTiers] = useState<number[]>([]);
  const [sort, setSort] = useState<SortKey>('newest');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = arrangeRoutes(routes, tiers, sort);
  const remaining = shown.length - limit;
  const Item = wideLayout ? RouteTile : RouteRow;

  // Choosing differently starts the list again from its first page.
  const narrow = (next: number[]) => {
    setTiers(next);
    setLimit(PAGE_SIZE);
  };
  const order = (next: SortKey) => {
    setSort(next);
    setLimit(PAGE_SIZE);
  };

  return (
    <>
      <FilterBar
        tiers={tiers}
        onTiers={narrow}
        sort={sort}
        onSort={order}
        shown={shown.length}
        total={routes.length}
      />
      <view className="page">
        {shown.length ? (
          <>
            <view className={wideLayout ? 'route-grid' : undefined}>
              {shown.slice(0, limit).map((route) => (
                <Item key={route.id} route={route} showGym={showGym} />
              ))}
            </view>
            {remaining > 0 && (
              <view className="show-more">
                <Button
                  kind="secondary"
                  size="lg"
                  block
                  label={`Show ${Math.min(PAGE_SIZE, remaining)} more routes, ${remaining} not shown yet`}
                  onTap={() => setLimit(limit + PAGE_SIZE)}
                >
                  {`Show ${Math.min(PAGE_SIZE, remaining)} more`}
                </Button>
              </view>
            )}
          </>
        ) : (
          <State
            title={`No ${tierLabels(tiers)} routes`}
            body="Nothing in these grades yet. Try other grades, or clear the filter."
          >
            <Button kind="secondary" size="lg" block onTap={() => narrow([])}>
              Clear filter
            </Button>
          </State>
        )}
      </view>
    </>
  );
}
