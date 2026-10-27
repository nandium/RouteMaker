import { useState } from '@lynx-js/react';

import { api } from '../../../../api.js';
import type { User } from '../../../../client-contract.js';
import { useApp } from '../../app-context.js';
import { Badge } from '../../components/Badge.js';
import { Button } from '../../components/Button.js';
import { RowTitle } from '../../components/Row.js';
import { Avatar } from '../../parts/Avatar.js';
import { Confirm } from './Confirm.js';
import './admin-items.css';

const DISABLE_CONSEQUENCE =
  'Disables the account, ends its sessions and hides all its routes. Enabling it again does not bring the routes back.';

export function AccountItem({
  account,
  token,
  onChanged,
}: {
  account: User;
  token: string;
  onChanged: (disabled: boolean) => void;
}) {
  const { run } = useApp();
  const [confirming, setConfirming] = useState(false);
  const setDisabled = (disabled: boolean) => {
    'background only';
    void run(async () => {
      await api.setUserDisabled(token, account.id, disabled);
      onChanged(disabled);
      setConfirming(false);
    });
  };

  return (
    <view className="admin-item">
      <view className="admin-account">
        <Avatar person={account} />
        <view className="row-copy">
          <RowTitle lines={1}>{account.display_name}</RowTitle>
          <text className="t-body-s c-ink-2 clamp" text-maxline="1">
            {`@${account.username}`}
          </text>
        </view>
        {account.disabled ? (
          <Badge tone="danger" icon="ban" label="Disabled" />
        ) : (
          <Badge tone="success" icon="check-circle" label="Active" />
        )}
      </view>
      {confirming ? (
        <Confirm
          consequence={DISABLE_CONSEQUENCE}
          action="Disable account"
          onConfirm={() => setDisabled(true)}
          onCancel={() => setConfirming(false)}
        />
      ) : account.disabled ? (
        <Button kind="secondary" size="sm" icon="check-circle" onTap={() => setDisabled(false)}>
          Enable
        </Button>
      ) : (
        <Button kind="secondary" size="sm" icon="ban" onTap={() => setConfirming(true)}>
          Disable
        </Button>
      )}
    </view>
  );
}
