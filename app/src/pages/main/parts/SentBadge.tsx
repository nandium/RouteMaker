import { Badge } from '../components/Badge.js';

/** Says whether an ascent was a send or still a project, in words as well as color. */
export const SentBadge = ({ sent }: { sent: boolean }) =>
  sent ? (
    <Badge tone="success" icon="check-circle" label="Sent" />
  ) : (
    <Badge tone="dashed" icon="proj" label="Projecting" />
  );
