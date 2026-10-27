import { useState } from '@lynx-js/react';

import { absoluteUrl, api } from '../../../api.js';
import type { AscentNote, AuthSession, Route } from '../../../client-contract.js';
import { share } from '../../../host.js';
import { plural } from '../../../plural.js';
import { WEB_PATHS } from '../../../web-pages.js';
import { useApp } from '../app-context.js';
import { cx } from '../class-names.js';
import { Async } from '../components/Async.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { DangerZone } from '../components/DangerZone.js';
import { Icon } from '../components/Icon.js';
import { Pressable } from '../components/Pressable.js';
import { Sheet } from '../components/Sheet.js';
import { Stat } from '../components/Stat.js';
import { DisplayText, GlyphText } from '../components/Text.js';
import { type Load, useLoad } from '../hooks/useLoad.js';
import { AscentCard, type UpdateRoute } from '../parts/AscentCard.js';
import { Avatar } from '../parts/Avatar.js';
import { Notes } from '../parts/Notes.js';
import { PhotoKey } from '../parts/PhotoKey.js';
import { ReportButton } from '../parts/ReportButton.js';
import { RoutePhoto } from '../parts/RoutePhoto.js';
import './RouteDetail.css';

const SHARED = {
  shared: 'Route shared.',
  opened: 'Share sheet opened.',
  copied: 'Route link copied.',
};

export function RouteDetail({ routeId }: { routeId: string }) {
  const { auth } = useApp();
  const token = auth?.token ?? null;
  // Loaded side by side; a failing notes request leaves the route readable.
  const route = useLoad(() => api.route(token, routeId), [routeId, token]);
  const notes = useLoad(() => api.notes(routeId), [routeId]);
  return (
    <Async state={route} loading={<DetailSkeleton />} failure="Couldn't load this route" back>
      {(detail) => <Detail route={detail} update={route.update} notes={notes} />}
    </Async>
  );
}

function DetailSkeleton() {
  return (
    <>
      <view className="det-photo-skeleton skel" />
      <view
        className="det-info"
        aria-busy="true"
        accessibility-element
        accessibility-label="Loading route"
      >
        <view className="skel skel-title det-skeleton-title" />
        <view className="skel skel-line" />
      </view>
    </>
  );
}

/** On a compact screen everything follows the photo in one column; a wide one has two. */
function Detail({
  route,
  update,
  notes,
}: {
  route: Route;
  update: UpdateRoute;
  notes: Load<AscentNote[]>;
}) {
  const { auth, wideLayout, back } = useApp();
  const own = auth?.user.username === route.author.username;
  const photo = <RoutePhoto route={route} />;
  const title = <TitleBlock route={route} own={own} />;
  const actions = <Actions route={route} update={update} />;
  const ascent = <AscentCard route={route} update={update} reloadNotes={notes.reload} />;
  const manage = auth && <Manage auth={auth} route={route} own={own} />;

  if (!wideLayout) {
    return (
      <>
        {photo}
        {title}
        {actions}
        <view className="det-section">{ascent}</view>
        <view className="det-section">
          <PhotoKey />
        </view>
        <view className="det-section">
          <Notes notes={notes} />
        </view>
        {manage && <view className="det-section">{manage}</view>}
        <view className="det-end" />
      </>
    );
  }
  return (
    <view className="page det-wide">
      <view className="det-back-row">
        <Button kind="quiet" size="sm" icon="back" onTap={back}>
          Back
        </Button>
      </view>
      <view className="det-columns">
        <view className="det-left">
          {photo}
          <PhotoKey />
        </view>
        <view className="det-right">
          {title}
          {actions}
          {ascent}
          {manage}
        </view>
      </view>
      <view className="det-notes">
        <Notes notes={notes} />
      </view>
    </view>
  );
}

