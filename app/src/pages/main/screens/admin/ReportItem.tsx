import { useState } from '@lynx-js/react';

import { api } from '../../../../api.js';
import type { Report } from '../../../../client-contract.js';
import type { IconName } from '../../../../icons.js';
import { useApp } from '../../app-context.js';
import { Badge } from '../../components/Badge.js';
import { Button } from '../../components/Button.js';
import { RowTitle } from '../../components/Row.js';
import { REASONS } from '../../report-reasons.js';
import { Confirm } from './Confirm.js';
import './admin-items.css';

// What each kind of report is about, and the verb of the decision on it; that decision is said
// again, with what it does, before it is made, since none can be undone.
const KINDS: Record<
  Report['target_type'],
  { icon: IconName; label: string; verb: string; confirm: string; consequence: string }
> = {
  route: {
    icon: 'wall',
    label: 'Route',
    verb: 'Remove',
    confirm: 'Remove route',
    consequence: 'Removes the route and deletes its photo for good. This cannot be undone.',
  },
  ascent: {
    icon: 'beta',
    label: 'Note',
    verb: 'Hide',
    confirm: 'Hide note',
    consequence:
      'Removes the note text from the route. The send and grade stay. This cannot be undone.',
  },
  user: {
    icon: 'user',
    label: 'User',
    verb: 'Disable',
    confirm: 'Disable account',
    consequence:
      'Disables the account, ends its sessions and hides all its routes. Enabling it again does not bring the routes back.',
  },
};

export function ReportItem({
  report,
  token,
  onDecided,
}: {
  report: Report;
  token: string;
  onDecided: () => void;
}) {
  const { go, run } = useApp();
  const [confirming, setConfirming] = useState(false);
  const kind = KINDS[report.target_type];
  const label = report.target_label ?? report.target_id;
  const decide = (decision: 'hide' | 'dismiss') => {
    'background only';
    void run(async () => {
      await api.moderateReport(token, report.id, decision);
      onDecided();
    });
  };
  const inspectable = report.route_id || (report.target_type === 'user' && report.target_label);
  const inspect = () => {
    if (report.route_id) go({ name: 'route', routeId: report.route_id });
    else if (report.target_label) go({ name: 'profile', username: report.target_label });
  };

  return (
    <view className="admin-item">
      <view className="split-row">
        <Badge tone="outline" icon={kind.icon} label={kind.label} />
        <view className="admin-reason">
          <text className="t-cap c-ink-2">Reason</text>
          <text className="t-label">{REASONS[report.reason].label}</text>
        </view>
      </view>
      {report.target_type === 'ascent' ? (
        <view className="quote">
          <text className="t-body clamp" text-maxline="4">{`“${label}”`}</text>
        </view>
      ) : (
        <RowTitle>{label}</RowTitle>
      )}
      {report.details ? (
        <view className="quote">
          <text className="t-cap c-ink-2">Reporter details</text>
          <text className="t-body-s">{report.details}</text>
        </view>
      ) : (
        <text className="t-body-s c-ink-3">No details provided.</text>
      )}
      {confirming ? (
        <Confirm
          consequence={kind.consequence}
          action={kind.confirm}
          onConfirm={() => decide('hide')}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <view className="admin-actions">
          {inspectable && (
            <Button kind="secondary" size="sm" icon="search" onTap={inspect}>
              Inspect
            </Button>
          )}
          <Button kind="danger" size="sm" icon="trash" onTap={() => setConfirming(true)}>
            {kind.verb}
          </Button>
          <Button kind="quiet" size="sm" onTap={() => decide('dismiss')}>
            Dismiss
          </Button>
        </view>
      )}
    </view>
  );
}
