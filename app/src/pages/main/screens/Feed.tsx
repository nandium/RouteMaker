import { api } from '../../../api.js';
import { WEB_PATHS } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { Button } from '../components/Button.js';
import { Hero, HeroHeader } from '../components/Hero.js';
import { Segmented } from '../components/Segmented.js';
import { State } from '../components/State.js';
import { useLoad } from '../hooks/useLoad.js';
import { RouteList } from '../parts/RouteList.js';
import './Feed.css';

export function Feed({ following }: { following: boolean }) {
  const { auth, go } = useApp();
  return (
    <>
      <Hero>
        <HeroHeader
          title="Feed"
          subtitle={
            following
              ? 'Fresh routes from climbers you follow.'
              : 'Fresh routes from every gym, newest first.'
          }
          aside={
            <view className="feed-switch">
              <Segmented
                label="Feed"
                value={following ? 'following' : 'everyone'}
                onChange={(id) => go({ name: 'feed', following: id === 'following' })}
                options={[
                  { id: 'everyone', label: 'Everyone', icon: 'feed' },
                  { id: 'following', label: 'Following', icon: 'user' },
                ]}
              />
            </view>
          }
        />
      </Hero>
      {following && !auth ? (
        <view className="page">
          <State
            title="Sign in to follow climbers"
            body="The Following feed shows routes from the climbers you follow. Everyone is still open to browse."
          >
            <Button size="lg" block icon="user" onTap={() => go({ name: 'login' })}>
              Sign in
            </Button>
            <Button
              kind="secondary"
              size="lg"
              block
              onTap={() => go({ name: 'feed', following: false })}
            >
              Back to Everyone
            </Button>
          </State>
        </view>
      ) : (
        <FeedRoutes following={following} token={auth?.token ?? null} />
      )}
    </>
  );
}

function FeedRoutes({ following, token }: { following: boolean; token: string | null }) {
  const { go, openInBrowser } = useApp();
  const routes = useLoad(() => api.routes(token, { following }), [following, token]);
  return (
    <RouteList
      state={routes}
      empty={
        following ? (
          <State
            title="Nothing from climbers you follow yet"
            body="Open a route and tap its author to follow them. Their new routes will land here."
          >
            <Button size="lg" block onTap={() => go({ name: 'feed', following: false })}>
              Browse Everyone
            </Button>
          </State>
        ) : (
          <State
            title="No routes yet"
            body="Nothing has been published. Be the first: add a route to your gym."
          >
            <Button
              size="lg"
              block
              icon="plus"
              external
              onTap={() => openInBrowser(WEB_PATHS.newRoute, 'route editor')}
            >
              Add a route
            </Button>
          </State>
        )
      }
    />
  );
}
