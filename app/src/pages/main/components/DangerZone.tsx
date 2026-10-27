import { Button } from './Button.js';
import { DisplayText } from './Text.js';
import './DangerZone.css';

/** A red-edged box around one destructive action, which asks for its own confirmation. */
export function DangerZone({
  title,
  body,
  action,
  onTap,
}: {
  title: string;
  body: string;
  /** The button's label. */
  action: string;
  onTap: () => void;
}) {
  return (
    <view className="zone">
      <DisplayText className="zone-title" size={24} leading={26}>
        {title}
      </DisplayText>
      <text className="t-body-s c-ink-2">{body}</text>
      <Button kind="danger" size="lg" block icon="trash" onTap={onTap}>
        {action}
      </Button>
    </view>
  );
}
