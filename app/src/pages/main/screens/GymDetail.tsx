import { api } from '../../../api.js';
import type { GymListing } from '../../../client-contract.js';
import { WEB_PATHS } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { Button } from '../components/Button.js';
import {
  Hero,
  HeroActions,
  HeroBar,
  HeroRow,
  HeroSubtitle,
  HeroTitle,
} from '../components/Hero.js';
import { InitialTile } from '../components/InitialTile.js';
import { State } from '../components/State.js';
import { DisplayText } from '../components/Text.js';
import { type Load, useLoad } from '../hooks/useLoad.js';
import { RouteList } from '../parts/RouteList.js';
import './GymDetail.css';

/** One gym and its routes, which load independently: neither list waits on the other. */
export function GymDetail({ gymId }: { gymId: string }) {
  const { auth, go, wideLayout, openInBrowser } = useApp();
  const token = auth?.token ?? null;
  const gyms = useLoad(() => api.gyms(), []);
  const routes = useLoad(() => api.routes(token, { gymId }), [gymId, token]);
  const gym = gyms.status === 'ready' ? gyms.data.find(({ id }) => id === gymId) : undefined;
  const missing = gyms.status === 'ready' && !gym;
  const addRoute = () => openInBrowser(WEB_PATHS.newRouteAt(gymId), 'route editor');

  if (missing) {
    return (
      <view className="page">
        <State failed title="That gym isn't here" body="It may have been removed.">
          <Button size="lg" block icon="back" onTap={() => go({ name: 'gyms' })}>
            All gyms
          </Button>
        </State>
      </view>
    );
  }

  const addLabel = `Add a route${gym ? ` to ${gym.name}` : ''}, opens in your browser`;
  return (
    <>
      <Hero>
        <HeroBar>
          <Button kind="wall-line" size="sm" icon="back" onTap={() => go({ name: 'gyms' })}>
            All gyms
          </Button>
          {!wideLayout && (
            <Button kind="wall" size="sm" icon="plus" external label={addLabel} onTap={addRoute}>
              Add a route
            </Button>
          )}
        </HeroBar>
        <HeroRow>
          <GymHead gym={gym} gyms={gyms} />
          {wideLayout && (
            <HeroActions>
              {gym && (
                <view className="route-total">
                  <DisplayText className="c-on-wall" size={36} leading={38}>
                    {String(gym.route_count)}
                  </DisplayText>
                  <HeroSubtitle>{gym.route_count === 1 ? 'route' : 'routes'}</HeroSubtitle>
                </view>
              )}
              <Button kind="wall" size="lg" icon="plus" external label={addLabel} onTap={addRoute}>
                Add a route
              </Button>
            </HeroActions>
          )}
        </HeroRow>
      </Hero>
      <RouteList
        state={routes}
        showGym={false}
        empty={
          <State
            title="No routes here yet"
            body="Be the first to set one: photograph the wall, mark the holds, publish."
          >
            <Button size="lg" block icon="plus" external onTap={addRoute}>
              Add the first route
            </Button>
          </State>
        }
      />
    </>
  );
}

/** The gym's tile, name and address; a placeholder while the gyms load, and why not if they fail. */
function GymHead({ gym, gyms }: { gym: GymListing | undefined; gyms: Load<GymListing[]> }) {
  if (gyms.status === 'error') {
    return (
      <view className="gym-head-failed">
        <HeroTitle small>Couldn't load this gym</HeroTitle>
        <HeroSubtitle>{gyms.message}</HeroSubtitle>
        <Button kind="wall-line" size="sm" icon="refresh" onTap={gyms.reload}>
          Try again
        </Button>
      </view>
    );
  }
  if (!gym) return <view className="gym-head skel skel-on-wall" />;
  return (
    <view
      className="gym-head"
      accessibility-element
      accessibility-label={`${gym.name}, ${gym.address}`}
    >
      <InitialTile letter={gym.country_code} size="country" bordered />
      <view className="row-copy">
        <HeroTitle small>{gym.name}</HeroTitle>
        <HeroSubtitle>{gym.address}</HeroSubtitle>
      </view>
    </view>
  );
}
