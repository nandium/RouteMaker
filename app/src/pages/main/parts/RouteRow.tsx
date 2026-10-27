import { useState } from '@lynx-js/react';

import { absoluteUrl } from '../../../api.js';
import type { Route } from '../../../client-contract.js';
import { plural } from '../../../plural.js';
import { useApp } from '../app-context.js';
import { Icon } from '../components/Icon.js';
import { Pressable } from '../components/Pressable.js';
import { Row, RowTitle } from '../components/Row.js';
import { Stat } from '../components/Stat.js';
import { GradeTag } from './GradeTag.js';
import './RouteRow.css';

// A 1x1 PNG shown while a thumbnail loads, on hosts that support `placeholder`.
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type RouteItemProps = {
  route: Route;
  /** Names the gym in the byline; leave it out where the gym is already on screen. */
  showGym: boolean;
};

const byline = ({ route, showGym }: RouteItemProps) =>
  showGym ? `${route.gym.name} · ${route.author.display_name}` : `by ${route.author.display_name}`;

const description = (route: Route) =>
  `${route.name}, ${route.public_grade || 'unrated'}, by ${route.author.display_name}, ` +
  `${plural(route.likes, 'like')}, ${plural(route.sends, 'send')}`;

/** A route in a list on a compact screen: its thumbnail with the grade tag pinned to it. */
export function RouteRow(props: RouteItemProps) {
  const { go } = useApp();
  const { route } = props;
  return (
    <Row
      className="route-row"
      label={description(route)}
      onTap={() => go({ name: 'route', routeId: route.id })}
    >
      <view className="thumb">
        <Thumbnail route={route} />
        <view className="thumb-tag">
          <GradeTag grade={route.public_grade} className="tag-ring" />
        </view>
      </view>
      <view className="row-copy">
        <Summary {...props} />
      </view>
    </Row>
  );
}

/** A route in a list on a wide screen: a photo tile. */
export function RouteTile(props: RouteItemProps) {
  const { go } = useApp();
  const { route } = props;
  return (
    <Pressable
      className="route-tile"
      label={description(route)}
      onTap={() => go({ name: 'route', routeId: route.id })}
    >
      <view className="tile-photo">
        <Thumbnail route={route} />
        <view className="thumb-tag">
          <GradeTag grade={route.public_grade} className="tag-ring" />
        </view>
      </view>
      <view className="tile-copy">
        <Summary {...props} />
      </view>
    </Pressable>
  );
}

function Summary({ route, showGym }: RouteItemProps) {
  return (
    <>
      <RowTitle>{route.name}</RowTitle>
      <text className="t-body-s c-ink-2 clamp" text-maxline="1">
        {byline({ route, showGym })}
      </text>
      <view className="route-stats">
        <Stat
          icon={route.liked ? 'like-on' : 'like'}
          tone={route.liked ? 'link' : 'ink-2'}
          count={route.likes}
          phrase={plural(route.likes, 'like')}
        />
        <Stat icon="check-circle" count={route.sends} phrase={plural(route.sends, 'send')} />
      </view>
    </>
  );
}

function Thumbnail({ route }: { route: Route }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <view className="thumb-failed">
        <Icon name="photo" tone="ink-3" size={24} />
      </view>
    );
  }
  return (
    <image
      className="thumb-image"
      src={absoluteUrl(route.thumb_url)}
      placeholder={PLACEHOLDER}
      mode="aspectFill"
      binderror={() => setFailed(true)}
      accessibility-element={false}
    />
  );
}
