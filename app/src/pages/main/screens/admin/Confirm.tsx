import { Button } from '../../components/Button.js';
import { Icon } from '../../components/Icon.js';

/** Spells out what a decision does and asks again, in place of the buttons that led to it. */
export function Confirm({
  consequence,
  action,
  onConfirm,
  onCancel,
}: {
  consequence: string;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <view className="confirm" role="alert">
      <view className="confirm-text">
        <Icon name="alert" tone="danger" size={20} />
        <text className="t-body-s confirm-consequence">{consequence}</text>
      </view>
      <view className="btn-row">
        <Button kind="danger" size="sm" onTap={onConfirm}>
          {action}
        </Button>
        <Button kind="secondary" size="sm" onTap={onCancel}>
          Cancel
        </Button>
      </view>
    </view>
  );
}
