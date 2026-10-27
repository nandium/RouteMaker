import { api } from '../../../api.js';
import type { PublicProfile, Route } from '../../../client-contract.js';
import { gradeSpread } from '../../../grade-tiers.js';
import { plural } from '../../../plural.js';
import { WEB_PATHS } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { Async } from '../components/Async.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { GroupHead } from '../components/GroupHead.js';
import {
  Hero,
  HeroActions,
  HeroBar,
  HeroRow,
  HeroSubtitle,
  HeroTitle,
} from '../components/Hero.js';
import { RowSkeletons, State } from '../components/State.js';
import { DisplayText } from '../components/Text.js';
import { useLoad } from '../hooks/useLoad.js';
import { Avatar } from '../parts/Avatar.js';
import '../parts/GradeTag.css';
import { ReportButton } from '../parts/ReportButton.js';
import { RouteList } from '../parts/RouteList.js';
import './Profile.css';

export function Profile({ username }: { username: string }) {
  const { auth, run, go, notify } = useApp();
  const token = auth?.token ?? null;
  const profile = useLoad(() => api.profile(token, username), [username, token]);

  const toggleFollow = ({ id, followed }: PublicProfile) => {
    'background only';
    if (!auth) {
      go({ name: 'login', next: WEB_PATHS.profile(username) });
      return notify('error', 'Sign in to follow climbers.');
    }
    void run(async () => {
      const result = await api.follow(auth.token, id, !followed);
      profile.update((current) => ({ ...current, ...result }));
    });
  };

  return (
    <Async
      state={profile}
      loading={
        <>
          <Hero>
            <BackBar />
            <view className="skel skel-on-wall" />
          </Hero>
          <view className="page">
            <RowSkeletons count={4} label="Loading routes" />
          </view>
        </>
      }
      failure="That climber isn't here"
      back
    >
      {(climber) => {
        const own = auth?.user.id === climber.id;
        return (
          <>
            <Hero>
              <BackBar />
              <HeroRow>
                <view className="profile-head">
                  <view className="profile-id">
                    <Avatar person={climber} size="l" />
                    <view className="row-copy">
                      <HeroTitle small lines={2}>
                        {climber.display_name}
                      </HeroTitle>
                      <text className="hero-sub clamp" text-maxline="1">
                        {`@${climber.username}`}
                      </text>
                    </view>
                  </view>
                  <view className="profile-counts">
                    <Count n={climber.followers} noun="followers" />
                    <Count n={climber.following} noun="following" />
                  </view>
                </view>
                {own ? (
                  <Badge tone="solid" icon="user" label="This is you" />
                ) : (
                  <HeroActions>
                    <Button
                      kind={climber.followed ? 'wall-line' : 'wall'}
                      size="lg"
                      icon={climber.followed ? 'check' : 'plus'}
                      label={climber.followed ? 'Following, tap to unfollow' : 'Follow'}
                      onTap={() => toggleFollow(climber)}
                    >
                      {climber.followed ? 'Following' : 'Follow'}
                    </Button>
                  </HeroActions>
                )}
              </HeroRow>
            </Hero>
            <ProfileRoutes climber={climber} token={token} own={own} />
            {auth && !own && (
              <view className="page">
                <ReportButton target="user" id={climber.id} label="Report this climber" />
              </view>
            )}
          </>
        );
      }}
    </Async>
  );
}

function BackBar() {
  const { back } = useApp();
  return (
    <HeroBar>
      <Button kind="wall-line" size="sm" icon="back" onTap={back}>
        Back
      </Button>
    </HeroBar>
  );
}

function Count({ n, noun }: { n: number; noun: string }) {
  return (
    <view
      className="profile-count"
      accessibility-element
      accessibility-label={`${n} ${noun}`}
      aria-label={`${n} ${noun}`}
    >
      <DisplayText className="c-on-wall" size={28} leading={30}>
        {String(n)}
      </DisplayText>
      <HeroSubtitle>{noun}</HeroSubtitle>
    </view>
  );
}

function ProfileRoutes({
  climber,
  token,
  own,
}: {
  climber: PublicProfile;
  token: string | null;
  own: boolean;
}) {
  const { openInBrowser } = useApp();
  const routes = useLoad(() => api.routes(token, { authorId: climber.id }), [climber.id, token]);
  return (
    <RouteList
      state={routes}
      summary={(list) => <GradeSpread routes={list} />}
      empty={
        own ? (
          <State
            title="No routes yet"
            body="Your routes will show here. Photograph a wall, mark the holds and publish."
          >
            <Button
              size="lg"
              block
              icon="plus"
              external
              onTap={() => openInBrowser(WEB_PATHS.newRoute, 'route editor')}
            >
              Add your first route
            </Button>
          </State>
        ) : (
          <State
            title="No routes yet"
            body={`${climber.display_name} has not published anything. Follow to see their first route in your feed.`}
          />
        )
      }
    />
  );
}

/** How the routes this climber set divide among the grade tiers, in one bar and one sentence. */
function GradeSpread({ routes }: { routes: Route[] }) {
  const spread = gradeSpread(routes);
  if (!spread.length) return null;
  const mostly = [...spread]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(({ tier }) => tier.label)
    .join(' and ');
  const description = spread.map(({ tier, count }) => `${count} in ${tier.label}`).join(', ');
  return (
    <view className="page">
      <GroupHead title="What they set" />
      <view className="spread-section">
        <view className="spread" role="img" aria-label={`Grade spread: ${description}`}>
          {spread.map(({ tier, count }) => (
            <view
              key={tier.id}
              className={`spread-part g${tier.id}`}
              style={{ flex: `${count} 1 0` }}
            />
          ))}
        </view>
        <text className="t-body-s c-ink-2">
          {`Sets mostly ${mostly}. Based on ${plural(routes.length, 'route')}.`}
        </text>
      </view>
    </view>
  );
}
