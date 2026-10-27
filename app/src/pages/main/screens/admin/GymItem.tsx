import { api } from '../../../../api.js';
import type { Gym } from '../../../../client-contract.js';
import { useApp } from '../../app-context.js';
import { Button } from '../../components/Button.js';
import { RowTitle } from '../../components/Row.js';
import './admin-items.css';

export function GymItem({
  gym,
  token,
  onDecided,
}: {
  gym: Gym;
  token: string;
  onDecided: () => void;
}) {
  const { run } = useApp();
  const decide = (decision: 'approve' | 'reject') => {
    'background only';
    void run(async () => {
      await api.moderateGym(token, gym.id, decision);
      onDecided();
    });
  };

  return (
    <view className="admin-item">
      <RowTitle>{gym.name}</RowTitle>
      <text className="t-body-s c-ink-2 clamp" text-maxline="2">
        {gym.address}
      </text>
      <view className="admin-actions">
        <Button size="sm" icon="check" onTap={() => decide('approve')}>
          Approve
        </Button>
        <Button kind="secondary" size="sm" icon="close" onTap={() => decide('reject')}>
          Reject
        </Button>
      </view>
    </view>
  );
}
