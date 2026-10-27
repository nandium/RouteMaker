import type { GymListing, MapLocation } from '../../../client-contract.js';
import { plural } from '../../../plural.js';
import { useApp } from '../app-context.js';
import { Icon } from '../components/Icon.js';
import { InitialTile } from '../components/InitialTile.js';
import { Row, RowTitle } from '../components/Row.js';
import { DisplayText } from '../components/Text.js';
import { approximateDistance } from '../ordering.js';
import './GymRow.css';

/** A gym in the list: its country, name and address, how many routes it has, and how far it is. */
export function GymRow({ gym, here }: { gym: GymListing; here: MapLocation | null }) {
  const { go } = useApp();
  return (
    <Row
      label={`${gym.name}, ${gym.address}, ${plural(gym.route_count, 'route')}`}
      onTap={() => go({ name: 'gym', gymId: gym.id })}
    >
      <InitialTile letter={gym.country_code} size="country" />
      <view className="row-copy">
        <RowTitle>{gym.name}</RowTitle>
        <text className="t-body-s c-ink-2 clamp" text-maxline="2">
          {gym.address}
        </text>
        {here && (
          <view className="gym-distance">
            <Icon name="locate" tone="ink-2" size={14} />
            <text className="t-cap-b c-ink-2">{approximateDistance(here, gym)}</text>
          </view>
        )}
      </view>
      <view className="gym-count" accessibility-element={false}>
        <DisplayText size={28} leading={30}>
          {String(gym.route_count)}
        </DisplayText>
        <text className="t-cap c-ink-2">{gym.route_count === 1 ? 'route' : 'routes'}</text>
      </view>
    </Row>
  );
}
