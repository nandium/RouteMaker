import { useState } from '@lynx-js/react';

import { absoluteUrl } from '../../../api.js';
import type { Route } from '../../../client-contract.js';
import { useApp } from '../app-context.js';
import { Button, IconButton } from '../components/Button.js';
import { GradeTag } from './GradeTag.js';
import { Icon } from '../components/Icon.js';
import './RoutePhoto.css';

// Until the photo reports its own proportions, the box is a typical portrait wall photo.
const DEFAULT_RATIO = 4 / 5;

/**
 * The route's photo at its own proportions, with its grade tag pinned to the bottom edge and, on
 * compact screens, a back button over the corner.
 */
export function RoutePhoto({ route }: { route: Route }) {
  const { back, wideLayout } = useApp();
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <view className="det-photo" style={{ aspectRatio: `${ratio}` }}>
      {!loaded && !failed && <view className="det-photo-wait skel" />}
      {failed ? (
        <view className="det-photo-failed" role="alert">
          <Icon name="photo" tone="ink-2" size={36} />
          <text className="t-title">Photo didn't load</text>
          <text className="t-body-s c-ink-2">Check your connection and try again.</text>
          <Button
            kind="secondary"
            size="sm"
            icon="refresh"
            onTap={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            Reload photo
          </Button>
        </view>
      ) : (
        <image
          // A new key makes the image load again after a failure.
          key={attempt}
          className="det-photo-image"
          src={absoluteUrl(route.image_url)}
          mode="aspectFit"
          bindload={({ detail }) => {
            if (detail.width && detail.height) setRatio(detail.width / detail.height);
            setLoaded(true);
          }}
          binderror={() => setFailed(true)}
          accessibility-element
          accessibility-label={`${route.name} route topo`}
        />
      )}
      {!wideLayout && (
        <view className="det-back">
          <IconButton icon="back" label="Back" onTap={back} />
        </view>
      )}
      {/* Keyed by its grade, so that a changed grade is stamped on again. */}
      <view className="det-tag" key={route.public_grade}>
        <GradeTag
          grade={route.public_grade}
          size="xl"
          className="tag-ring tag-pin tag-stamp"
          label={route.public_grade ? `Grade ${route.public_grade}` : 'Unrated'}
        />
      </view>
    </view>
  );
}
