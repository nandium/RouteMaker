import { useRef } from '@lynx-js/react';

import { api } from '../../../api.js';
import type { GymListing, MapLocation } from '../../../client-contract.js';
import { nativeMap } from '../../../host.js';
import { approximateLocation, nativeMapScene } from '../../../native-map.js';
import { plural } from '../../../plural.js';
import { WEB_PATHS } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { Async } from '../components/Async.js';
import { Button } from '../components/Button.js';
import { GroupHead } from '../components/GroupHead.js';
import { Hero, HeroActions, HeroHeader } from '../components/Hero.js';
import { Icon } from '../components/Icon.js';
import { RowSkeletons, State } from '../components/State.js';
import { GymRow } from '../parts/GymRow.js';
import { type Load, useLoad } from '../hooks/useLoad.js';
import { nearestFirst } from '../ordering.js';
import './GymList.css';

export function GymList() {
  const { wideLayout, openInBrowser } = useApp();
  const gyms = useLoad(() => api.gyms(), []);
  // A coarse hint to list the nearest gyms first; without one the list stays by name.
  const location = useLoad(() => approximateLocation(() => api.location()), []);
  const here = location.status === 'ready' ? location.data : null;
  const map = useGymMap(gyms.status === 'ready' ? gyms.data : null, location);

  return (
    <>
      <Hero>
        <HeroHeader
          title="Gyms"
          subtitle="Pick a gym and see what's on the wall."
          aside={
            <HeroActions>
              {gyms.status === 'ready' && (
                <Button kind="wall" size="lg" icon="map" onTap={map.open}>
                  Gym map
                </Button>
              )}
              <Button
                kind="wall-line"
                size="lg"
                icon="plus"
                external={wideLayout}
                label="Add a route, opens in your browser"
                onTap={() => openInBrowser(WEB_PATHS.newRoute, 'route editor')}
              >
                Add a route
              </Button>
            </HeroActions>
          }
        />
      </Hero>
      <view className="page">
        <Async
          state={gyms}
          loading={<RowSkeletons count={6} kind="gym" label="Loading gyms" />}
          failure="Couldn't load gyms"
        >
          {(list) =>
            list.length ? (
              <Gyms gyms={nearestFirst(list, here)} here={here} />
            ) : (
              <State
                title="No gyms yet"
                body="Gyms show up here once an admin approves them. Know one that is missing? Request it on the map."
              >
                <Button size="lg" block icon="map" onTap={map.open}>
                  Request a gym on the map
                </Button>
              </State>
            )
          }
        </Async>
      </view>
    </>
  );
}

function Gyms({ gyms, here }: { gyms: GymListing[]; here: MapLocation | null }) {
  const { wideLayout } = useApp();
  return (
    <>
      <GroupHead title={plural(gyms.length, 'gym')}>
        <view className="gym-order">
          {here && <Icon name="locate" tone="ink-2" size={14} />}
          <text className="t-cap c-ink-2">{here ? 'Nearest first' : 'Sorted by name'}</text>
        </view>
      </GroupHead>
      <view className={wideLayout ? 'gym-grid' : undefined}>
        {gyms.map((gym) => (
          <GymRow key={gym.id} gym={gym} here={here} />
        ))}
      </view>
    </>
  );
}

/** Opens the native map, or the browser map on hosts without one. */
function useGymMap(gyms: GymListing[] | null, location: Load<MapLocation | null>) {
  const { colorScheme, go, openInBrowser } = useApp();
  // True from the tap until the native map reports back, so it is never presented twice.
  const opening = useRef(false);

  return {
    open() {
      'background only';
      const map = nativeMap();
      if (!gyms || opening.current) return;
      if (!map) return void openInBrowser(WEB_PATHS.gymMap, 'gym map');

      opening.current = true;
      // The map follows the device by itself where it can; this only decides where it starts.
      const hint = location.status === 'ready' ? location.data : null;
      map.open(JSON.stringify(nativeMapScene(gyms, colorScheme, hint)), (gymId) => {
        opening.current = false;
        if (gymId) go({ name: 'gym', gymId });
      });
    },
  };
}