function TitleBlock({ route, own }: { route: Route; own: boolean }) {
  const { wideLayout, go } = useApp();
  const code = route.id.slice(0, 4).toUpperCase();
  return (
    <view className="det-info">
      <view className="det-meta">
        <text className="t-label">{route.gym.name}</text>
        <view
          className="code-chip"
          accessibility-element
          accessibility-label={`Route code ${code}`}
          aria-label={`Route code ${code}`}
        >
          <GlyphText className="display code-chip-text" size={16} leading={20}>
            {code}
          </GlyphText>
        </view>
        {own && <Badge tone="solid" icon="check" label="Your route" />}
      </view>
      <DisplayText
        className="det-title"
        size={wideLayout ? 56 : 44}
        leading={wideLayout ? 54 : 44}
        heading={1}
      >
        {route.name}
      </DisplayText>
      <view className="det-by">
        <Pressable
          className="author-button"
          label={`By ${route.author.display_name}, open profile`}
          onTap={() => go({ name: 'profile', username: route.author.username })}
        >
          <Avatar person={route.author} size="s" />
          <text className="t-label c-link">{route.author.display_name}</text>
          <text className="t-body-s c-ink-2">{`@${route.author.username}`}</text>
        </Pressable>
        <Stat icon="check-circle" count={route.sends} phrase={plural(route.sends, 'send')} />
      </view>
    </view>
  );
}

function Actions({ route, update }: { route: Route; update: UpdateRoute }) {
  const { auth, go, notify, run } = useApp();
  // Set when a like is made, so the heart pops once the like has gone through.
  const [popped, setPopped] = useState(false);

  const toggleLike = () => {
    'background only';
    if (!auth) {
      go({ name: 'login', next: WEB_PATHS.route(route.id) });
      return notify('error', 'Sign in to like routes.');
    }
    setPopped(!route.liked);
    void run(async () => {
      const result = await api.like(auth.token, route.id, !route.liked);
      update((current) => ({ ...current, ...result }));
    });
  };
  const shareRoute = async () => {
    'background only';
    const result = await share(absoluteUrl(WEB_PATHS.route(route.id)), route.name);
    if (result === 'unavailable') notify('error', 'Sharing is not available on this device.');
    else if (result !== 'cancelled') notify('success', SHARED[result]);
  };

  return (
    <view className="det-actions btn-row">
      <Pressable
        className={cx('vote', route.liked && 'is-on', route.liked && popped && 'vote-pop')}
        label={`${route.liked ? 'Liked' : 'Like'}, ${plural(route.likes, 'like')}`}
        selected={route.liked}
        onTap={toggleLike}
      >
        <Icon
          name={route.liked ? 'like-on' : 'like'}
          tone={route.liked ? 'on-wall' : 'ink'}
          size={24}
        />
        <DisplayText className="vote-count" size={26} leading={28}>
          {String(route.likes)}
        </DisplayText>
        <text className="vote-label">{route.liked ? 'Liked' : 'Like'}</text>
      </Pressable>
      <Button kind="secondary" size="lg" icon="share" onTap={shareRoute}>
        Share
      </Button>
    </view>
  );
}

/** For the route's author or an administrator, taking it down; for anyone else, reporting it. */
function Manage({ auth, route, own }: { auth: AuthSession; route: Route; own: boolean }) {
  const { openSheet } = useApp();
  if (!own && auth.user.role !== 'admin') {
    return <ReportButton target="route" id={route.id} label="Report this route" />;
  }
  return (
    <DangerZone
      title={own ? 'Your route' : 'Moderator'}
      body={
        own
          ? 'Remove it if the photo or details are wrong. The photo is deleted for good.'
          : 'Removing a route deletes its photo for everyone and cannot be undone.'
      }
      action="Remove route"
      onTap={() => openSheet(<RemoveRouteSheet auth={auth} route={route} />)}
    />
  );
}

function RemoveRouteSheet({ auth, route }: { auth: AuthSession; route: Route }) {
  const { closeSheet, go, notify, run } = useApp();
  const remove = () => {
    'background only';
    void run(async () => {
      await api.removeRoute(auth.token, route.id);
      // Replace, so Back cannot return to the removed route.
      go({ name: 'gym', gymId: route.gym.id }, 'replace');
      notify('success', 'Route removed.');
    });
  };
  return (
    <Sheet title="Remove this route?">
      <text className="t-body c-ink-2">
        The photo is deleted for good and the route disappears from the feed and its gym. Likes and
        notes go with it. This cannot be undone.
      </text>
      <view className="sheet-actions">
        <Button kind="danger" size="lg" block icon="trash" onTap={remove}>
          Remove route
        </Button>
        <Button kind="secondary" size="lg" block onTap={closeSheet}>
          Keep route
        </Button>
      </view>
    </Sheet>
  );
}
